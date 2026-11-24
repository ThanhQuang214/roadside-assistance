// Tạo tài khoản ADMIN (API không cho đăng ký ADMIN). Dùng: npm run create-admin -- <email> <matKhau> [hoTen] [sdt]
import bcrypt from 'bcryptjs';
import { getDb } from '../shared/db.ts';

const [email, password, fullName = 'Quản trị viên', phone = '0900000000'] = process.argv.slice(2);
if (!email?.includes('@') || !password || password.length < 8) {
  console.error('Dùng: npm run create-admin -- <email> <matKhau ≥ 8 ký tự> [hoTen] [sdt]');
  process.exit(1);
}
const db = getDb();
if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase())) {
  console.error(`Email ${email} đã tồn tại.`);
  process.exit(1);
}
db.prepare('INSERT INTO users (email, phone, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)')
  .run(email.toLowerCase(), phone, bcrypt.hashSync(password, 10), fullName, 'ADMIN');
console.log(`Đã tạo ADMIN ${email}`);
