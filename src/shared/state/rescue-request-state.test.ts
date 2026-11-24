import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.ts';
import { InvalidTransitionError, RESCUE_STATUSES, RescueRequestContext, type RescueStatus } from './rescue-request-state.ts';
import { loadRescueRequest, saveRescueRequest } from './rescue-request-store.ts';

const ctxAt = (status: RescueStatus) => new RescueRequestContext({
  id: 1, status, etaMinutes: null, cancelReason: null, rejectReason: null,
  acceptedAt: null, startedAt: null, completedAt: null, cancelledAt: null, rejectedAt: null,
});

const ACTIONS = {
  accept: (c: RescueRequestContext) => c.accept(15),
  reject: (c: RescueRequestContext) => c.reject('Hết xe'),
  cancel: (c: RescueRequestContext) => c.cancel('Đã tự sửa được'),
  start: (c: RescueRequestContext) => c.start(),
  complete: (c: RescueRequestContext) => c.complete(),
  updateEta: (c: RescueRequestContext) => c.updateEta(20),
};

// Bảng chuyển trạng thái hợp lệ – phải khớp api-contract.md §2.
const ALLOWED: Record<RescueStatus, Partial<Record<keyof typeof ACTIONS, RescueStatus>>> = {
  Pending: { accept: 'Accepted', reject: 'Rejected', cancel: 'Cancelled' },
  Accepted: { start: 'InProgress', updateEta: 'Accepted' },
  InProgress: { complete: 'Completed', updateEta: 'InProgress' },
  Completed: {},
  Cancelled: {},
  Rejected: {},
};

test('mọi cặp (trạng thái, hành động) đúng bảng chuyển trạng thái', () => {
  for (const status of RESCUE_STATUSES) {
    for (const [action, run] of Object.entries(ACTIONS)) {
      const ctx = ctxAt(status);
      const expected = ALLOWED[status][action as keyof typeof ACTIONS];
      if (expected) {
        run(ctx);
        assert.equal(ctx.status, expected, `${status}.${action}`);
        assert.equal(ctx.data.status, expected);
      } else {
        assert.throws(() => run(ctx), InvalidTransitionError, `${status}.${action} phải bị chặn`);
        assert.equal(ctx.status, status, 'bị chặn thì không đổi trạng thái');
      }
    }
  }
});

test('luồng chính ghi đủ ETA, lý do và mốc thời gian', () => {
  const ctx = ctxAt('Pending');
  ctx.accept(15);
  ctx.updateEta(25);
  ctx.start();
  ctx.complete();
  assert.equal(ctx.data.etaMinutes, 25);
  assert.ok(ctx.data.acceptedAt && ctx.data.startedAt && ctx.data.completedAt);
  assert.equal(ctx.canRecordPayment(), true);
  assert.equal(ctx.canReview(), true);

  const cancelled = ctxAt('Pending');
  cancelled.cancel('Đã tự sửa được');
  assert.equal(cancelled.data.cancelReason, 'Đã tự sửa được');
  assert.ok(cancelled.data.cancelledAt);
  assert.equal(cancelled.canReview(), false);
});

test('không sửa object dữ liệu truyền vào constructor', () => {
  const data = ctxAt('Pending').data;
  new RescueRequestContext(data).accept(10);
  assert.equal(data.status, 'Pending');
});

test('trạng thái lạ từ DB bị từ chối', () => {
  assert.throws(() => ctxAt('Done' as RescueStatus));
});

test('DB: hủy và nhận cùng lúc – chỉ một bên thắng (UC05-4.1, UC09-4.1)', () => {
  const db = openDb(':memory:');
  db.exec(`
    INSERT INTO users (id, email, phone, password_hash, full_name, role) VALUES
      (1, 'u@test.vn', '0900000001', 'x', 'Người dùng', 'USER'),
      (2, 'c@test.vn', '0900000002', 'x', 'Công ty', 'COMPANY');
    INSERT INTO rescue_companies (id, user_id, name, phone, address, license_number, license_file_url,
      station_lat, station_lng, service_radius_km, approval_status)
      VALUES (1, 2, 'Cứu hộ A', '0900000002', 'Hà Nội', 'GP-01', '/f.pdf', 21.0, 105.8, 20, 'Approved');
    INSERT INTO rescue_services (id, company_id, service_type_id, name, base_price) VALUES (1, 1, 2, 'Vá lốp', 150000);
    INSERT INTO rescue_requests (id, user_id, company_id, service_id, vehicle_type_id, lat, lng, description, contact_phone)
      VALUES (1, 1, 1, 1, 1, 21.01, 105.81, 'Xe bị thủng lốp trước', '0900000001');
  `);

  const userSide = loadRescueRequest(db, 1)!;
  const companySide = loadRescueRequest(db, 1)!;

  companySide.accept(15);
  assert.equal(saveRescueRequest(db, companySide, 'Pending'), true);

  userSide.cancel('Đã tự sửa được'); // bản trong bộ nhớ vẫn là Pending nên state cho phép
  assert.equal(saveRescueRequest(db, userSide, 'Pending'), false, 'DB đã Accepted → phải thua');

  const fresh = loadRescueRequest(db, 1)!;
  assert.equal(fresh.status, 'Accepted');
  assert.equal(fresh.data.etaMinutes, 15);
  assert.equal(fresh.data.cancelReason, null);
  assert.throws(() => fresh.cancel('x'), InvalidTransitionError);
  assert.equal(loadRescueRequest(db, 999), null);
});
