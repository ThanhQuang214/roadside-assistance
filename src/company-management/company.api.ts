// UC08 Quản lý thông tin & dịch vụ cứu hộ (CompanyManagementController) – api-contract.md §3.5. Mount tại '/api/companies'.
import { Router, type Response } from 'express';
import { getDb } from '../shared/db.ts';
import { HttpError } from '../shared/http.ts';
import { getAuth, requireApprovedCompany, requireRole } from '../auth/auth-middleware.ts';
import type { FieldError } from '../auth/auth-validation.ts';
import { findCompanyById, findCompanyByUserId } from './company-store.ts';
import { validateCompanyProfile, validateService, validateVehicle } from './company-validation.ts';

export const companyRouter = Router();

const check = (e: FieldError | null) => {
  if (e) throw new HttpError(400, 'VALIDATION_ERROR', e.message, { field: e.field });
};
const companyId = (res: Response): number => res.locals.companyId;
const optText = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// ---------- Hồ sơ & phạm vi hoạt động (UC08-3c) ----------

// Công ty chưa duyệt vẫn được xem hồ sơ của mình (api-contract §1.2).
companyRouter.get('/me', ...requireRole('COMPANY'), (_req, res) => {
  const company = findCompanyByUserId(getDb(), getAuth(res).userId);
  if (!company) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ công ty');
  res.json({ company });
});

companyRouter.put('/me', ...requireApprovedCompany, (req, res) => {
  const b = req.body;
  check(validateCompanyProfile(b));
  const db = getDb();
  db.prepare(`UPDATE rescue_companies SET name = ?, phone = ?, address = ?, station_lat = ?, station_lng = ?, service_radius_km = ?
              WHERE id = ?`).run(b.name.trim(), b.phone.trim(), b.address.trim(),
    Number(b.stationLat), Number(b.stationLng), Number(b.serviceRadiusKm), companyId(res));
  res.json({ company: findCompanyById(db, companyId(res)) });
});

// ---------- Gói dịch vụ & giá (UC08-3a) ----------

const SERVICE_SELECT = `
  SELECT s.id, t.code AS serviceTypeCode, s.name, s.description, s.base_price AS basePrice, s.is_active AS isActive
  FROM rescue_services s JOIN service_types t ON t.id = s.service_type_id`;
const toService = (row: any) => row && { ...row, isActive: row.isActive === 1 };

/** Gói thuộc công ty đang đăng nhập; không thuộc → 404 (không lộ sự tồn tại). */
function ownService(res: Response, id: number) {
  const row = getDb().prepare(`${SERVICE_SELECT} WHERE s.id = ? AND s.company_id = ?`).get(id, companyId(res));
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy gói dịch vụ');
  return toService(row);
}

companyRouter.get('/me/services', ...requireApprovedCompany, (_req, res) => {
  const rows = getDb().prepare(`${SERVICE_SELECT} WHERE s.company_id = ? ORDER BY s.is_active DESC, s.id`).all(companyId(res));
  res.json({ items: rows.map(toService) });
});

companyRouter.post('/me/services', ...requireApprovedCompany, (req, res) => {
  const b = req.body;
  check(validateService(b, 'create'));
  const db = getDb();
  const type = db.prepare('SELECT id FROM service_types WHERE code = ?').get(b.serviceTypeCode) as { id: number } | undefined;
  if (!type) check({ field: 'serviceTypeCode', message: 'Loại dịch vụ không hợp lệ.' });
  const id = db.prepare('INSERT INTO rescue_services (company_id, service_type_id, name, description, base_price) VALUES (?, ?, ?, ?, ?)')
    .run(companyId(res), type!.id, b.name.trim(), optText(b.description), Number(b.basePrice)).lastInsertRowid;
  res.status(201).json({ service: ownService(res, Number(id)) });
});

companyRouter.put('/me/services/:id', ...requireApprovedCompany, (req, res) => {
  const b = req.body;
  ownService(res, Number(req.params.id));
  check(validateService(b, 'update'));
  getDb().prepare('UPDATE rescue_services SET name = ?, description = ?, base_price = ?, is_active = ? WHERE id = ?')
    .run(b.name.trim(), optText(b.description), Number(b.basePrice), b.isActive ? 1 : 0, Number(req.params.id));
  res.json({ service: ownService(res, Number(req.params.id)) });
});

companyRouter.delete('/me/services/:id', ...requireApprovedCompany, (req, res) => {
  ownService(res, Number(req.params.id));
  const db = getDb();
  // UC08-5.2: đã có đơn dùng gói này → không xóa cứng, gợi ý ngừng cung cấp.
  if (db.prepare('SELECT 1 FROM rescue_requests WHERE service_id = ? LIMIT 1').get(Number(req.params.id))) {
    throw new HttpError(409, 'CONFLICT', 'Gói dịch vụ đã có đơn cứu hộ nên không thể xóa. Hãy chuyển sang "Ngừng cung cấp".');
  }
  db.prepare('DELETE FROM rescue_services WHERE id = ?').run(Number(req.params.id));
  res.status(204).end();
});

// ---------- Phương tiện cứu hộ (UC08-3b) ----------

const VEHICLE_SELECT = 'SELECT id, kind, plate_number AS plateNumber, status FROM rescue_vehicles';
const plate = (v: string) => v.trim().toUpperCase();

function assertPlateFree(res: Response, plateNumber: string, exceptId = 0) {
  if (getDb().prepare('SELECT 1 FROM rescue_vehicles WHERE company_id = ? AND plate_number = ? AND id <> ?').get(companyId(res), plateNumber, exceptId)) {
    throw new HttpError(409, 'CONFLICT', 'Biển số này đã có trong danh sách phương tiện.', { field: 'plateNumber' });
  }
}

companyRouter.get('/me/vehicles', ...requireApprovedCompany, (_req, res) => {
  res.json({ items: getDb().prepare(`${VEHICLE_SELECT} WHERE company_id = ? ORDER BY id`).all(companyId(res)) });
});

companyRouter.post('/me/vehicles', ...requireApprovedCompany, (req, res) => {
  const b = req.body;
  check(validateVehicle(b, 'create'));
  assertPlateFree(res, plate(b.plateNumber));
  const db = getDb();
  const id = db.prepare('INSERT INTO rescue_vehicles (company_id, kind, plate_number, status) VALUES (?, ?, ?, ?)')
    .run(companyId(res), b.kind.trim(), plate(b.plateNumber), b.status ?? 'Available').lastInsertRowid;
  res.status(201).json({ vehicle: db.prepare(`${VEHICLE_SELECT} WHERE id = ?`).get(id) });
});

companyRouter.put('/me/vehicles/:id', ...requireApprovedCompany, (req, res) => {
  const b = req.body;
  const id = Number(req.params.id);
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM rescue_vehicles WHERE id = ? AND company_id = ?').get(id, companyId(res))) {
    throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy phương tiện');
  }
  check(validateVehicle(b, 'update'));
  assertPlateFree(res, plate(b.plateNumber), id);
  db.prepare('UPDATE rescue_vehicles SET kind = ?, plate_number = ?, status = ? WHERE id = ?').run(b.kind.trim(), plate(b.plateNumber), b.status, id);
  res.json({ vehicle: db.prepare(`${VEHICLE_SELECT} WHERE id = ?`).get(id) });
});
