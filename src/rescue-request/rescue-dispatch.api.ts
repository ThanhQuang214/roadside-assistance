// RescueDispatchController – UC09 Tiếp nhận và điều phối cứu hộ (M3) – api-contract.md §2, §3.4. Mount tại '/api/rescue-requests'.
// Đọc danh sách/chi tiết dùng chung GET trong rescue-request.api.ts. Mọi đổi trạng thái đi qua transition() (State Pattern).
import type { DatabaseSync } from 'node:sqlite';
import { Router } from 'express';
import { getDb } from '../shared/db.ts';
import { InvalidTransitionError } from '../shared/state/rescue-request-state.ts';
import { loadRescueRequest } from '../shared/state/rescue-request-store.ts';
import { requireApprovedCompany } from '../auth/auth-middleware.ts';
import { check, findRequest, transition } from './rescue-store.ts';
import { validateEta, validatePayment, validateReason } from './rescue-validation.ts';

export const dispatchRouter = Router();

function upsertPayment(db: DatabaseSync, requestId: number, p: { amount: unknown; method: string; note?: string | null }) {
  db.prepare(`INSERT INTO payment_records (request_id, amount, method, note) VALUES (?, ?, ?, ?)
    ON CONFLICT (request_id) DO UPDATE SET amount = excluded.amount, method = excluded.method, note = excluded.note,
      recorded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
    .run(requestId, Number(p.amount), p.method, p.note?.trim() || null);
}

// Bước 3–4: nhận đơn kèm ETA (ETA sai → 400 tại ô ETA, UC09-4.2; người dùng vừa hủy → 409, UC09-4.1).
dispatchRouter.post('/:id/accept', ...requireApprovedCompany, (req, res) => {
  check(validateEta(req.body?.etaMinutes));
  res.json({ request: transition(res, Number(req.params.id), 'accept', (ctx) => ctx.accept(Number(req.body.etaMinutes))) });
});

// 3a: từ chối kèm lý do.
dispatchRouter.post('/:id/reject', ...requireApprovedCompany, (req, res) => {
  check(validateReason(req.body?.reason));
  res.json({ request: transition(res, Number(req.params.id), 'reject', (ctx) => ctx.reject(req.body.reason.trim())) });
});

// Bước 5: bắt đầu triển khai cứu hộ.
dispatchRouter.post('/:id/start', ...requireApprovedCompany, (req, res) => {
  res.json({ request: transition(res, Number(req.params.id), 'start', (ctx) => ctx.start()) });
});

// 5a: cập nhật ETA khi Accepted / InProgress.
dispatchRouter.patch('/:id/eta', ...requireApprovedCompany, (req, res) => {
  check(validateEta(req.body?.etaMinutes));
  res.json({ request: transition(res, Number(req.params.id), 'updateEta', (ctx) => ctx.updateEta(Number(req.body.etaMinutes))) });
});

// Bước 6–7: hoàn tất, ghi thanh toán trong cùng transaction nếu có (6a: có thể ghi sau qua PUT /payment).
dispatchRouter.post('/:id/complete', ...requireApprovedCompany, (req, res) => {
  const payment = req.body?.payment;
  if (payment != null) check(validatePayment(payment));
  const requestId = Number(req.params.id);
  res.json({ request: transition(res, requestId, 'complete', (ctx) => ctx.complete(),
    payment == null ? undefined : (db) => upsertPayment(db, requestId, payment)) });
});

// 6a: ghi/sửa thanh toán – chỉ khi Completed (canRecordPayment), trạng thái khác → 409.
dispatchRouter.put('/:id/payment', ...requireApprovedCompany, (req, res) => {
  const requestId = Number(req.params.id);
  findRequest(res, requestId);
  check(validatePayment(req.body));
  const db = getDb();
  const ctx = loadRescueRequest(db, requestId)!;
  if (!ctx.canRecordPayment()) throw new InvalidTransitionError(ctx.status, 'recordPayment');
  upsertPayment(db, requestId, req.body);
  res.json({ request: findRequest(res, requestId) });
});
