// UC10 Thẩm định đơn vị cứu hộ – CompanyApprovalView, màn hình AD-01 (docs/design/M3-tuan1-cong-ty-admin.md §3).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiFetch, type ApiError } from '../auth/session.tsx';
import { Alert, useToast } from '../shared/ui/feedback.tsx';
import { BTN_SM, Button, CARD, Field, InfoRow, SelectField } from '../shared/ui/form.tsx';
import { MarkersMap } from '../shared/ui/map.tsx';
import { ConfirmDialog } from '../shared/ui/modal.tsx';
import { APPROVAL_LABEL, ApprovalChip, type ApprovalStatus } from './ApprovalChip.tsx';
import type { Company } from './CompanyManagePage.tsx';

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN') : '–');
const TH = 'px-4 py-3 font-medium';

export default function CompanyApprovalPage() {
  const [status, setStatus] = useState<ApprovalStatus | ''>('Pending');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Company[] | null>(null);
  const [selected, setSelected] = useState<Company | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [toast, showToast] = useToast();

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set('approvalStatus', status);
    if (q.trim()) params.set('q', q.trim());
    try {
      setItems((await apiFetch(`/admin/companies?${params}`)).items);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { load(); }, [status]);

  /** Duyệt / từ chối. Lỗi lý do → ném lại cho hộp thoại; hồ sơ vừa bị người khác xử lý (409) → báo lỗi và tải lại (UC10-6.1). */
  async function decide(action: 'approve' | 'reject', reason?: string) {
    const id = selected!.id;
    setBusy(true);
    try {
      const { company } = await apiFetch(`/admin/companies/${id}/${action}`, { method: 'POST', body: JSON.stringify({ reason }) });
      setSelected(company);
      setRejecting(false);
      setError('');
      showToast(action === 'approve' ? `Đã duyệt "${company.name}"` : `Đã từ chối "${company.name}"`);
    } catch (e) {
      if ((e as ApiError).field === 'reason') throw e;
      setRejecting(false);
      setError((e as Error).message);
      apiFetch(`/admin/companies/${id}`).then((d) => setSelected(d.company), () => setSelected(null));
    } finally {
      setBusy(false);
      load();
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[var(--layout-admin-sidebar)] shrink-0 flex-col gap-1 border-r border-border bg-surface p-4">
        <p className="mb-4 px-3 text-heading">Cứu hộ xe · Quản trị</p>
        <span aria-current="page" className="rounded-control bg-status-active-bg px-3 py-2 text-body-sm font-medium text-status-active-fg">Thẩm định đơn vị cứu hộ</span>
        <Link to="/account" className="rounded-control px-3 py-2 text-body-sm text-text-sub hover:bg-background">Tài khoản</Link>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-6 p-8">
        <h1 className="text-title">Thẩm định đơn vị cứu hộ</h1>

        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <SelectField label="Trạng thái" value={status} onChange={(e) => { setStatus(e.target.value as ApprovalStatus | ''); setSelected(null); }}>
              <option value="">Tất cả</option>
              {(['Pending', 'Approved', 'Rejected'] as const).map((s) => <option key={s} value={s}>{APPROVAL_LABEL[s]}</option>)}
            </SelectField>
          </div>
          <form className="flex flex-1 items-end gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
            <div className="max-w-md flex-1"><Field label="Tìm theo tên, số giấy phép hoặc mã hồ sơ" type="search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Button>Tìm</Button>
          </form>
        </div>

        {error && <Alert>{error}</Alert>}

        <div className="grid items-start gap-6 xl:grid-cols-[1fr_440px]">
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-body-sm">
              <thead className="text-text-sub">
                <tr className="border-b border-border"><th className={TH}>Mã</th><th className={TH}>Tên công ty</th><th className={TH}>Số giấy phép</th><th className={TH}>Ngày nộp</th><th className={TH}>Trạng thái</th></tr>
              </thead>
              <tbody>
                {items?.map((c) => (
                  <tr key={c.id} className={`h-12 border-b border-border last:border-0 ${selected?.id === c.id ? 'bg-status-active-bg' : ''}`}>
                    <td className="px-4 text-text-sub">#{c.id}</td>
                    <td className="px-4"><button className="text-left font-medium text-primary" onClick={() => { setSelected(c); setError(''); }}>{c.name}</button></td>
                    <td className="px-4">{c.licenseNumber}</td>
                    <td className="px-4 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                    <td className="px-4"><ApprovalChip status={c.approvalStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items?.length === 0 && <p className="p-6 text-center text-text-sub">Không có hồ sơ nào phù hợp.</p>}
            {!items && <p className="p-6 text-center text-text-sub">Đang tải…</p>}
          </div>

          {selected ? (
            <section className={`${CARD} flex flex-col gap-4`} aria-label="Chi tiết hồ sơ">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-heading">{selected.name}</h2>
                <ApprovalChip status={selected.approvalStatus} />
              </div>
              <dl className="text-body-sm">
                <InfoRow label="Mã hồ sơ" value={`#${selected.id}`} />
                <InfoRow label="Điện thoại" value={selected.phone} />
                <InfoRow label="Địa chỉ trạm" value={selected.address} />
                <InfoRow label="Tọa độ trạm" value={`${selected.stationLat}, ${selected.stationLng}`} />
                <InfoRow label="Bán kính phục vụ" value={`${selected.serviceRadiusKm} km`} />
                <InfoRow label="Số giấy phép" value={selected.licenseNumber} />
                <InfoRow label="Ngày nộp" value={formatDate(selected.createdAt)} />
                {selected.approvalStatus === 'Approved' && <InfoRow label="Ngày duyệt" value={formatDate(selected.approvedAt)} />}
                {selected.approvalStatus === 'Rejected' && <InfoRow label="Lý do từ chối" value={selected.rejectReason} />}
              </dl>
              <MarkersMap height={200} markers={[{ id: selected.id, lat: selected.stationLat, lng: selected.stationLng, label: `Trạm: ${selected.address}` }]} />
              <LicensePreview url={selected.licenseFileUrl} />
              {selected.approvalStatus === 'Pending' && (
                <div className="flex justify-end gap-2">
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => setRejecting(true)}>Từ chối</Button>
                  <Button size="sm" loading={busy} onClick={() => decide('approve')}>Duyệt hồ sơ</Button>
                </div>
              )}
            </section>
          ) : (
            <p className={`${CARD} text-center text-text-sub`}>Chọn một hồ sơ để xem chi tiết và giấy phép.</p>
          )}
        </div>
      </main>

      {rejecting && (
        <ConfirmDialog title="Từ chối hồ sơ" danger confirmLabel="Xác nhận từ chối" reasonLabel="Lý do từ chối"
          message={<>Hồ sơ <b>{selected?.name}</b> sẽ chuyển sang Bị từ chối kèm lý do.</>}
          onConfirm={(reason) => decide('reject', reason)} onClose={() => setRejecting(false)} />
      )}
      {toast}
    </div>
  );
}

/** Xem giấy phép; tải lỗi → báo và cho tải lại, hồ sơ vẫn Chờ duyệt (UC10-4.1). */
function LicensePreview({ url }: { url: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setState('loading');
    fetch(url, { method: 'HEAD' }).then((r) => setState(r.ok ? 'ok' : 'error'), () => setState('error'));
  }, [url, attempt]);

  if (state === 'loading') return <p className="text-body-sm text-text-sub">Đang tải giấy phép…</p>;
  if (state === 'error') {
    return (
      <Alert action={<button className={BTN_SM} onClick={() => setAttempt((a) => a + 1)}>Tải lại</button>}>
        Không tải được giấy phép đính kèm.
      </Alert>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {url.endsWith('.pdf')
        ? <iframe title="Giấy phép kinh doanh" src={url} className="h-96 w-full rounded-control border border-border" />
        : <img src={url} alt="Giấy phép kinh doanh" className="max-h-96 w-full rounded-control border border-border object-contain" />}
      <a href={url} target="_blank" className="text-body-sm text-primary">Mở giấy phép trong tab mới</a>
    </div>
  );
}
