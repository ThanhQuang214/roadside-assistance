import type { DatabaseSync } from 'node:sqlite';
import { RescueRequestContext, type RescueStatus } from './rescue-request-state.ts';

/** Đọc đơn thành RescueRequestContext; null nếu không tồn tại. */
export function loadRescueRequest(db: DatabaseSync, id: number): RescueRequestContext | null {
  const row = db.prepare(`
    SELECT id, status, eta_minutes AS etaMinutes, cancel_reason AS cancelReason, reject_reason AS rejectReason,
           accepted_at AS acceptedAt, started_at AS startedAt, completed_at AS completedAt,
           cancelled_at AS cancelledAt, rejected_at AS rejectedAt
    FROM rescue_requests WHERE id = ?`).get(id);
  return row ? new RescueRequestContext(row as never) : null;
}

/**
 * Lưu kết quả chuyển trạng thái. Chỉ ghi khi DB vẫn đang ở `expectedStatus` (optimistic lock),
 * nên nếu người dùng hủy và công ty nhận cùng lúc thì chỉ một bên thắng.
 * @returns false nếu trạng thái đã bị người khác đổi → controller trả 409 và client tải lại đơn.
 */
export function saveRescueRequest(db: DatabaseSync, ctx: RescueRequestContext, expectedStatus: RescueStatus): boolean {
  const d = ctx.data;
  const result = db.prepare(`
    UPDATE rescue_requests
    SET status = ?, eta_minutes = ?, cancel_reason = ?, reject_reason = ?,
        accepted_at = ?, started_at = ?, completed_at = ?, cancelled_at = ?, rejected_at = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? AND status = ?`).run(
    d.status, d.etaMinutes, d.cancelReason, d.rejectReason,
    d.acceptedAt, d.startedAt, d.completedAt, d.cancelledAt, d.rejectedAt,
    d.id, expectedStatus,
  );
  return result.changes === 1;
}
