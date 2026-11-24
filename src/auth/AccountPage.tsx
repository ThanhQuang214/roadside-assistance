// Quản lý tài khoản (xem hồ sơ, trạng thái duyệt công ty, đăng xuất) – màn hình A-03 (docs/design/M2-tuan1-xac-thuc.md §3).
import { useNavigate } from 'react-router';
import { BTN_SECONDARY, CARD } from './form.tsx';
import { ROLE_LABEL, useAuth } from './session.tsx';

const APPROVAL = {
  Pending: { label: 'Chờ duyệt', cls: 'bg-status-pending-bg text-status-pending-fg' },
  Approved: { label: 'Đã duyệt', cls: 'bg-status-completed-bg text-status-completed-fg' },
  Rejected: { label: 'Bị từ chối', cls: 'bg-status-closed-bg text-status-closed-fg' },
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 border-b border-border py-2 last:border-0">
    <dt className="text-text-sub">{label}</dt>
    <dd className="text-right">{value}</dd>
  </div>
);

export default function AccountPage() {
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const approval = company && APPROVAL[company.approvalStatus];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-title">Tài khoản</h1>
      <dl className={CARD}>
        <Row label="Họ tên" value={user.fullName} />
        <Row label="Email" value={user.email} />
        <Row label="Số điện thoại" value={user.phone} />
        <Row label="Vai trò" value={ROLE_LABEL[user.role]} />
        <Row label="Ngày tạo" value={new Date(user.createdAt).toLocaleDateString('vi-VN')} />
      </dl>

      {company && approval && (
        <section className={`${CARD} flex flex-col gap-2`}>
          <div className="flex items-center justify-between">
            <h2 className="text-heading">{company.name}</h2>
            <span className={`rounded-full px-3 py-1 text-label ${approval.cls}`}>{approval.label}</span>
          </div>
          {company.approvalStatus === 'Pending' && <p className="text-body-sm text-text-sub">Hồ sơ đang chờ Quản trị viên thẩm định. Công ty chưa xuất hiện trong danh sách ghép nối.</p>}
          {company.approvalStatus === 'Rejected' && <p className="text-body-sm text-danger">Lý do: {company.rejectReason}</p>}
          <dl>
            <Row label="Điện thoại" value={company.phone} />
            <Row label="Địa chỉ trạm" value={company.address} />
            <Row label="Giấy phép" value={<a href={company.licenseFileUrl} target="_blank" className="text-primary">{company.licenseNumber}</a>} />
            <Row label="Bán kính phục vụ" value={`${company.serviceRadiusKm} km`} />
          </dl>
        </section>
      )}

      <button className={`${BTN_SECONDARY} text-danger`} onClick={() => { logout(); navigate('/login', { replace: true }); }}>
        Đăng xuất
      </button>
    </main>
  );
}
