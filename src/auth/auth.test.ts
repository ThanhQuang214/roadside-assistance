import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { errorHandler } from '../shared/http.ts';
import { getDb } from '../shared/db.ts';
import { authRouter } from './auth.api.ts';
import { requireApprovedCompany, requireRole } from './auth-middleware.ts';

process.env.DB_PATH = ':memory:'; // getDb() mở lười ở request đầu tiên → dùng DB trong RAM

const app = express();
app.use(express.json());
app.use('/api', authRouter);
app.get('/api/only-user', ...requireRole('USER'), (_req, res) => { res.json({ ok: true }); });
app.get('/api/only-approved-company', ...requireApprovedCompany, (_req, res) => { res.json({ companyId: res.locals.companyId }); });
app.use(errorHandler);
const server = app.listen(0);
after(() => server.close());
const base = () => `http://localhost:${(server.address() as AddressInfo).port}/api`;

async function call(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(base() + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() as any };
}

const userBody = { role: 'USER', email: 'An@Example.com', password: 'matkhau123', fullName: 'Nguyễn Văn An', phone: '0912345678' };
const companyBody = {
  role: 'COMPANY', email: 'cuuho@example.com', password: 'matkhau123', fullName: 'Trần Bình', phone: '0987654321',
  company: { name: 'Cứu hộ Hà Nội', phone: '0241234567', address: '1 Giải Phóng', licenseNumber: 'GP-01',
    licenseFileUrl: '/api/uploads/x.pdf', stationLat: 21.0, stationLng: 105.8, serviceRadiusKm: 15 },
};

test('đăng ký USER → đăng nhập → /auth/me, không lộ passwordHash', async () => {
  const reg = await call('POST', '/auth/register', userBody);
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.email, 'an@example.com');
  assert.equal(reg.body.user.passwordHash, undefined);

  const login = await call('POST', '/auth/login', { email: 'an@example.com', password: 'matkhau123' });
  assert.equal(login.status, 200);
  const me = await call('GET', '/auth/me', undefined, login.body.token);
  assert.deepEqual([me.status, me.body.user.role, me.body.company], [200, 'USER', undefined]);
});

test('lỗi đăng ký: trùng email 409, sai trường 400 kèm details.field, không cho tự tạo ADMIN', async () => {
  assert.equal((await call('POST', '/auth/register', userBody)).status, 409);
  const bad = await call('POST', '/auth/register', { ...userBody, email: 'b@x.vn', phone: '123' });
  assert.deepEqual([bad.status, bad.body.error.details.field], [400, 'phone']);
  assert.equal((await call('POST', '/auth/register', { ...userBody, email: 'c@x.vn', role: 'ADMIN' })).status, 400);
  const noLicense = await call('POST', '/auth/register', { ...companyBody, company: { ...companyBody.company, licenseFileUrl: '' } });
  assert.equal(noLicense.body.error.details.field, 'company.licenseFileUrl');
});

test('sai mật khẩu / thiếu token → 401', async () => {
  assert.equal((await call('POST', '/auth/login', { email: 'an@example.com', password: 'sai-mat-khau' })).status, 401);
  assert.equal((await call('POST', '/auth/login', {})).status, 401);
  assert.equal((await call('GET', '/auth/me')).status, 401);
  assert.equal((await call('GET', '/auth/me', undefined, 'token-gia')).status, 401);
});

test('COMPANY: tạo hồ sơ Pending, sai vai trò 403, chưa duyệt 403 COMPANY_NOT_APPROVED, duyệt xong thì qua', async () => {
  assert.equal((await call('POST', '/auth/register', companyBody)).status, 201);
  const { token } = (await call('POST', '/auth/login', { email: companyBody.email, password: 'matkhau123' })).body;
  const me = await call('GET', '/auth/me', undefined, token);
  assert.equal(me.body.company.approvalStatus, 'Pending');

  assert.equal((await call('GET', '/only-user', undefined, token)).body.error.code, 'FORBIDDEN');
  assert.equal((await call('GET', '/only-approved-company', undefined, token)).body.error.code, 'COMPANY_NOT_APPROVED');
  getDb().prepare(`UPDATE rescue_companies SET approval_status = 'Approved'`).run();
  assert.deepEqual(await call('GET', '/only-approved-company', undefined, token), { status: 200, body: { companyId: me.body.company.id } });
});

test('upload: nhận PNG, từ chối loại file khác', async () => {
  const send = (type: string, name: string) => {
    const fd = new FormData();
    fd.append('file', new Blob(['abc'], { type }), name);
    return fetch(base() + '/uploads', { method: 'POST', body: fd });
  };
  const ok = await send('image/png', 'a.html');
  const { url } = await ok.json() as any;
  assert.equal(ok.status, 201);
  assert.match(url, /^\/api\/uploads\/[\w-]+\.png$/);
  assert.equal((await fetch(`http://localhost:${(server.address() as AddressInfo).port}${url}`)).status, 200);
  assert.equal((await send('text/html', 'x.html')).status, 400);
});
