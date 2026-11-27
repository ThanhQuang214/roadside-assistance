import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { errorHandler } from '../shared/http.ts';
import { getDb } from '../shared/db.ts';
import { signToken } from '../auth/auth-middleware.ts';
import type { Role } from '../auth/auth-validation.ts';
import { rescueRouter } from './rescue-request.api.ts';
import { dispatchRouter } from './rescue-dispatch.api.ts';

process.env.DB_PATH = ':memory:';
process.env.MAPS_PROVIDER = 'offline';

const app = express();
app.use(express.json());
app.use('/api/rescue-requests', rescueRouter);
app.use('/api/rescue-requests', dispatchRouter);
app.use(errorHandler);
const server = app.listen(0);
after(() => server.close());

async function call(method: string, path: string, token: string, body?: unknown) {
  const r = await fetch(`http://localhost:${(server.address() as AddressInfo).port}/api/rescue-requests${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() as any };
}

let seq = 0;
function makeUser(role: Role) {
  const id = Number(getDb().prepare(`INSERT INTO users (email, phone, password_hash, full_name, role) VALUES (?, '0900000000', 'x', ?, ?)`)
    .run(`u${++seq}@test.vn`, `Người ${seq}`, role).lastInsertRowid);
  return { id, token: signToken(id, role) };
}
function makeCompany(status = 'Approved') {
  const u = makeUser('COMPANY');
  const db = getDb();
  const companyId = Number(db.prepare(`INSERT INTO rescue_companies (user_id, name, phone, address, license_number, license_file_url,
    station_lat, station_lng, service_radius_km, approval_status) VALUES (?, ?, '0241234567', 'HN', 'GP', '/f', 21.0375, 105.8542, 20, ?)`)
    .run(u.id, `Cứu hộ ${seq}`, status).lastInsertRowid);
  const serviceId = Number(db.prepare(`INSERT INTO rescue_services (company_id, service_type_id, name, base_price) VALUES (?, 2, 'Vá lốp', 150000)`)
    .run(companyId).lastInsertRowid);
  return { ...u, companyId, serviceId };
}

const body = (c: { companyId: number; serviceId: number }) => ({
  companyId: c.companyId, serviceId: c.serviceId, vehicleTypeCode: 'MOTORBIKE', lat: 21.0285, lng: 105.8542, address: ' Hồ Gươm ',
  description: 'Xe máy bị thủng lốp sau, không đi tiếp được', contactPhone: '0912345678', photoUrl: '/api/uploads/abc-1.jpg',
  classification: { incidentType: 'FLAT_TIRE', urgency: 'MEDIUM', confidence: null, source: 'MANUAL' },
});

test('UC03 tạo đơn: server tính lại khoảng cách/giá, lưu phân loại; dữ liệu sai báo đúng trường', async () => {
  const user = makeUser('USER');
  const c = makeCompany();
  const r = await call('POST', '', user.token, { ...body(c), estimatedPrice: 1 });
  assert.equal(r.status, 201);
  const req = r.body.request;
  assert.equal(req.status, 'Pending');
  assert.equal(req.address, 'Hồ Gươm');
  assert.equal(req.estimatedPrice, 150000);
  assert.equal(req.distanceKm, 1.3); // offline: 1.0007 km chim bay × 1.3
  assert.deepEqual(req.vehicleType, { code: 'MOTORBIKE', name: 'Xe máy' });
  assert.deepEqual(req.service, { id: c.serviceId, name: 'Vá lốp', serviceTypeCode: 'TIRE' });
  assert.deepEqual(req.classification, { incidentType: 'FLAT_TIRE', urgency: 'MEDIUM', confidence: null, source: 'MANUAL' });
  assert.deepEqual([req.payment, req.reviewed, req.etaMinutes, req.user.id], [null, false, null, user.id]);
  assert.equal(getDb().prepare('SELECT suggested_service_type_id AS s FROM incident_classifications WHERE request_id = ?').get(req.id)!.s, 2);

  const field = async (patch: object) => (await call('POST', '', user.token, { ...body(c), ...patch })).body.error?.details.field;
  assert.equal(await field({ lat: 50 }), 'lat');
  assert.equal(await field({ description: 'ngắn' }), 'description');
  assert.equal(await field({ contactPhone: '123' }), 'contactPhone');
  assert.equal(await field({ vehicleTypeCode: 'PLANE' }), 'vehicleTypeCode');
  assert.equal(await field({ photoUrl: 'https://evil.example/x.jpg' }), 'photoUrl');
  assert.equal(await field({ classification: { incidentType: 'X', urgency: 'LOW', source: 'AI' } }), 'classification');
  assert.equal(await field({ serviceId: makeCompany().serviceId }), 'serviceId', 'gói của công ty khác');
  assert.equal(await field({ lat: 10.7769, lng: 106.7009 }), 'serviceId', 'ngoài phạm vi phục vụ');
  const pending = makeCompany('Pending');
  assert.equal(await field({ companyId: pending.companyId, serviceId: pending.serviceId }), 'serviceId', 'công ty chưa duyệt');
  getDb().prepare('UPDATE rescue_services SET is_active = 0 WHERE id = ?').run(c.serviceId);
  assert.equal(await field({}), 'serviceId', 'gói ngừng cung cấp');
  assert.equal((await call('POST', '', c.token, body(c))).status, 403, 'chỉ USER tạo đơn');
});

test('E2E UC03 → UC09: nhận (ETA) → bắt đầu → cập nhật ETA → hoàn tất + thanh toán; người dùng thấy cùng dữ liệu', async () => {
  const user = makeUser('USER');
  const c = makeCompany();
  const { id } = (await call('POST', '', user.token, body(c))).body.request;

  const list = await call('GET', '?status=Pending', c.token);
  assert.deepEqual(list.body.items.map((x: any) => x.id), [id]);
  assert.equal((await call('GET', `/${id}`, c.token)).body.request.contactPhone, '0912345678');

  assert.equal((await call('POST', `/${id}/accept`, c.token, { etaMinutes: 0 })).body.error.details.field, 'etaMinutes', 'UC09-4.2');
  assert.equal((await call('POST', `/${id}/complete`, c.token, {})).status, 409, 'UC09-5.1 Pending → Completed bị chặn');
  const accepted = await call('POST', `/${id}/accept`, c.token, { etaMinutes: 25 });
  assert.deepEqual([accepted.body.request.status, accepted.body.request.etaMinutes], ['Accepted', 25]);

  const cancel = await call('POST', `/${id}/cancel`, user.token, { reason: 'Đã tự sửa được' });
  assert.equal(cancel.status, 409, 'UC05-4.1 công ty đã nhận → không hủy được');
  assert.equal(cancel.body.error.code, 'INVALID_STATE_TRANSITION');
  assert.match(cancel.body.error.message, /Đã tiếp nhận/);

  assert.equal((await call('POST', `/${id}/start`, c.token)).body.request.status, 'InProgress');
  assert.equal((await call('PATCH', `/${id}/eta`, c.token, { etaMinutes: 10 })).body.request.etaMinutes, 10);
  assert.equal((await call('POST', `/${id}/complete`, c.token, { payment: { amount: -1, method: 'CASH' } })).body.error.details.field, 'amount');
  assert.equal((await call('PUT', `/${id}/payment`, c.token, { amount: 1, method: 'CASH' })).status, 409, 'chưa Completed thì chưa ghi thanh toán');

  const done = await call('POST', `/${id}/complete`, c.token, { payment: { amount: 180000, method: 'CASH', note: ' thêm phí đêm ' } });
  assert.equal(done.body.request.status, 'Completed');
  assert.deepEqual([done.body.request.payment.amount, done.body.request.payment.note], [180000, 'thêm phí đêm']);
  const paid = await call('PUT', `/${id}/payment`, c.token, { amount: 200000, method: 'BANK_TRANSFER' });
  assert.deepEqual([paid.body.request.payment.amount, paid.body.request.payment.method], [200000, 'BANK_TRANSFER']);

  const seen = (await call('GET', `/${id}`, user.token)).body.request;
  assert.ok(seen.acceptedAt && seen.startedAt && seen.completedAt);
  assert.deepEqual([seen.status, seen.payment.amount], ['Completed', 200000]);
  assert.equal((await call('PATCH', `/${id}/eta`, c.token, { etaMinutes: 5 })).status, 409);
});

test('UC05 hủy khi Pending; UC09-3a từ chối; UC09-4.1 công ty thao tác trên đơn đã hủy → 409', async () => {
  const user = makeUser('USER');
  const c = makeCompany();
  const a = (await call('POST', '', user.token, body(c))).body.request.id;
  const b = (await call('POST', '', user.token, body(c))).body.request.id;

  assert.equal((await call('POST', `/${a}/cancel`, user.token, { reason: ' ' })).body.error.details.field, 'reason');
  const cancelled = (await call('POST', `/${a}/cancel`, user.token, { reason: 'Đã tự sửa được' })).body.request;
  assert.deepEqual([cancelled.status, cancelled.cancelReason], ['Cancelled', 'Đã tự sửa được']);
  const late = await call('POST', `/${a}/accept`, c.token, { etaMinutes: 15 });
  assert.equal(late.status, 409);
  assert.match(late.body.error.message, /Đã hủy/);

  const rejected = (await call('POST', `/${b}/reject`, c.token, { reason: 'Hết xe' })).body.request;
  assert.deepEqual([rejected.status, rejected.rejectReason], ['Rejected', 'Hết xe']);
  assert.deepEqual((await call('GET', '', user.token)).body.items.map((x: any) => x.id), [b, a], 'mới nhất trước');
});

test('Phân quyền: người khác / công ty khác → 404; công ty chưa duyệt → 403; trạng thái lọc sai → 400', async () => {
  const user = makeUser('USER');
  const c = makeCompany();
  const { id } = (await call('POST', '', user.token, body(c))).body.request;
  const stranger = makeUser('USER');
  const otherCompany = makeCompany();

  assert.equal((await call('GET', `/${id}`, stranger.token)).status, 404);
  assert.equal((await call('POST', `/${id}/cancel`, stranger.token, { reason: 'x' })).status, 404);
  assert.equal((await call('GET', `/${id}`, otherCompany.token)).status, 404);
  assert.equal((await call('POST', `/${id}/accept`, otherCompany.token, { etaMinutes: 10 })).status, 404);
  assert.deepEqual((await call('GET', '', otherCompany.token)).body.items, []);
  assert.equal((await call('POST', `/${id}/accept`, user.token, { etaMinutes: 10 })).status, 403, 'USER không nhận đơn');
  assert.equal((await call('POST', `/${id}/cancel`, c.token, { reason: 'x' })).status, 403, 'COMPANY không hủy thay khách');
  assert.equal((await call('GET', '', makeCompany('Pending').token)).body.error.code, 'COMPANY_NOT_APPROVED');
  assert.equal((await call('GET', '', makeUser('ADMIN').token)).status, 403);
  assert.equal((await call('GET', '?status=Done', user.token)).body.error.details.field, 'status');
  assert.equal((await call('GET', '/abc', user.token)).status, 404);
});
