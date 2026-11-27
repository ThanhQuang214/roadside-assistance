// UC04 Theo dõi + UC05 Hủy yêu cầu – RescueDetailView, màn hình S04 (docs/design/M2-tuan2-yeu-cau-cuu-ho.md §3).
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { apiFetch, type ApiError } from '../auth/session.tsx';
import { Alert, RescueStatusChip, useToast } from '../shared/ui/feedback.tsx';
import { Button, CARD, InfoRow, buttonClass } from '../shared/ui/form.tsx';
import { formatDateTime, formatTime, formatVnd } from '../shared/ui/format.ts';
import { MarkersMap } from '../shared/ui/map.tsx';
import { ConfirmDialog } from '../shared/ui/modal.tsx';
import { usePolling } from '../shared/ui/use-polling.ts';
import { INCIDENT_LABEL, URGENCY_LABEL } from '../matching-ai/incident-types.ts';
import type { RescueRequest } from './rescue-store.ts';
import { ACTIVE_STATUSES, PAYMENT_METHOD_LABEL } from './rescue-validation.ts';

const CANCEL_REASONS = ['Đã tự khắc phục được', 'Đã tìm được cứu hộ khác', 'Chờ quá lâu', 'Gửi nhầm thông tin'];

export default function TrackRequestPage() {
  const { id } = useParams();
  const location = useLocation();
  const [req, setReq] = useState<RescueRequest | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [toast, showToast] = useToast();
  const [justCreated] = useState(() => !!location.state?.created);

  const load = () => apiFetch(`/rescue-requests/${id}`).then((d) => { setReq(d.request); setLoadError(''); }, (e) => setLoadError(e.message));
  // Polling 5 giây/lần tới khi đơn kết thúc (UC04).
  usePolling(load, req && !ACTIVE_STATUSES.includes(req.status) ? null : 5000, [id]);

  /** UC05: lỗi lý do → hiện trong hộp thoại; công ty vừa nhận đơn (409, 4.1) → đóng hộp thoại, báo lỗi, làm mới đơn. */
  async function cancel(reason: string) {
    try {
      setReq((await apiFetch(`/rescue-requests/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) })).request);
      setError('');
      showToast('Đã hủy yêu cầu cứu hộ thành công');
    } catch (e) {
      if ((e as ApiError).field === 'reason') throw e;
      setError((e as Error).message);
      load();
    }
    setCancelling(false);
  }

  if (!req) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
        <Link to="/" className="text-body-sm text-primary">← Trang chính</Link>
        {loadError
          ? <Alert action={<Button size="sm" variant="secondary" onClick={load}>Thử lại</Button>}>{loadError}</Alert>
          : <p className="text-text-sub">Đang tải…</p>}
      </main>
    );
  }

  const c = req.company;
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Link to="/" className="text-body-sm text-primary">← Trang chính</Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-title">Yêu cầu #{req.id}</h1>
        <RescueStatusChip status={req.status} />
      </div>
      {justCreated && req.status === 'Pending' && <Alert tone="success">Đã gửi yêu cầu cứu hộ tới {c.name}.</Alert>}
      {error && <Alert>{error}</Alert>}
      {loadError && (
        <Alert tone="warning" action={<Button size="sm" variant="secondary" onClick={load}>Thử lại</Button>}>
          Chưa cập nhật được trạng thái mới nhất: {loadError}
        </Alert>
      )}

      <StatusPanel req={req} />

      <MarkersMap height={220} markers={[
        { id: 'incident', lat: req.lat, lng: req.lng, label: 'Vị trí sự cố', tone: 'danger' },
        { id: 'station', lat: c.stationLat, lng: c.stationLng, label: `Trạm ${c.name}`, tone: 'primary' },
      ]} />

      <section className={CARD} aria-label="Đơn vị cứu hộ">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{c.name}</p>
            <p className="text-body-sm text-text-sub">{req.service.name}</p>
          </div>
          <a href={`tel:${c.phone}`} className={buttonClass('secondary', 'sm')}>Gọi {c.phone}</a>
        </div>
        <dl className="mt-2 text-body-sm">
          <InfoRow label="Giá niêm yết ước tính" value={formatVnd(req.estimatedPrice)} />
          <InfoRow label="Khoảng cách từ trạm" value={req.distanceKm == null ? '–' : `${req.distanceKm} km`} />
          {req.payment && <InfoRow label="Đã thanh toán" value={`${formatVnd(req.payment.amount)} · ${PAYMENT_METHOD_LABEL[req.payment.method]}`} />}
        </dl>
      </section>

      <section className={CARD} aria-label="Thông tin sự cố">
        <h2 className="mb-2 text-heading">Thông tin sự cố</h2>
        <dl className="text-body-sm">
          <InfoRow label="Phương tiện" value={req.vehicleType.name} />
          {req.classification && (
            <InfoRow label="Phân loại" value={`${INCIDENT_LABEL[req.classification.incidentType]} · khẩn cấp ${URGENCY_LABEL[req.classification.urgency]}${req.classification.source === 'MANUAL' ? ' (tự chọn)' : ''}`} />
          )}
          {req.address && <InfoRow label="Địa chỉ" value={req.address} />}
          <InfoRow label="Điện thoại liên hệ" value={req.contactPhone} />
          <InfoRow label="Gửi lúc" value={formatDateTime(req.createdAt)} />
          {req.acceptedAt && <InfoRow label="Tiếp nhận lúc" value={formatDateTime(req.acceptedAt)} />}
          {req.startedAt && <InfoRow label="Bắt đầu xử lý" value={formatDateTime(req.startedAt)} />}
          {req.completedAt && <InfoRow label="Hoàn tất lúc" value={formatDateTime(req.completedAt)} />}
        </dl>
        <p className="mt-2 whitespace-pre-line text-body-sm">{req.description}</p>
        {req.photoUrl && <img src={req.photoUrl} alt="Ảnh hiện trường" className="mt-2 max-h-60 w-full rounded-control border border-border object-cover" />}
      </section>

      {req.status === 'Pending' && <Button variant="danger" block onClick={() => setCancelling(true)}>Hủy yêu cầu</Button>}
      {req.status === 'Rejected' && <Link to="/requests/new" className={`${buttonClass()} w-full`}>Tìm đơn vị cứu hộ khác</Link>}

      {cancelling && (
        <ConfirmDialog title="Hủy yêu cầu cứu hộ" danger confirmLabel="Xác nhận hủy" reasonLabel="Lý do hủy" reasonOptions={CANCEL_REASONS}
          message="Chỉ hủy được khi đơn còn Chờ tiếp nhận. Công ty cứu hộ sẽ thấy đơn đã hủy."
          onConfirm={cancel} onClose={() => setCancelling(false)} />
      )}
      {toast}
    </main>
  );
}

/** Thông điệp chính theo trạng thái; ETA nổi bật khi đội cứu hộ đang tới (UC04, UC09-5a). */
function StatusPanel({ req }: { req: RescueRequest }) {
  switch (req.status) {
    case 'Pending':
      return <Alert tone="warning">Đang chờ {req.company.name} xác nhận. Trang tự cập nhật mỗi 5 giây.</Alert>;
    case 'Accepted':
    case 'InProgress':
      return (
        <section className={`${CARD} flex items-center justify-between gap-3 border-primary`} aria-live="polite">
          <div>
            <p className="text-body-sm text-text-sub">{req.status === 'Accepted' ? 'Đội cứu hộ đang tới' : 'Đang xử lý tại hiện trường'}</p>
            <p className="text-title text-primary">~{req.etaMinutes} phút</p>
          </div>
          <p className="text-right text-caption text-text-sub">ETA cập nhật<br />lúc {formatTime(req.updatedAt)}</p>
        </section>
      );
    case 'Completed':
      return <Alert tone="success">Yêu cầu đã hoàn tất lúc {formatDateTime(req.completedAt)}. Cảm ơn bạn đã sử dụng dịch vụ.</Alert>;
    case 'Cancelled':
      return <Alert tone="info">Bạn đã hủy yêu cầu. Lý do: {req.cancelReason}</Alert>;
    case 'Rejected':
      return <Alert>Đơn vị cứu hộ đã từ chối. Lý do: {req.rejectReason}</Alert>;
  }
}
