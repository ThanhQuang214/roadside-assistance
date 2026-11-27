// UC03 Yêu cầu cứu hộ khẩn cấp – RescueRequestForm: S02 Tạo yêu cầu → S03 Chọn đơn vị cứu hộ (docs/design/M2-tuan2-yeu-cau-cuu-ho.md §3).
// Hai bước nằm chung một component nên "Quay lại" và lỗi gửi đơn không làm mất dữ liệu đã nhập (UC03-7.1).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiFetch, useAuth, type ApiError } from '../auth/session.tsx';
import { Alert } from '../shared/ui/feedback.tsx';
import { Button, CARD, Field, SelectField, TextAreaField, useForm } from '../shared/ui/form.tsx';
import { formatVnd } from '../shared/ui/format.ts';
import { LocationPicker, type LatLng } from '../shared/ui/map.tsx';
import type { CompanyCandidate, MatchingStrategyName } from '../shared/strategy/matching-strategy.ts';
import { INCIDENT_LABEL, INCIDENT_TYPES, SUGGESTED_SERVICE_TYPE, URGENCY_LABEL, type Classification } from '../matching-ai/incident-types.ts';
import { validateRequestDraft } from './rescue-validation.ts';

type CatalogItem = { id: number; code: string; name: string };
const FORM_FIELDS = ['lat', 'address', 'vehicleTypeCode', 'description', 'contactPhone', 'photoUrl'];
const SORTS: [MatchingStrategyName, string][] = [['nearest', 'Gần nhất'], ['rating', 'Đánh giá cao nhất'], ['weighted', 'Cân bằng']];

