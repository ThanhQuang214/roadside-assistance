// Xác thực JWT + phân quyền theo vai trò (api-contract.md §1.2). Module khác import để bảo vệ route:
//   router.get('/x', ...requireRole('USER'), handler)    → getAuth(res).userId
//   router.get('/y', ...requireApprovedCompany, handler) → res.locals.companyId
import type { RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../shared/db.ts';
import { HttpError } from '../shared/http.ts';
import type { Role } from './auth-validation.ts';

// shortcut: secret mặc định chỉ dùng khi dev; chạy thật phải đặt biến môi trường JWT_SECRET.
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-doi-khi-deploy';

export type AuthPayload = { userId: number; role: Role };

export function signToken(userId: number, role: Role): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

/** Thông tin người đăng nhập, có sau requireAuth / requireRole. */
export const getAuth = (res: Response): AuthPayload => res.locals.auth;

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.');
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  }
  res.locals.auth = { userId: Number(payload.sub), role: payload.role } satisfies AuthPayload;
  next();
};

/** Chỉ cho các vai trò được liệt kê; sai vai trò → 403 FORBIDDEN. */
export function requireRole(...roles: Role[]): RequestHandler[] {
  return [requireAuth, (_req, res, next) => {
    if (!roles.includes(getAuth(res).role)) throw new HttpError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
    next();
  }];
}

/** Chạy sau requireAuth: nếu là COMPANY thì phải đã được duyệt (gán res.locals.companyId); vai trò khác cho qua. */
export const checkApprovedCompany: RequestHandler = (_req, res, next) => {
  if (getAuth(res).role !== 'COMPANY') return next();
  const row = getDb().prepare('SELECT id, approval_status AS status FROM rescue_companies WHERE user_id = ?')
    .get(getAuth(res).userId) as { id: number; status: string } | undefined;
  if (row?.status !== 'Approved') throw new HttpError(403, 'COMPANY_NOT_APPROVED', 'Hồ sơ công ty chưa được duyệt.');
  res.locals.companyId = row.id;
  next();
};

/** COMPANY đã được Admin duyệt; gán res.locals.companyId. Chưa duyệt → 403 COMPANY_NOT_APPROVED. */
export const requireApprovedCompany: RequestHandler[] = [...requireRole('COMPANY'), checkApprovedCompany];
