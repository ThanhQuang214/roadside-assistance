// UC01 Đăng ký, UC02 Đăng nhập, xem tài khoản, upload file – api-contract.md §3.2. Mount tại '/api' trong server.ts.
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { getDb } from '../shared/db.ts';
import { findCompanyByUserId } from '../company-management/company-store.ts';
import { HttpError } from '../shared/http.ts';
import { getAuth, requireAuth, signToken } from './auth-middleware.ts';
import { validateRegister } from './auth-validation.ts';

export const authRouter = Router();

const findUser = (db: DatabaseSync, id: number) => db.prepare(`
  SELECT id, email, phone, full_name AS fullName, role, created_at AS createdAt FROM users WHERE id = ?`).get(id);

authRouter.post('/auth/register', async (req, res) => {
  const err = validateRegister(req.body);
  if (err) throw new HttpError(400, 'VALIDATION_ERROR', err.message, { field: err.field });
  const b = req.body;
  const email = b.email.trim().toLowerCase();
  const db = getDb();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'CONFLICT', 'Email đã được sử dụng.', { field: 'email' });
  }
  const hash = await bcrypt.hash(b.password, 10);

  db.exec('BEGIN');
  try {
    const userId = Number(db.prepare('INSERT INTO users (email, phone, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)')
      .run(email, b.phone.trim(), hash, b.fullName.trim(), b.role).lastInsertRowid);
    if (b.role === 'COMPANY') {
      const c = b.company;
      db.prepare(`INSERT INTO rescue_companies
        (user_id, name, phone, address, license_number, license_file_url, station_lat, station_lng, service_radius_km)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        userId, c.name.trim(), c.phone.trim(), c.address.trim(), c.licenseNumber.trim(), c.licenseFileUrl.trim(),
        Number(c.stationLat), Number(c.stationLng), Number(c.serviceRadiusKm),
      );
    }
    db.exec('COMMIT');
    res.status(201).json({ user: findUser(db, userId) });
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
});

authRouter.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const db = getDb();
  const row = typeof email === 'string'
    ? db.prepare('SELECT id, role, password_hash AS hash FROM users WHERE email = ?').get(email.trim().toLowerCase()) as
      { id: number; role: 'USER' | 'COMPANY' | 'ADMIN'; hash: string } | undefined
    : undefined;
  if (!row || typeof password !== 'string' || !(await bcrypt.compare(password, row.hash))) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Email hoặc mật khẩu không đúng.');
  }
  res.json({ token: signToken(row.id, row.role), user: findUser(db, row.id) });
});

authRouter.get('/auth/me', requireAuth, (_req, res) => {
  const { userId } = getAuth(res);
  const db = getDb();
  const user = findUser(db, userId);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Tài khoản không còn tồn tại.');
  const company = findCompanyByUserId(db, userId);
  res.json(company ? { user, company } : { user });
});

// ---------- Upload ảnh / giấy phép (≤ 5 MB) ----------
const UPLOAD_DIR = 'data/uploads';
// Đuôi file lấy theo MIME (không theo tên gốc) để không ai upload được .html chạy trên cùng origin.
const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_req, f, cb) => cb(null, randomUUID() + EXT[f.mimetype]) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => cb(null, f.mimetype in EXT),
});

authRouter.post('/uploads', (req, res, next) => upload.single('file')(req, res, (err: unknown) => {
  if (err instanceof multer.MulterError) return next(new HttpError(400, 'VALIDATION_ERROR', 'File phải nhỏ hơn 5MB.', { field: 'file' }));
  if (err) return next(err);
  if (!req.file) return next(new HttpError(400, 'VALIDATION_ERROR', 'File phải là JPG, PNG, WebP hoặc PDF và nhỏ hơn 5MB.', { field: 'file' }));
  res.status(201).json({ url: `/api/uploads/${req.file.filename}` });
}));
authRouter.use('/uploads', express.static(UPLOAD_DIR, { setHeaders: (r) => r.setHeader('X-Content-Type-Options', 'nosniff') }));
