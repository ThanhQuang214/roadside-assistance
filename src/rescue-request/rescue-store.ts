// Dùng chung phía Người gặp sự cố (M2) và Công ty (M3): đọc RescueRequest đúng dạng api-contract.md §3.4,
// giới hạn theo người đang đăng nhập, và chuyển trạng thái qua State Pattern (§2).
import type { DatabaseSync } from 'node:sqlite';
import type { RequestHandler, Response } from 'express';
import { getDb } from '../shared/db.ts';
import { HttpError } from '../shared/http.ts';
import { checkApprovedCompany, getAuth, requireRole } from '../auth/auth-middleware.ts';
import type { FieldError } from '../auth/auth-validation.ts';
import { InvalidTransitionError, type RescueAction, type RescueRequestContext, type RescueStatus } from '../shared/state/rescue-request-state.ts';
import { loadRescueRequest, saveRescueRequest } from '../shared/state/rescue-request-store.ts';
import type { Classification } from '../matching-ai/incident-types.ts';
import type { PAYMENT_METHODS } from './rescue-validation.ts';

export type Payment = { amount: number; method: (typeof PAYMENT_METHODS)[number]; note: string | null; recordedAt: string };
export type RescueRequest = {
  id: number; status: RescueStatus; createdAt: string; updatedAt: string;
  acceptedAt: string | null; startedAt: string | null; completedAt: string | null; cancelledAt: string | null; rejectedAt: string | null;
  lat: number; lng: number; address: string | null; description: string; contactPhone: string; photoUrl: string | null;
  vehicleType: { code: string; name: string };
  service: { id: number; name: string; serviceTypeCode: string };
  company: { id: number; name: string; phone: string; stationLat: number; stationLng: number };
  user: { id: number; fullName: string };
  distanceKm: number | null; estimatedPrice: number | null; etaMinutes: number | null; cancelReason: string | null; rejectReason: string | null;
  classification: Classification | null;
  payment: Payment | null;
  reviewed: boolean;
};

/** Lỗi validation → 400 kèm details.field để UI báo đúng ô. */
export const check = (e: FieldError | null) => {
  if (e) throw new HttpError(400, 'VALIDATION_ERROR', e.message, { field: e.field });
};

/** USER hoặc COMPANY đã duyệt (gán res.locals.companyId). */
export const requireRequestViewer: RequestHandler[] = [...requireRole('USER', 'COMPANY'), checkApprovedCompany];

const SELECT = `
  SELECT r.id, r.status, r.created_at AS createdAt, r.updated_at AS updatedAt, r.accepted_at AS acceptedAt, r.started_at AS startedAt,
         r.completed_at AS completedAt, r.cancelled_at AS cancelledAt, r.rejected_at AS rejectedAt,
         r.lat, r.lng, r.address, r.description, r.contact_phone AS contactPhone, r.photo_url AS photoUrl,
         vt.code AS vtCode, vt.name AS vtName, s.id AS sId, s.name AS sName, st.code AS sType,
         c.id AS cId, c.name AS cName, c.phone AS cPhone, c.station_lat AS cLat, c.station_lng AS cLng, u.id AS uId, u.full_name AS uName,
         r.distance_km AS distanceKm, r.estimated_price AS estimatedPrice, r.eta_minutes AS etaMinutes,
         r.cancel_reason AS cancelReason, r.reject_reason AS rejectReason,
         ic.incident_type AS icType, ic.urgency AS icUrgency, ic.confidence AS icConfidence, ic.source AS icSource,
         p.amount AS pAmount, p.method AS pMethod, p.note AS pNote, p.recorded_at AS pRecordedAt,
         EXISTS (SELECT 1 FROM reviews rv WHERE rv.request_id = r.id) AS reviewed
  FROM rescue_requests r
  JOIN vehicle_types vt ON vt.id = r.vehicle_type_id
  JOIN rescue_services s ON s.id = r.service_id
  JOIN service_types st ON st.id = s.service_type_id
  JOIN rescue_companies c ON c.id = r.company_id
  JOIN users u ON u.id = r.user_id
  LEFT JOIN incident_classifications ic ON ic.request_id = r.id
  LEFT JOIN payment_records p ON p.request_id = r.id`;

function toRequest(row: any): RescueRequest {
  const { vtCode, vtName, sId, sName, sType, cId, cName, cPhone, cLat, cLng, uId, uName,
    icType, icUrgency, icConfidence, icSource, pAmount, pMethod, pNote, pRecordedAt, reviewed, ...rest } = row;
  return {
    ...rest,
    vehicleType: { code: vtCode, name: vtName },
    service: { id: sId, name: sName, serviceTypeCode: sType },
    company: { id: cId, name: cName, phone: cPhone, stationLat: cLat, stationLng: cLng },
    user: { id: uId, fullName: uName },
    classification: icType ? { incidentType: icType, urgency: icUrgency, confidence: icConfidence, source: icSource } : null,
    payment: pMethod ? { amount: pAmount, method: pMethod, note: pNote, recordedAt: pRecordedAt } : null,
    reviewed: reviewed === 1,
  };
}

/** USER chỉ thấy đơn của mình, COMPANY chỉ thấy đơn giao cho mình (api-contract §1.2). */
const ownerFilter = (res: Response): [string, number] =>
  getAuth(res).role === 'COMPANY' ? ['r.company_id = ?', res.locals.companyId] : ['r.user_id = ?', getAuth(res).userId];

/** Đơn thuộc quyền người đang đăng nhập; không tồn tại hoặc của người khác → 404. */
export function findRequest(res: Response, id: number): RescueRequest {
  const [where, owner] = ownerFilter(res);
  const row = getDb().prepare(`${SELECT} WHERE r.id = ? AND ${where}`).get(id, owner);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu cứu hộ');
  return toRequest(row);
}

export function listRequests(res: Response, status?: RescueStatus): RescueRequest[] {
  const [where, owner] = ownerFilter(res);
  const rows = status
    ? getDb().prepare(`${SELECT} WHERE ${where} AND r.status = ? ORDER BY r.created_at DESC, r.id DESC`).all(owner, status)
    : getDb().prepare(`${SELECT} WHERE ${where} ORDER BY r.created_at DESC, r.id DESC`).all(owner);
  return rows.map(toRequest);
}

/**
 * Chuyển trạng thái theo đúng mẫu api-contract §2: load → gọi method của RescueRequestContext (sai trạng thái → 409)
 * → save có optimistic lock. `afterSave` chạy trong cùng transaction (vd. ghi thanh toán khi hoàn tất).
 */
export function transition(res: Response, id: number, action: RescueAction, apply: (ctx: RescueRequestContext) => void,
  afterSave?: (db: DatabaseSync) => void): RescueRequest {
  findRequest(res, id);
  const db = getDb();
  const ctx = loadRescueRequest(db, id)!;
  const expected = ctx.status;
  apply(ctx);
  db.exec('BEGIN');
  try {
    if (!saveRescueRequest(db, ctx, expected)) throw new InvalidTransitionError(loadRescueRequest(db, id)!.status, action);
    afterSave?.(db);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return findRequest(res, id);
}
