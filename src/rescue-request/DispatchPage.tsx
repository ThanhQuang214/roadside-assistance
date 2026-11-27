// UC09 Tiếp nhận và điều phối cứu hộ – RescueDispatchView, màn hình C-02 route /company/dispatch (docs/design/M3-tuan2-dieu-phoi.md §3).
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { FieldError } from '../auth/auth-validation.ts';
import { apiFetch, type ApiError } from '../auth/session.tsx';
import { RESCUE_STATUSES, type RescueStatus } from '../shared/state/rescue-request-state.ts';
import { Alert, RESCUE_STATUS_UI, RescueStatusChip, useToast } from '../shared/ui/feedback.tsx';
import { Button, CARD, Field, InfoRow, SelectField } from '../shared/ui/form.tsx';
import { formatDateTime, formatVnd } from '../shared/ui/format.ts';
import { MarkersMap } from '../shared/ui/map.tsx';
import { ConfirmDialog, Modal } from '../shared/ui/modal.tsx';
import { usePolling } from '../shared/ui/use-polling.ts';
import { INCIDENT_LABEL, URGENCY_LABEL } from '../matching-ai/incident-types.ts';
import type { Payment, RescueRequest } from './rescue-store.ts';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, validateEta, validatePayment } from './rescue-validation.ts';

const TH = 'px-4 py-3 font-medium';
const REJECT_REASONS = ['Hết xe / thiết bị phù hợp', 'Ngoài khả năng phục vụ', 'Không liên lạc được khách hàng'];
const toFieldError = (e: unknown): FieldError => ({ field: (e as ApiError).field ?? '', message: (e as Error).message });

