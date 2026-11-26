// UC10 Thẩm định đơn vị cứu hộ (AdminApprovalController) – api-contract.md §3.6. Mount tại '/api/admin'.
import { Router } from 'express';
import { getDb } from '../shared/db.ts';
import { HttpError } from '../shared/http.ts';
import { requireRole } from '../auth/auth-middleware.ts';
import { COMPANY_SELECT, findCompanyById } from './company-store.ts';

export const adminRouter = Router();
adminRouter.use(...requireRole('ADMIN'));

const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'];

// UC10 bước 2 + 2a: danh sách, lọc theo trạng thái, tìm theo tên / số giấy phép / mã hồ sơ.
adminRouter.get('/companies', (req, res) => {
  const { approvalStatus, q } = req.query;
  const where: string[] = [];
  const params: string[] = [];
  if (approvalStatus) {
    if (typeof approvalStatus !== 'string' || !APPROVAL_STATUSES.includes(approvalStatus)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Trạng thái lọc không hợp lệ.', { field: 'approvalStatus' });
    }
    where.push('approval_status = ?');
    params.push(approvalStatus);
  }
  if (typeof q === 'string' && q.trim()) {
    where.push('(name LIKE ? OR license_number LIKE ? OR CAST(id AS TEXT) = ?)');
    params.push(`%${q.trim()}%`, `%${q.trim()}%`, q.trim());
  }
  const sql = `${COMPANY_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC`;
  res.json({ items: getDb().prepare(sql).all(...params) });
});

adminRouter.get('/companies/:id', (req, res) => {
  const company = findCompanyById(getDb(), Number(req.params.id));
  if (!company) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ công ty');
  res.json({ company });
});

/** Chỉ đổi khi hồ sơ còn Pending (WHERE … = 'Pending') → hai Admin bấm cùng lúc thì người sau nhận 409 (UC10-6.1). */
function decide(id: number, setSql: string, params: (string | null)[]) {
  const db = getDb();
  const { changes } = db.prepare(`UPDATE rescue_companies SET ${setSql} WHERE id = ? AND approval_status = 'Pending'`).run(...params, id);
  if (changes === 0) {
    if (!findCompanyById(db, id)) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ công ty');
    throw new HttpError(409, 'CONFLICT', 'Hồ sơ đã được xử lý trước đó. Vui lòng tải lại.');
  }
  return findCompanyById(db, id);
}

adminRouter.post('/companies/:id/approve', (req, res) => {
  const company = decide(Number(req.params.id),
    `approval_status = 'Approved', approved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), reject_reason = NULL`, []);
  res.json({ company });
});

adminRouter.post('/companies/:id/reject', (req, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 1 || reason.length > 255) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Vui lòng nhập lý do từ chối (tối đa 255 ký tự).', { field: 'reason' });
  }
  res.json({ company: decide(Number(req.params.id), `approval_status = 'Rejected', reject_reason = ?`, [reason]) });
});
