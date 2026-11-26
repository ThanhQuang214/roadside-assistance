// Quản lý tài khoản (xem hồ sơ cá nhân, đăng xuất) – màn hình A-03 (docs/design/M2-tuan1-xac-thuc.md §3).
import { Link, useNavigate } from 'react-router';
import { BTN_SECONDARY, CARD, InfoRow } from '../shared/ui/form.tsx';
import { HOME_BY_ROLE, ROLE_LABEL, useAuth } from './session.tsx';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Link to={HOME_BY_ROLE[user.role]} className="text-body-sm text-primary">← Về trang chính</Link>
      <h1 className="text-title">Tài khoản</h1>
      <dl className={CARD}>
        <InfoRow label="Họ tên" value={user.fullName} />
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="Số điện thoại" value={user.phone} />
        <InfoRow label="Vai trò" value={ROLE_LABEL[user.role]} />
        <InfoRow label="Ngày tạo" value={new Date(user.createdAt).toLocaleDateString('vi-VN')} />
      </dl>
      {user.role === 'COMPANY' && <Link to="/company" className={`${BTN_SECONDARY} flex items-center justify-center`}>Hồ sơ công ty & dịch vụ</Link>}
      <button className={`${BTN_SECONDARY} text-danger`} onClick={() => { logout(); navigate('/login', { replace: true }); }}>
        Đăng xuất
      </button>
    </main>
  );
}