export default function CreateRequestPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'pick'>('form');
  const { values, bind, set, err, setErr } = useForm({ contactPhone: user?.phone ?? '', vehicleTypeCode: 'MOTORBIKE' });
  const [pos, setPos] = useState<LatLng | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<CatalogItem[]>([]);
  const [serviceTypes, setServiceTypes] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [classification, setClassification] = useState<Classification | null>(null);

  // S03
  const [serviceTypeCode, setServiceTypeCode] = useState('');
  const [strategy, setStrategy] = useState<MatchingStrategyName>('nearest');
  const [radiusKm, setRadiusKm] = useState(20);
  const [candidates, setCandidates] = useState<CompanyCandidate[] | null>(null);
  const [selected, setSelected] = useState<CompanyCandidate | null>(null);
  const [pickError, setPickError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const matchingRequest = useRef(0);

  async function loadCatalogs() {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const [vehicles, services] = await Promise.all([
        apiFetch('/catalog/vehicle-types'),
        apiFetch('/catalog/service-types'),
      ]);
      setVehicleTypes(vehicles.items);
      setServiceTypes(services.items);
    } catch (e) {
      setCatalogError((e as Error).message);
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => { loadCatalogs(); }, []);

  // UC03 bước 5 / 5.1 / 5.2: đổi dịch vụ, cách sắp xếp hoặc bán kính → tải lại danh sách gợi ý.
  useEffect(() => {
    if (step !== 'pick' || !serviceTypeCode || !pos) return;
    const requestId = ++matchingRequest.current;
    setCandidates(null);
    setSelected(null);
    setPickError('');
    const q = new URLSearchParams({ lat: String(pos.lat), lng: String(pos.lng), serviceTypeCode, radiusKm: String(radiusKm), strategy });
    apiFetch(`/matching/companies?${q}`).then(
      (d) => { if (requestId === matchingRequest.current) setCandidates(d.items); },
      (e) => { if (requestId === matchingRequest.current) setPickError(e.message); });
  }, [step, serviceTypeCode, strategy, radiusKm, pos]);

  const draft = () => ({ ...values, lat: pos?.lat, lng: pos?.lng, photoUrl: values.photoUrl || undefined, address: values.address || undefined });

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      set({ photoUrl: (await apiFetch('/uploads', { method: 'POST', body: fd })).url });
      setErr(null);
    } catch (e) {
      set({ photoUrl: '' });
      setErr({ field: 'photoUrl', message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  // UC03 bước 3–4: kiểm tra form → gửi mô tả cho AI (S1); AI lỗi / quá giờ → người dùng tự chọn dịch vụ (4.1).
  async function analyze(e: FormEvent) {
    e.preventDefault();
    const fieldErr = validateRequestDraft(draft());
    setErr(fieldErr);
    // Đợi React vẽ lại (ô lỗi mới có aria-invalid) rồi mới focus.
    if (fieldErr) return requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    setAnalyzing(true);
    try {
      const ai = await apiFetch('/ai/classify', { method: 'POST', body: JSON.stringify({ description: values.description }), signal: AbortSignal.timeout(5000) });
      setClassification({ incidentType: ai.incidentType, urgency: ai.urgency, confidence: ai.confidence, source: 'AI' });
      setServiceTypeCode(ai.suggestedServiceTypeCode ?? '');
    } catch {
      setClassification(null);
    } finally {
      setAnalyzing(false);
    }
    setStep('pick');
  }

  // UC03 bước 6–7: tạo đơn Pending → S04. Lỗi mạng/máy chủ: giữ dữ liệu, cho gửi lại (7.1).
  async function submit() {
    if (!selected) return setPickError('Vui lòng chọn một công ty cứu hộ.');
    setSubmitting(true);
    setPickError('');
    const manualType = INCIDENT_TYPES.find((t) => SUGGESTED_SERVICE_TYPE[t] === serviceTypeCode) ?? 'OTHER';
    try {
      const { request } = await apiFetch('/rescue-requests', {
        method: 'POST',
        body: JSON.stringify({
          ...draft(), companyId: selected.companyId, serviceId: selected.serviceId,
          classification: classification ?? { incidentType: manualType, urgency: 'MEDIUM', confidence: null, source: 'MANUAL' },
        }),
      });
      navigate(`/requests/${request.id}`, { replace: true, state: { created: true } });
    } catch (e) {
      const { field, message } = e as ApiError;
      if (field && FORM_FIELDS.includes(field)) {
        setErr({ field, message });
        setStep('form');
      } else {
        setPickError(message);
      }
      setSubmitting(false);
    }
  }

  if (step === 'form') {
    const descLen = values.description?.trim().length ?? 0;
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
        <Link to="/" className="text-body-sm text-primary">← Trang chính</Link>
        <h1 className="text-title">Tạo yêu cầu cứu hộ</h1>
        {catalogError && <Alert action={<Button size="sm" variant="secondary" onClick={loadCatalogs}>Thử lại</Button>}>{catalogError}</Alert>}
        <form onSubmit={analyze} noValidate className="flex flex-col gap-4">
          <LocationPicker label="Vị trí sự cố" value={pos} onChange={setPos} autoLocate height={240}
            error={err?.field === 'lat' ? err.message : undefined} />
          <Field label="Địa chỉ / mốc gần nhất (không bắt buộc)" placeholder="VD: Trước số 12 Láng Hạ" maxLength={255} {...bind('address')} />

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-label">Loại phương tiện</legend>
            <div className="grid grid-cols-3 gap-2">
              {vehicleTypes.map((v) => (
                <label key={v.code} className="flex h-12 cursor-pointer items-center justify-center rounded-control border border-border bg-surface px-2 text-center text-body-sm has-checked:border-primary has-checked:bg-status-active-bg has-checked:font-semibold has-checked:text-status-active-fg has-focus-visible:outline-2 has-focus-visible:outline-primary">
                  <input type="radio" name="vehicleTypeCode" value={v.code} className="sr-only" checked={values.vehicleTypeCode === v.code}
                    onChange={() => set({ vehicleTypeCode: v.code })} />
                  {v.name}
                </label>
              ))}
            </div>
            {catalogLoading && <p className="text-body-sm text-text-sub">Đang tải danh mục phương tiện…</p>}
            {err?.field === 'vehicleTypeCode' && <p className="text-body-sm text-danger">{err.message}</p>}
          </fieldset>

          <TextAreaField label="Mô tả sự cố" placeholder="VD: Xe máy thủng lốp sau, không đi tiếp được" maxLength={500}
            hint={`${descLen}/500 ký tự (tối thiểu 10)`} {...bind('description')} />
          <Field label="Số điện thoại liên hệ" type="tel" inputMode="tel" {...bind('contactPhone')} />

          <div className="flex flex-col gap-2">
            <Field label="Ảnh hiện trường (không bắt buộc)" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading}
              hint={uploading ? 'Đang tải ảnh lên…' : 'JPG, PNG hoặc WebP, tối đa 5 MB'}
              error={err?.field === 'photoUrl' ? err.message : undefined}
              onChange={(e) => uploadPhoto(e.target.files?.[0])} />
            {values.photoUrl && (
              <div className="flex items-center gap-3">
                <img src={values.photoUrl} alt="Ảnh hiện trường" className="h-20 w-20 rounded-control border border-border object-cover" />
                <Button type="button" variant="secondary" size="sm" onClick={() => set({ photoUrl: '' })}>Bỏ ảnh</Button>
              </div>
            )}
          </div>

          <Button block loading={analyzing} loadingText="Đang phân tích…" disabled={uploading || catalogLoading || !!catalogError}>Phân tích & Tìm cứu hộ</Button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={() => setStep('form')} className="self-start text-body-sm text-primary">← Sửa thông tin sự cố</button>
      <h1 className="text-title">Chọn đơn vị cứu hộ</h1>

      <section className={`${CARD} flex flex-col gap-3`} aria-label="Tóm tắt sự cố">
        {classification ? (
          <p className="text-body-sm">
            AI nhận định: <b>{INCIDENT_LABEL[classification.incidentType]}</b> · mức khẩn cấp <b>{URGENCY_LABEL[classification.urgency]}</b>
            {classification.confidence != null && ` (độ tin cậy ${Math.round(classification.confidence * 100)}%)`}
          </p>
        ) : (
          <Alert tone="info">Chưa phân tích tự động được mô tả sự cố. Vui lòng tự chọn loại dịch vụ cần hỗ trợ.</Alert>
        )}
        <p className="line-clamp-2 text-body-sm text-text-sub">“{values.description.trim()}”</p>
        <SelectField label="Loại dịch vụ" value={serviceTypeCode} onChange={(e) => setServiceTypeCode(e.target.value)}>
          <option value="" disabled>Chọn loại dịch vụ…</option>
          {serviceTypes.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </SelectField>
      </section>

      <div className="flex gap-2" role="group" aria-label="Sắp xếp">
        {SORTS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={strategy === key} onClick={() => setStrategy(key)}
            className="h-10 flex-1 rounded-full border border-border bg-surface px-2 text-body-sm aria-pressed:border-primary aria-pressed:bg-status-active-bg aria-pressed:font-semibold aria-pressed:text-status-active-fg">
            {label}
          </button>
        ))}
      </div>

      {pickError && <Alert>{pickError}</Alert>}
      {!serviceTypeCode && <p className="text-center text-text-sub">Chọn loại dịch vụ để xem đơn vị cứu hộ phù hợp.</p>}
      {serviceTypeCode && !candidates && !pickError && <p className="text-center text-text-sub">Đang tìm đơn vị cứu hộ gần bạn…</p>}
      {candidates?.length === 0 && (
        <Alert tone="warning" action={radiusKm < 200
          ? <Button size="sm" variant="secondary" onClick={() => setRadiusKm((r) => Math.min(r + 10, 200))}>Mở rộng lên {Math.min(radiusKm + 10, 200)} km</Button>
          : undefined}>
          Không có đơn vị cứu hộ khả dụng trong bán kính {radiusKm} km.
        </Alert>
      )}

      <div role="radiogroup" aria-label="Đơn vị cứu hộ gợi ý" className="flex flex-col gap-2">
        {candidates?.map((c) => (
          <label key={c.serviceId} className={`${CARD} flex cursor-pointer gap-3 has-checked:border-2 has-checked:border-primary`}>
            <input type="radio" name="candidate" aria-label={`${c.companyName} – ${c.serviceName}`} className="mt-1 size-5 accent-primary" checked={selected?.serviceId === c.serviceId} onChange={() => setSelected(c)} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{c.companyName}</span>
                <span className="whitespace-nowrap font-semibold">{formatVnd(c.price)}</span>
              </div>
              <span className="text-body-sm text-text-sub">{c.serviceName}</span>
              <span className="text-body-sm">
                {c.distanceKm} km · đến trong ~{c.etaMinutes} phút ·{' '}
                {c.rating == null ? <span className="text-text-sub">Chưa có đánh giá</span> : <span>★ {c.rating.toFixed(1)} ({c.ratingCount})</span>}
              </span>
            </div>
          </label>
        ))}
      </div>
      {candidates && candidates.length > 0 && <p className="text-caption text-text-sub">Giá niêm yết ước tính, chi phí thực tế do công ty xác nhận tại hiện trường.</p>}

      <div className="fixed inset-x-0 bottom-0 z-[1000] border-t border-border bg-surface p-4">
        <div className="mx-auto max-w-md">
          <Button block onClick={submit} loading={submitting} loadingText="Đang gửi yêu cầu…" disabled={!selected}>Gửi yêu cầu cứu hộ</Button>
        </div>
      </div>
    </main>
  );
}
