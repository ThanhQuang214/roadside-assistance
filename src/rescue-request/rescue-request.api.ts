// RescueRequestController – UC03 tạo đơn, UC04 theo dõi, UC05 hủy (M2) – api-contract.md §3.4. Mount tại '/api/rescue-requests'.
// Thao tác phía Công ty (UC09) ở rescue-dispatch.api.ts, mount cùng đường dẫn.
import { Router } from 'express';
import { getDb } from '../shared/db.ts';
import { HttpError } from '../shared/http.ts';
import { RESCUE_STATUSES, type RescueStatus } from '../shared/state/rescue-request-state.ts';
import { getAuth, requireRole } from '../auth/auth-middleware.ts';
import { haversineKm } from '../shared/strategy/eta-estimator.ts';
import { getEtaEstimator } from '../matching-ai/maps-subsystem.ts';
import { SUGGESTED_SERVICE_TYPE } from '../matching-ai/incident-types.ts';
import { check, findRequest, listRequests, requireRequestViewer, transition } from './rescue-store.ts';
import { validateCreateRequest, validateReason } from './rescue-validation.ts';

export const rescueRouter = Router();

const optText = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// UC03 bước 6–7: tạo đơn Pending gửi tới công ty đã chọn.
rescueRouter.post('/', ...requireRole('USER'), async (req, res) => {
  const b = req.body;
  check(validateCreateRequest(b));
  const db = getDb();
  const vehicleType = db.prepare('SELECT id FROM vehicle_types WHERE code = ?').get(b.vehicleTypeCode) as { id: number } | undefined;
  if (!vehicleType) check({ field: 'vehicleTypeCode', message: 'Loại phương tiện không hợp lệ.' });
  const svc = db.prepare(`
    SELECT s.base_price AS price, c.station_lat AS lat, c.station_lng AS lng, c.service_radius_km AS radiusKm
    FROM rescue_services s JOIN rescue_companies c ON c.id = s.company_id
    WHERE s.id = ? AND s.company_id = ? AND s.is_active = 1 AND c.approval_status = 'Approved'`)
    .get(Number(b.serviceId), Number(b.companyId)) as { price: number; lat: number; lng: number; radiusKm: number } | undefined;
  if (!svc) check({ field: 'serviceId', message: 'Công ty hoặc gói dịch vụ không còn khả dụng, vui lòng chọn lại.' });

  const incident = { lat: Number(b.lat), lng: Number(b.lng) };
  if (haversineKm(svc!, incident) > svc!.radiusKm) {
    check({ field: 'serviceId', message: 'Vị trí sự cố nằm ngoài phạm vi phục vụ của công ty, vui lòng chọn đơn vị khác.' });
  }

  // Server tự tính lại khoảng cách và giá, không tin số client gửi.
  const { distanceKm } = await getEtaEstimator().estimate(svc!, incident);
  const c = b.classification;
  db.exec('BEGIN');
  let id: number;
  try {
    id = Number(db.prepare(`INSERT INTO rescue_requests (user_id, company_id, service_id, vehicle_type_id, lat, lng, address,
        description, contact_phone, photo_url, distance_km, estimated_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      getAuth(res).userId, Number(b.companyId), Number(b.serviceId), vehicleType!.id, Number(b.lat), Number(b.lng), optText(b.address),
      b.description.trim(), b.contactPhone.trim(), b.photoUrl ?? null, distanceKm, svc!.price,
    ).lastInsertRowid);
    db.prepare(`INSERT INTO incident_classifications (request_id, incident_type, urgency, suggested_service_type_id, confidence, source)
      VALUES (?, ?, ?, (SELECT id FROM service_types WHERE code = ?), ?, ?)`)
      .run(id, c.incidentType, c.urgency, SUGGESTED_SERVICE_TYPE[c.incidentType as keyof typeof SUGGESTED_SERVICE_TYPE], c.confidence ?? null, c.source);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.status(201).json({ request: findRequest(res, id) });
});

// Danh sách: USER – đơn của mình (S01), COMPANY – đơn giao cho mình (C-02). Mới nhất trước.
rescueRouter.get('/', ...requireRequestViewer, (req, res) => {
  const status = req.query.status;
  if (status !== undefined && !RESCUE_STATUSES.includes(status as RescueStatus)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Trạng thái lọc không hợp lệ.', { field: 'status' });
  }
  res.json({ items: listRequests(res, status as RescueStatus | undefined) });
});

// UC04: client polling 5 giây/lần.
rescueRouter.get('/:id', ...requireRequestViewer, (req, res) => {
  res.json({ request: findRequest(res, Number(req.params.id)) });
});

// UC05: chỉ hủy được khi Pending – State Pattern chặn, công ty vừa nhận → 409 (UC05-4.1).
rescueRouter.post('/:id/cancel', ...requireRole('USER'), (req, res) => {
  check(validateReason(req.body?.reason));
  res.json({ request: transition(res, Number(req.params.id), 'cancel', (ctx) => ctx.cancel(req.body.reason.trim())) });
});