export default function DispatchPage() {
  const [status, setStatus] = useState<RescueStatus | ''>('');
  const [items, setItems] = useState<RescueRequest[] | null>(null);
  const [detail, setDetail] = useState<RescueRequest | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'reject' | 'complete' | null>(null);
  const [toast, showToast] = useToast();
  const seenPending = useRef<Set<number> | null>(null);

  // Bước 1: danh sách + đơn đang mở, polling 5 giây; báo khi có đơn Pending mới.
  async function load(clearError = true) {
    try {
      const list: RescueRequest[] = (await apiFetch(`/rescue-requests${status ? `?status=${status}` : ''}`)).items;
      const pending = list.filter((r) => r.status === 'Pending').map((r) => r.id);
      const fresh = seenPending.current ? pending.filter((id) => !seenPending.current!.has(id)) : [];
      if (fresh.length) showToast(`Có ${fresh.length} yêu cầu cứu hộ mới`);
      seenPending.current = new Set([...(seenPending.current ?? []), ...pending]);
      setItems(list);
      if (detail) {
        const latest: RescueRequest = (await apiFetch(`/rescue-requests/${detail.id}`)).request;
        setDetail((cur) => (cur?.id === latest.id ? latest : cur)); // người dùng vừa chọn đơn khác thì giữ đơn mới chọn
      }
      if (clearError) setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  usePolling(load, 5000, [status, detail?.id]);

  /**
   * Gọi một thao tác trên đơn đang mở. Lỗi theo ô (ETA, số tiền…) → ném lại để form/hộp thoại hiện dưới ô (UC09-4.2, 7.1);
   * lỗi khác (409 trạng thái đã đổi – 4.1, 5.1; lỗi mạng) → banner + tải lại đơn, trả false.
   */
  async function act(path: string, method: string, body: unknown, success: string, keepInputOnFailure = false): Promise<boolean> {
    setBusy(true);
    try {
      const { request } = await apiFetch(`/rescue-requests/${detail!.id}/${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      setDetail(request);
      setError('');
      showToast(success);
      load(false);
      return true;
    } catch (e) {
      if ((e as ApiError).field) throw e;
      setError((e as Error).message);
      // Mất mạng/lỗi máy chủ: form hoặc modal giữ nguyên dữ liệu để gửi lại.
      // Xung đột 409: đóng modal theo UI Spec rồi tải trạng thái mới nhất.
      if (keepInputOnFailure && (e as ApiError).status !== 409) throw e;
      load(false);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = items?.filter((r) => r.status === 'Pending').length ?? 0;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3">
        <nav className="flex items-center gap-1" aria-label="Phân hệ công ty">
          <span className="mr-3 text-heading">Cứu hộ xe · Công ty</span>
          <span aria-current="page" className="rounded-control bg-status-active-bg px-3 py-2 text-body-sm font-medium text-status-active-fg">Điều phối đơn</span>
          <Link to="/company" className="rounded-control px-3 py-2 text-body-sm text-text-sub hover:bg-background">Hồ sơ & dịch vụ</Link>
        </nav>
        <Link to="/account" className="text-body-sm font-medium text-primary">Tài khoản</Link>
      </header>

      <main className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-title">Tiếp nhận & điều phối cứu hộ</h1>
          <div className="w-56">
            <SelectField label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value as RescueStatus | '')}>
              <option value="">Tất cả</option>
              {RESCUE_STATUSES.map((s) => <option key={s} value={s}>{RESCUE_STATUS_UI[s].label}</option>)}
            </SelectField>
          </div>
        </div>
        {pendingCount > 0 && <Alert tone="warning">{pendingCount} yêu cầu đang chờ tiếp nhận.</Alert>}
        {error && <Alert action={<Button size="sm" variant="secondary" onClick={() => { setError(''); load(); }}>Tải lại</Button>}>{error}</Alert>}

        <div className="grid items-start gap-6 xl:grid-cols-[1fr_480px]">
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-body-sm">
              <thead className="text-text-sub">
                <tr className="border-b border-border">
                  <th className={TH}>Mã</th><th className={TH}>Gửi lúc</th><th className={TH}>Dịch vụ</th><th className={TH}>Phương tiện</th>
                  <th className={TH}>Khoảng cách</th><th className={TH}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items?.map((r) => (
                  <tr key={r.id} className={`h-12 border-b border-border last:border-0 ${detail?.id === r.id ? 'bg-status-active-bg' : ''}`}>
                    <td className="px-4"><button className="font-medium text-primary" onClick={() => { setDetail(r); setError(''); }}>#{r.id}</button></td>
                    <td className="whitespace-nowrap px-4">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4">{r.service.name}</td>
                    <td className="px-4">{r.vehicleType.name}</td>
                    <td className="px-4">{r.distanceKm == null ? '–' : `${r.distanceKm} km`}</td>
                    <td className="px-4"><RescueStatusChip status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items?.length === 0 && <p className="p-6 text-center text-text-sub">Chưa có yêu cầu cứu hộ nào.</p>}
            {!items && !error && <p className="p-6 text-center text-text-sub">Đang tải…</p>}
          </div>

          {detail ? (
            <section className={`${CARD} flex flex-col gap-4`} aria-label="Chi tiết yêu cầu">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-heading">Yêu cầu #{detail.id}</h2>
                <RescueStatusChip status={detail.status} />
              </div>
              <RequestInfo r={detail} />
              <Actions key={`${detail.id}-${detail.status}`} r={detail} busy={busy} act={act} onReject={() => setDialog('reject')} onComplete={() => setDialog('complete')} />
            </section>
          ) : (
            <p className={`${CARD} text-center text-text-sub`}>Chọn một yêu cầu để xem chi tiết và xử lý.</p>
          )}
        </div>
      </main>

      {dialog === 'reject' && (
        <ConfirmDialog title={`Từ chối yêu cầu #${detail!.id}`} danger confirmLabel="Xác nhận từ chối" reasonLabel="Lý do từ chối" reasonOptions={REJECT_REASONS}
          message="Người gặp sự cố sẽ thấy lý do và có thể chọn đơn vị khác."
          onConfirm={async (reason) => { await act('reject', 'POST', { reason }, 'Đã từ chối yêu cầu', true); setDialog(null); }}
          onClose={() => setDialog(null)} />
      )}
      {dialog === 'complete' && (
        <Modal title={`Hoàn tất yêu cầu #${detail!.id}`} onClose={() => setDialog(null)}>
          <PaymentForm initial={{ amount: detail!.estimatedPrice ?? 0, method: 'CASH', note: '' }} submitLabel="Hoàn tất & lưu thanh toán" busy={busy}
            onSubmit={async (payment) => { await act('complete', 'POST', { payment }, 'Đã hoàn tất yêu cầu cứu hộ', true); setDialog(null); }}
            extra={<Button type="button" variant="secondary" size="sm" disabled={busy}
              onClick={async () => { await act('complete', 'POST', {}, 'Đã hoàn tất, nhớ ghi thanh toán sau', true); setDialog(null); }}>Ghi thanh toán sau</Button>} />
        </Modal>
      )}
      {toast}
    </div>
  );
}

/** Bước 2: thông tin đầy đủ của đơn cho điều phối viên. */
function RequestInfo({ r }: { r: RescueRequest }) {
  return (
    <>
      <dl className="text-body-sm">
        <InfoRow label="Khách hàng" value={r.user.fullName} />
        <InfoRow label="Điện thoại liên hệ" value={<a href={`tel:${r.contactPhone}`} className="font-medium text-primary">{r.contactPhone}</a>} />
        <InfoRow label="Phương tiện" value={r.vehicleType.name} />
        <InfoRow label="Dịch vụ yêu cầu" value={`${r.service.name} · ${formatVnd(r.estimatedPrice)}`} />
        {r.classification && (
          <InfoRow label="Phân loại sự cố" value={`${INCIDENT_LABEL[r.classification.incidentType]} · khẩn cấp ${URGENCY_LABEL[r.classification.urgency]}${r.classification.source === 'MANUAL' ? ' (khách tự chọn)' : ' (AI)'}`} />
        )}
        <InfoRow label="Khoảng cách từ trạm" value={r.distanceKm == null ? '–' : `${r.distanceKm} km`} />
        {r.address && <InfoRow label="Địa chỉ" value={r.address} />}
        <InfoRow label="Tọa độ" value={`${r.lat}, ${r.lng}`} />
        <InfoRow label="Gửi lúc" value={formatDateTime(r.createdAt)} />
        {r.etaMinutes != null && <InfoRow label="ETA đã phản hồi" value={`${r.etaMinutes} phút`} />}
        {r.cancelReason && <InfoRow label="Lý do khách hủy" value={r.cancelReason} />}
        {r.rejectReason && <InfoRow label="Lý do từ chối" value={r.rejectReason} />}
        {r.payment && <InfoRow label="Thanh toán" value={`${formatVnd(r.payment.amount)} · ${PAYMENT_METHOD_LABEL[r.payment.method]}`} />}
      </dl>
      <p className="whitespace-pre-line rounded-control bg-background p-3 text-body-sm">{r.description}</p>
      {r.photoUrl && (
        <a href={r.photoUrl} target="_blank"><img src={r.photoUrl} alt="Ảnh hiện trường" className="max-h-56 w-full rounded-control border border-border object-cover" /></a>
      )}
      <MarkersMap height={220} markers={[
        { id: 'incident', lat: r.lat, lng: r.lng, label: 'Vị trí sự cố', tone: 'danger' },
        { id: 'station', lat: r.company.stationLat, lng: r.company.stationLng, label: 'Trạm của công ty', tone: 'primary' },
      ]} />
    </>
  );
}

type ActFn = (path: string, method: string, body: unknown, success: string, keepInputOnFailure?: boolean) => Promise<boolean>;

/** Thao tác hợp lệ theo trạng thái hiện tại (khớp bảng api-contract §2; server vẫn kiểm tra lại qua State Pattern). */
function Actions({ r, busy, act, onReject, onComplete }: { r: RescueRequest; busy: boolean; act: ActFn; onReject: () => void; onComplete: () => void }) {
  switch (r.status) {
    case 'Pending':
      return (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <EtaForm label="Thời gian dự kiến đến (phút)" submitLabel="Nhận đơn" busy={busy}
            onSubmit={(etaMinutes) => act('accept', 'POST', { etaMinutes }, `Đã nhận yêu cầu #${r.id}`, true)} />
          <Button variant="danger" size="sm" className="self-start" disabled={busy} onClick={onReject}>Từ chối đơn</Button>
        </div>
      );
    case 'Accepted':
    case 'InProgress':
      return (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <EtaForm label="Cập nhật ETA (phút)" initial={r.etaMinutes} submitLabel="Cập nhật ETA" secondary busy={busy}
            onSubmit={(etaMinutes) => act('eta', 'PATCH', { etaMinutes }, 'Đã cập nhật ETA', true)} />
          {r.status === 'Accepted'
            ? <Button size="sm" className="self-start" loading={busy} onClick={() => act('start', 'POST', undefined, 'Đã chuyển sang Đang xử lý')}>Bắt đầu xử lý</Button>
            : <Button size="sm" className="self-start" disabled={busy} onClick={onComplete}>Hoàn tất cứu hộ</Button>}
        </div>
      );
    case 'Completed':
      return (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <h3 className="text-label">{r.payment ? 'Sửa thông tin thanh toán' : 'Ghi nhận thanh toán (UC09-6a)'}</h3>
          <PaymentForm initial={r.payment ?? { amount: r.estimatedPrice ?? 0, method: 'CASH', note: '' }} submitLabel="Lưu thanh toán" busy={busy}
            onSubmit={(p) => act('payment', 'PUT', p, 'Đã lưu thông tin thanh toán', true)} />
        </div>
      );
    default:
      return null;
  }
}

function EtaForm({ label, initial, submitLabel, secondary, busy, onSubmit }:
  { label: string; initial?: number | null; submitLabel: string; secondary?: boolean; busy: boolean; onSubmit: (eta: number) => Promise<unknown> }) {
  const [eta, setEta] = useState(initial == null ? '' : String(initial));
  const [err, setErr] = useState<FieldError | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const fieldErr = validateEta(eta);
    setErr(fieldErr);
    if (fieldErr) return;
    try {
      await onSubmit(Number(eta));
    } catch (e) {
      setErr(toFieldError(e));
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex items-start gap-2">
      <div className="w-56"><Field label={label} type="number" inputMode="numeric" min={1} max={600} placeholder="VD: 20" value={eta}
        onChange={(e) => setEta(e.target.value)} error={err?.message} /></div>
      {/* mt-6 = chiều cao nhãn + khoảng cách, để nút thẳng hàng với ô nhập kể cả khi có dòng lỗi */}
      <Button size="lg" className="mt-6" variant={secondary ? 'secondary' : 'primary'} loading={busy}>{submitLabel}</Button>
    </form>
  );
}

type PaymentInput = { amount: number; method: Payment['method']; note: string | null };

/** Ghi nhận thanh toán (bước 6–7, 6a); lỗi theo ô hiện ngay dưới ô, giữ dữ liệu đã nhập (7.1). */
function PaymentForm({ initial, submitLabel, busy, onSubmit, extra }:
  { initial: PaymentInput; submitLabel: string; busy: boolean; onSubmit: (p: PaymentInput) => Promise<unknown>; extra?: ReactNode }) {
  const [f, setF] = useState({ amount: String(initial.amount), method: initial.method as string, note: initial.note ?? '' });
  const [err, setErr] = useState<FieldError | null>(null);
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }), error: err?.field === k ? err.message : undefined });
  async function submit(e: FormEvent) {
    e.preventDefault();
    const p = { amount: Number(f.amount), method: f.method as Payment['method'], note: f.note.trim() || null };
    const fieldErr = validatePayment({ ...p, amount: f.amount });
    setErr(fieldErr);
    if (fieldErr) return;
    try {
      await onSubmit(p);
    } catch (e) {
      setErr(toFieldError(e));
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Số tiền thực tế (VND)" type="number" inputMode="numeric" min={0} {...bind('amount')} />
        <SelectField label="Phương thức" {...bind('method')}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
        </SelectField>
      </div>
      <Field label="Ghi chú (không bắt buộc)" maxLength={255} {...bind('note')} />
      {err && !['amount', 'method', 'note'].includes(err.field) && <Alert>{err.message}</Alert>}
      <div className="flex justify-end gap-2">
        {extra}
        <Button size="sm" loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}
