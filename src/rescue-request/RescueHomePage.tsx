// UC03/UC04 – HomeBoundary, màn hình S01 Trợ giúp khi xe gặp sự cố (docs/design/M2-tuan2-yeu-cau-cuu-ho.md §3).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiFetch, useAuth } from '../auth/session.tsx';
import { Alert, RescueStatusChip } from '../shared/ui/feedback.tsx';
import { CARD, buttonClass } from '../shared/ui/form.tsx';
import { formatDateTime } from '../shared/ui/format.ts';
import type { RescueRequest } from './rescue-store.ts';
import { ACTIVE_STATUSES } from './rescue-validation.ts';

export default function RescueHomePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<RescueRequest[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/rescue-requests').then((d) => setItems(d.items), (e) => setError(e.message));
  }, []);

  const active = items?.filter((r) => ACTIVE_STATUSES.includes(r.status)) ?? [];
  const history = items?.filter((r) => !ACTIVE_STATUSES.includes(r.status)) ?? [];

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <span className="text-heading text-primary">Cứu hộ xe</span>
        <Link to="/account" className="text-body-sm font-medium text-primary">Tài khoản</Link>
      </header>

      <section className="flex flex-col gap-3">
        <h1 className="text-title">Xin chào, {user?.fullName}</h1>
        <p className="text-text-sub">Xe gặp sự cố trên đường? Gửi yêu cầu để được đơn vị cứu hộ gần nhất hỗ trợ.</p>
        <Link to="/requests/new" className={`${buttonClass('danger', 'xl')} w-full`}>Gọi cứu hộ ngay</Link>
      </section>

      {error && <Alert>{error}</Alert>}

      {active.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Yêu cầu đang xử lý">
          <h2 className="text-heading">Đang xử lý</h2>
          {active.map((r) => <RequestCard key={r.id} r={r} highlight />)}
        </section>
      )}

      <section className="flex flex-col gap-2" aria-label="Lịch sử yêu cầu">
        <h2 className="text-heading">Lịch sử yêu cầu</h2>
        {!items && !error && <p className="text-text-sub">Đang tải…</p>}
        {items && history.length === 0 && <p className="text-text-sub">Chưa có yêu cầu nào đã kết thúc.</p>}
        {history.map((r) => <RequestCard key={r.id} r={r} />)}
      </section>
    </main>
  );
}

function RequestCard({ r, highlight }: { r: RescueRequest; highlight?: boolean }) {
  return (
    <Link to={`/requests/${r.id}`} className={`${CARD} flex flex-col gap-1 ${highlight ? 'border-primary' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{r.service.name}</span>
        <RescueStatusChip status={r.status} />
      </div>
      <span className="text-body-sm text-text-sub">{r.company.name} · {formatDateTime(r.createdAt)}</span>
      {highlight && r.etaMinutes != null && <span className="text-body-sm font-medium text-primary">Dự kiến đến trong ~{r.etaMinutes} phút</span>}
    </Link>
  );
}
