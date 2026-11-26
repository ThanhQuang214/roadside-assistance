import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { errorHandler } from '../shared/http.ts';
import { getDb } from '../shared/db.ts';
import { signToken } from '../auth/auth-middleware.ts';
import type { Role } from '../auth/auth-validation.ts';
import { companyRouter } from './company.api.ts';
import { adminRouter } from './admin.api.ts';

process.env.DB_PATH = ':memory:'; // getDb() mở lười ở request đầu tiên → dùng DB trong RAM

const app = express();
app.use(express.json());
app.use('/api/companies', companyRouter);
app.use('/api/admin', adminRouter);
app.use(errorHandler);
const server = app.listen(0);
after(() => server.close());

async function call(method: string, path: string, token: string, body?: unknown) {
  const r = await fetch(`http://localhost:${(server.address() as AddressInfo).port}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: r.status === 204 ? null : await r.json() as any };
}

let seq = 0;
function makeUser(role: Role) {
  const db = getDb();
  const id = Number(db.prepare(`INSERT INTO users (email, phone, password_hash, full_name, role) VALUES (?, '0900000000', 'x', 'Test', ?)`)
    .run(`u${++seq}@test.vn`, role).lastInsertRowid);
  return { id, token: signToken(id, role) };
}
function makeCompany(name: string, status = 'Pending') {
  const u = makeUser('COMPANY');
  const companyId = Number(getDb().prepare(`INSERT INTO rescue_companies
    (user_id, name, phone, address, license_number, license_file_url, station_lat, station_lng, service_radius_km, approval_status)
    VALUES (?, ?, '0241234567', 'Hà Nội', ?, '/api/uploads/gp.pdf', 21, 105.8, 10, ?)`).run(u.id, name, `GP-${seq}`, status).lastInsertRowid);
  return { ...u, companyId };
}

const profile = { name: 'Cứu hộ Mới', phone: '0911111111', address: '2 Láng', stationLat: 21.02, stationLng: 105.85, serviceRadiusKm: 25 };

test('công ty chưa duyệt: chỉ xem được hồ sơ, API khác 403 COMPANY_NOT_APPROVED', async () => {
  const c = makeCompany('Chờ duyệt');
  const me = await call('GET', '/companies/me', c.token);
  assert.deepEqual([me.status, me.body.company.approvalStatus], [200, 'Pending']);
  assert.equal((await call('PUT', '/companies/me', c.token, profile)).body.error.code, 'COMPANY_NOT_APPROVED');
  assert.equal((await call('GET', '/companies/me/services', c.token)).body.error.code, 'COMPANY_NOT_APPROVED');
  assert.equal((await call('GET', '/companies/me', makeUser('USER').token)).body.error.code, 'FORBIDDEN');
});

test('UC08-3c: cập nhật hồ sơ & phạm vi; dữ liệu sai báo đúng trường', async () => {
  const c = makeCompany('Đã duyệt', 'Approved');
  const ok = await call('PUT', '/companies/me', c.token, profile);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.company.serviceRadiusKm, 25);
  assert.equal(ok.body.company.name, 'Cứu hộ Mới');
  const bad = await call('PUT', '/companies/me', c.token, { ...profile, serviceRadiusKm: 0 });
  assert.deepEqual([bad.status, bad.body.error.details.field], [400, 'serviceRadiusKm']);
});

test('UC08-3a: thêm/sửa/xóa gói dịch vụ; giá ≤ 0 bị từ chối; gói của công ty khác → 404', async () => {
  const c = makeCompany('A', 'Approved');
  const other = makeCompany('B', 'Approved');
  const svc = { serviceTypeCode: 'TIRE', name: 'Vá lốp xe máy', basePrice: 50000 };

  assert.equal((await call('POST', '/companies/me/services', c.token, { ...svc, basePrice: 0 })).body.error.details.field, 'basePrice');
  assert.equal((await call('POST', '/companies/me/services', c.token, { ...svc, serviceTypeCode: 'XXX' })).body.error.details.field, 'serviceTypeCode');
  const created = await call('POST', '/companies/me/services', c.token, svc);
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.service, { id: created.body.service.id, serviceTypeCode: 'TIRE', name: 'Vá lốp xe máy', description: null, basePrice: 50000, isActive: true });
  const id = created.body.service.id;

  const updated = await call('PUT', `/companies/me/services/${id}`, c.token, { name: 'Vá lốp', basePrice: 60000, isActive: false });
  assert.deepEqual([updated.body.service.basePrice, updated.body.service.isActive], [60000, false]);
  assert.equal((await call('PUT', `/companies/me/services/${id}`, other.token, { name: 'x', basePrice: 1, isActive: true })).status, 404);
  assert.equal((await call('DELETE', `/companies/me/services/${id}`, other.token)).status, 404);
  assert.equal((await call('GET', '/companies/me/services', other.token)).body.items.length, 0);

  assert.equal((await call('DELETE', `/companies/me/services/${id}`, c.token)).status, 204);
  assert.equal((await call('GET', '/companies/me/services', c.token)).body.items.length, 0);
});

test('UC08-5.2: gói đã có đơn cứu hộ → 409 CONFLICT, không xóa', async () => {
  const c = makeCompany('C', 'Approved');
  const user = makeUser('USER');
  const { id } = (await call('POST', '/companies/me/services', c.token, { serviceTypeCode: 'TOWING', name: 'Kéo xe', basePrice: 300000 })).body.service;
  getDb().prepare(`INSERT INTO rescue_requests (user_id, company_id, service_id, vehicle_type_id, lat, lng, description, contact_phone)
    VALUES (?, ?, ?, 1, 21, 105.8, 'Xe chết máy giữa đường', '0912345678')`).run(user.id, c.companyId, id);
  const del = await call('DELETE', `/companies/me/services/${id}`, c.token);
  assert.equal(del.body.error.code, 'CONFLICT');
  assert.equal((await call('GET', '/companies/me/services', c.token)).body.items.length, 1);
});

test('UC08-3b: phương tiện – thêm (mặc định Available), trùng biển số 409, cập nhật trạng thái', async () => {
  const c = makeCompany('D', 'Approved');
  const v = await call('POST', '/companies/me/vehicles', c.token, { kind: 'Xe cẩu kéo 3.5T', plateNumber: ' 29c-123.45 ' });
  assert.deepEqual([v.status, v.body.vehicle.plateNumber, v.body.vehicle.status], [201, '29C-123.45', 'Available']);
  assert.equal((await call('POST', '/companies/me/vehicles', c.token, { kind: 'Xe khác', plateNumber: '29C-123.45' })).status, 409);
  // Công ty khác được dùng cùng biển số (UNIQUE theo công ty), nhưng không sửa được xe của công ty này.
  const other = makeCompany('E', 'Approved');
  assert.equal((await call('POST', '/companies/me/vehicles', other.token, { kind: 'Xe', plateNumber: '29C-123.45' })).status, 201);
  assert.equal((await call('PUT', `/companies/me/vehicles/${v.body.vehicle.id}`, other.token, { kind: 'X', plateNumber: 'Y', status: 'Busy' })).status, 404);

  const upd = await call('PUT', `/companies/me/vehicles/${v.body.vehicle.id}`, c.token, { kind: 'Xe cẩu kéo 3.5T', plateNumber: '29C-123.45', status: 'Maintenance' });
  assert.equal(upd.body.vehicle.status, 'Maintenance');
  assert.equal((await call('PUT', `/companies/me/vehicles/${v.body.vehicle.id}`, c.token, { kind: 'X', plateNumber: 'Y', status: 'Lost' })).body.error.details.field, 'status');
  assert.equal((await call('GET', '/companies/me/vehicles', c.token)).body.items.length, 1);
});

test('UC10: chỉ ADMIN; lọc, tìm kiếm; duyệt; từ chối cần lý do; xử lý lần 2 → 409', async () => {
  const admin = makeUser('ADMIN');
  const p1 = makeCompany('Cứu hộ Sài Gòn');
  const p2 = makeCompany('Cứu hộ Đà Nẵng');
  assert.equal((await call('GET', '/admin/companies', p1.token)).body.error.code, 'FORBIDDEN');

  const pending = (await call('GET', '/admin/companies?approvalStatus=Pending', admin.token)).body.items;
  assert.ok(pending.some((c: any) => c.id === p1.companyId) && pending.every((c: any) => c.approvalStatus === 'Pending'));
  assert.deepEqual((await call('GET', '/admin/companies?q=Sài Gòn', admin.token)).body.items.map((c: any) => c.id), [p1.companyId]);
  assert.ok((await call('GET', `/admin/companies?q=${p2.companyId}`, admin.token)).body.items.some((c: any) => c.id === p2.companyId)); // tìm theo mã hồ sơ
  assert.equal((await call('GET', '/admin/companies?approvalStatus=Xyz', admin.token)).status, 400);
  assert.equal((await call('GET', '/admin/companies/99999', admin.token)).status, 404);

  const ok = await call('POST', `/admin/companies/${p1.companyId}/approve`, admin.token);
  assert.equal(ok.body.company.approvalStatus, 'Approved');
  assert.ok(ok.body.company.approvedAt);
  assert.equal((await call('POST', `/admin/companies/${p1.companyId}/approve`, admin.token)).status, 409);
  assert.equal((await call('GET', '/companies/me/services', p1.token)).status, 200); // duyệt xong là dùng được UC08

  assert.equal((await call('POST', `/admin/companies/${p2.companyId}/reject`, admin.token, { reason: '  ' })).body.error.details.field, 'reason');
  const rej = await call('POST', `/admin/companies/${p2.companyId}/reject`, admin.token, { reason: 'Giấy phép hết hạn' });
  assert.deepEqual([rej.body.company.approvalStatus, rej.body.company.rejectReason], ['Rejected', 'Giấy phép hết hạn']);
  assert.equal((await call('POST', `/admin/companies/${p2.companyId}/approve`, admin.token)).status, 409);
});
