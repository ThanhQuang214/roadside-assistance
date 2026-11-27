// UC08 Quản lý thông tin & dịch vụ cứu hộ – CompanyProfileAndServiceView, màn hình C-01 (docs/design/M3-tuan1-cong-ty-admin.md §3).
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { FieldError } from '../auth/auth-validation.ts';
import { apiFetch, type ApiError } from '../auth/session.tsx';
import { ALERT_ERROR, Alert, useToast } from '../shared/ui/feedback.tsx';
import { BTN_SM, BTN_SM_PRIMARY, Button, CARD, Field, InfoRow, SelectField, useForm } from '../shared/ui/form.tsx';
import { LocationPicker } from '../shared/ui/map.tsx';
import { ConfirmDialog } from '../shared/ui/modal.tsx';
import { ApprovalChip, type ApprovalStatus } from './ApprovalChip.tsx';
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABEL, validateCompanyProfile, validateService, validateVehicle } from './company-validation.ts';

export type Company = {
  id: number; name: string; phone: string; address: string; licenseNumber: string; licenseFileUrl: string;
  stationLat: number; stationLng: number; serviceRadiusKm: number; approvalStatus: ApprovalStatus;
  rejectReason: string | null; approvedAt: string | null; ratingAvg: number | null; ratingCount: number; createdAt: string;
};
type Service = { id: number; serviceTypeCode: string; name: string; description: string | null; basePrice: number; isActive: boolean };
type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
type Vehicle = { id: number; kind: string; plateNumber: string; status: VehicleStatus };
type ShowToast = (msg: string) => void;

const formatVnd = (n: number) => `${n.toLocaleString('vi-VN')} đ`;
const toFieldError = (e: unknown): FieldError => ({ field: (e as ApiError).field ?? '', message: (e as Error).message });
const TABLE_WRAP = 'overflow-x-auto rounded-card border border-border bg-surface';
const TH = 'px-4 py-3 font-medium';

const ErrorBanner = ({ err }: { err: FieldError | null }) =>
  err && !err.field ? <p role="alert" className={`md:col-span-2 ${ALERT_ERROR}`}>{err.message}</p> : null;

export default function CompanyManagePage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<'profile' | 'services' | 'vehicles'>('profile');
  const [toast, showToast] = useToast();

  useEffect(() => {
    apiFetch('/companies/me').then((d) => setCompany(d.company), (e) => setLoadError(e.message));
  }, []);

  if (loadError) return <p role="alert" className={`m-6 ${ALERT_ERROR}`}>{loadError}</p>;
  if (!company) return <p className="p-6 text-text-sub">Đang tải…</p>;
  const approved = company.approvalStatus === 'Approved';

  const tabButton = (key: typeof tab, label: string) => (
    <button role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
      className={`h-10 border-b-2 px-4 text-body font-medium ${tab === key ? 'border-primary text-primary' : 'border-transparent text-text-sub'}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-heading">{company.name}</span>
          <ApprovalChip status={company.approvalStatus} />
        </div>
        <div className="flex items-center gap-4">
          {approved && <Link to="/company/dispatch" className="text-body-sm font-medium text-primary">Điều phối đơn cứu hộ</Link>}
          <Link to="/account" className="text-body-sm font-medium text-primary">Tài khoản</Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <h1 className="text-title">Quản lý thông tin & dịch vụ cứu hộ</h1>
        {company.approvalStatus === 'Pending' && (
          <Alert tone="warning">
            Hồ sơ đang chờ Quản trị viên thẩm định. Sau khi được duyệt, bạn mới quản lý được gói dịch vụ, phương tiện và nhận đơn cứu hộ.
          </Alert>
        )}
        {company.approvalStatus === 'Rejected' && (
          <Alert>Hồ sơ bị từ chối. Lý do: {company.rejectReason}</Alert>
        )}

        {approved && (
          <div role="tablist" className="flex border-b border-border">
            {tabButton('profile', 'Hồ sơ & phạm vi')}
            {tabButton('services', 'Gói dịch vụ')}
            {tabButton('vehicles', 'Phương tiện')}
          </div>
        )}
        {(!approved || tab === 'profile') && (
          <ProfilePanel company={company} readOnly={!approved} onSaved={(c) => { setCompany(c); showToast('Đã lưu hồ sơ công ty'); }} />
        )}
        {approved && tab === 'services' && <ServicesPanel showToast={showToast} />}
        {approved && tab === 'vehicles' && <VehiclesPanel showToast={showToast} />}
      </main>
      {toast}
    </div>
  );
}

// ---------- Hồ sơ & phạm vi hoạt động (UC08-3c) ----------

const PROFILE_KEYS = ['name', 'phone', 'address', 'stationLat', 'stationLng', 'serviceRadiusKm'] as const;

function ProfilePanel({ company, readOnly, onSaved }: { company: Company; readOnly: boolean; onSaved: (c: Company) => void }) {
  const f = useForm(Object.fromEntries(PROFILE_KEYS.map((k) => [k, String(company[k])])));
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateCompanyProfile(f.values);
    f.setErr(invalid);
    if (invalid) return;
    setBusy(true);
    try {
      onSaved((await apiFetch('/companies/me', { method: 'PUT', body: JSON.stringify(f.values) })).company);
    } catch (err) {
      f.setErr(toFieldError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={`${CARD} grid gap-4 md:grid-cols-2`}>
      <ErrorBanner err={f.err} />
      <Field label="Tên công ty" disabled={readOnly} {...f.bind('name')} />
      <Field label="Số điện thoại công ty" type="tel" disabled={readOnly} {...f.bind('phone')} />
      <div className="md:col-span-2"><Field label="Địa chỉ trạm cứu hộ" disabled={readOnly} {...f.bind('address')} /></div>
      <div className="md:col-span-2">
        <LocationPicker label="Vị trí trạm cứu hộ" disabled={readOnly} error={f.bind('stationLat').error}
          value={{ lat: Number(f.values.stationLat), lng: Number(f.values.stationLng) }}
          onChange={(p) => f.set({ stationLat: String(p.lat), stationLng: String(p.lng) })} />
      </div>
      <Field label="Bán kính phục vụ (km)" type="number" min={1} disabled={readOnly} {...f.bind('serviceRadiusKm')} />
      <dl className="md:col-span-2">
        <InfoRow label="Số giấy phép kinh doanh" value={<a href={company.licenseFileUrl} target="_blank" className="text-primary">{company.licenseNumber}</a>} />
        <InfoRow label="Đánh giá trung bình" value={company.ratingAvg == null ? 'Chưa có đánh giá' : `${company.ratingAvg.toFixed(1)} ★ (${company.ratingCount} lượt)`} />
      </dl>
      {!readOnly && (
        <div className="flex justify-end md:col-span-2">
          <Button size="sm" loading={busy} loadingText="Đang lưu…">Lưu thay đổi</Button>
        </div>
      )}
    </form>
  );
}

// ---------- Gói dịch vụ & giá (UC08-3a, 5.1, 5.2) ----------

function ServicesPanel({ showToast }: { showToast: ShowToast }) {
  const [items, setItems] = useState<Service[] | null>(null);
  const [types, setTypes] = useState<{ code: string; name: string }[]>([]);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [error, setError] = useState<{ message: string; inUse?: Service } | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);

  const load = () => apiFetch('/companies/me/services').then((d) => setItems(d.items), (e) => setError({ message: e.message }));
  useEffect(() => {
    load();
    apiFetch('/catalog/service-types').then((d) => setTypes(d.items), (e) => setError({ message: e.message }));
  }, []);

  async function save(s: Service, isActive: boolean) {
    try {
      await apiFetch(`/companies/me/services/${s.id}`, { method: 'PUT', body: JSON.stringify({ ...s, isActive }) });
      setError(null);
      showToast(isActive ? 'Đã mở lại gói dịch vụ' : 'Đã chuyển gói sang Ngừng cung cấp');
      load();
    } catch (e) {
      setError({ message: (e as Error).message });
    }
  }

  async function remove(s: Service) {
    try {
      await apiFetch(`/companies/me/services/${s.id}`, { method: 'DELETE' });
      setDeleting(null);
      setError(null);
      showToast('Đã xóa gói dịch vụ');
      load();
    } catch (e) {
      if ((e as ApiError).code !== 'CONFLICT') throw e;
      setDeleting(null);
      setError({ message: (e as Error).message, inUse: s });
    }
  }

  const typeName = (code: string) => types.find((t) => t.code === code)?.name ?? code;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-heading">Gói dịch vụ & giá niêm yết</h2>
        {!editing && <button className={BTN_SM_PRIMARY} onClick={() => setEditing('new')}>+ Thêm gói</button>}
      </div>
      {error && (
        <Alert action={error.inUse && <button className={BTN_SM} onClick={() => save(error.inUse!, false)}>Ngừng cung cấp</button>}>
          {error.message}
        </Alert>
      )}
      {deleting && (
        <ConfirmDialog title="Xóa gói dịch vụ" danger confirmLabel="Xóa gói" onClose={() => setDeleting(null)} onConfirm={() => remove(deleting)}
          message={<>Xóa gói <b>{deleting.name}</b>? Gói đã có đơn cứu hộ sẽ không xóa được, khi đó hãy chuyển sang "Ngừng cung cấp".</>} />
      )}
      {editing && (
        <ServiceForm key={editing === 'new' ? 'new' : editing.id} service={editing === 'new' ? null : editing} types={types}
          onCancel={() => setEditing(null)} onSaved={(msg) => { setEditing(null); setError(null); showToast(msg); load(); }} />
      )}
      <div className={TABLE_WRAP}>
        <table className="w-full text-left text-body-sm">
          <thead className="text-text-sub">
            <tr className="border-b border-border"><th className={TH}>Loại dịch vụ</th><th className={TH}>Tên gói</th><th className={TH}>Giá niêm yết</th><th className={TH}>Trạng thái</th><th className={TH} /></tr>
          </thead>
          <tbody>
            {items?.map((s) => (
              <tr key={s.id} className="h-12 border-b border-border last:border-0">
                <td className="px-4">{typeName(s.serviceTypeCode)}</td>
                <td className="px-4 py-2">{s.name}{s.description && <p className="text-caption text-text-sub">{s.description}</p>}</td>
                <td className="px-4 whitespace-nowrap">{formatVnd(s.basePrice)}</td>
                <td className="px-4">{s.isActive ? <span className="text-success">Đang cung cấp</span> : <span className="text-text-sub">Ngừng cung cấp</span>}</td>
                <td className="px-4">
                  <div className="flex justify-end gap-2">
                    <button className={BTN_SM} onClick={() => setEditing(s)}>Sửa</button>
                    <button className={`${BTN_SM} text-danger`} onClick={() => setDeleting(s)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items?.length === 0 && <p className="p-6 text-center text-text-sub">Chưa có gói dịch vụ nào. Thêm gói để công ty xuất hiện trong danh sách gợi ý cứu hộ.</p>}
        {!items && <p className="p-6 text-center text-text-sub">Đang tải…</p>}
      </div>
    </section>
  );
}

function ServiceForm({ service, types, onCancel, onSaved }: {
  service: Service | null; types: { code: string; name: string }[]; onCancel: () => void; onSaved: (msg: string) => void;
}) {
  const f = useForm(service
    ? { serviceTypeCode: service.serviceTypeCode, name: service.name, description: service.description ?? '', basePrice: String(service.basePrice), isActive: String(service.isActive) }
    : {});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = { ...f.values, basePrice: Number(f.values.basePrice), isActive: f.values.isActive !== 'false' };
    const invalid = validateService(body, service ? 'update' : 'create');
    f.setErr(invalid);
    if (invalid) return;
    setBusy(true);
    try {
      await apiFetch(service ? `/companies/me/services/${service.id}` : '/companies/me/services', { method: service ? 'PUT' : 'POST', body: JSON.stringify(body) });
      onSaved(service ? 'Đã cập nhật gói dịch vụ' : 'Đã thêm gói dịch vụ');
    } catch (err) {
      f.setErr(toFieldError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={`${CARD} grid gap-4 md:grid-cols-2`}>
      <h3 className="text-heading md:col-span-2">{service ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}</h3>
      <ErrorBanner err={f.err} />
      <SelectField label="Loại dịch vụ" disabled={!!service} {...f.bind('serviceTypeCode')}>
        <option value="">— Chọn loại dịch vụ —</option>
        {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
      </SelectField>
      <Field label="Tên gói" {...f.bind('name')} />
      <Field label="Giá niêm yết (VND)" type="number" min={1} step={1000} {...f.bind('basePrice')} />
      {service && (
        <SelectField label="Trạng thái" {...f.bind('isActive')}>
          <option value="true">Đang cung cấp</option>
          <option value="false">Ngừng cung cấp</option>
        </SelectField>
      )}
      <div className="md:col-span-2"><Field label="Mô tả (không bắt buộc)" {...f.bind('description')} /></div>
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" className={BTN_SM} onClick={onCancel}>Hủy</button>
        <button className={BTN_SM_PRIMARY} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </form>
  );
}

// ---------- Phương tiện cứu hộ (UC08-3b) ----------

function VehiclesPanel({ showToast }: { showToast: ShowToast }) {
  const [items, setItems] = useState<Vehicle[] | null>(null);
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null);
  const [error, setError] = useState('');

  const load = () => apiFetch('/companies/me/vehicles').then((d) => setItems(d.items), (e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function changeStatus(v: Vehicle, status: string) {
    try {
      await apiFetch(`/companies/me/vehicles/${v.id}`, { method: 'PUT', body: JSON.stringify({ ...v, status }) });
      setError('');
      showToast(`Đã cập nhật trạng thái xe ${v.plateNumber}`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-heading">Phương tiện cứu hộ</h2>
        {!editing && <button className={BTN_SM_PRIMARY} onClick={() => setEditing('new')}>+ Thêm phương tiện</button>}
      </div>
      {error && <Alert>{error}</Alert>}
      {editing && (
        <VehicleForm key={editing === 'new' ? 'new' : editing.id} vehicle={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)} onSaved={(msg) => { setEditing(null); setError(''); showToast(msg); load(); }} />
      )}
      <div className={TABLE_WRAP}>
        <table className="w-full text-left text-body-sm">
          <thead className="text-text-sub">
            <tr className="border-b border-border"><th className={TH}>Loại xe / thiết bị</th><th className={TH}>Biển số</th><th className={TH}>Trạng thái</th><th className={TH} /></tr>
          </thead>
          <tbody>
            {items?.map((v) => (
              <tr key={v.id} className="h-12 border-b border-border last:border-0">
                <td className="px-4">{v.kind}</td>
                <td className="px-4 font-medium">{v.plateNumber}</td>
                <td className="px-4">
                  <select aria-label={`Trạng thái xe ${v.plateNumber}`} value={v.status} onChange={(e) => changeStatus(v, e.target.value)}
                    className="h-9 rounded-control border border-border bg-surface px-2 text-body-sm">
                    {VEHICLE_STATUSES.map((s) => <option key={s} value={s}>{VEHICLE_STATUS_LABEL[s]}</option>)}
                  </select>
                </td>
                <td className="px-4 text-right"><button className={BTN_SM} onClick={() => setEditing(v)}>Sửa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {items?.length === 0 && <p className="p-6 text-center text-text-sub">Chưa khai báo phương tiện nào.</p>}
        {!items && <p className="p-6 text-center text-text-sub">Đang tải…</p>}
      </div>
    </section>
  );
}

function VehicleForm({ vehicle, onCancel, onSaved }: { vehicle: Vehicle | null; onCancel: () => void; onSaved: (msg: string) => void }) {
  const f = useForm(vehicle ? { kind: vehicle.kind, plateNumber: vehicle.plateNumber, status: vehicle.status } : { status: 'Available' });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateVehicle(f.values, vehicle ? 'update' : 'create');
    f.setErr(invalid);
    if (invalid) return;
    setBusy(true);
    try {
      await apiFetch(vehicle ? `/companies/me/vehicles/${vehicle.id}` : '/companies/me/vehicles', { method: vehicle ? 'PUT' : 'POST', body: JSON.stringify(f.values) });
      onSaved(vehicle ? 'Đã cập nhật phương tiện' : 'Đã thêm phương tiện');
    } catch (err) {
      f.setErr(toFieldError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={`${CARD} grid gap-4 md:grid-cols-3`}>
      <h3 className="text-heading md:col-span-3">{vehicle ? 'Sửa phương tiện' : 'Thêm phương tiện'}</h3>
      {f.err && !f.err.field && <p role="alert" className={`md:col-span-3 ${ALERT_ERROR}`}>{f.err.message}</p>}
      <Field label="Loại xe / thiết bị" placeholder="Xe cẩu kéo 3.5T" {...f.bind('kind')} />
      <Field label="Biển số / mã phương tiện" placeholder="29C-123.45" {...f.bind('plateNumber')} />
      <SelectField label="Trạng thái" {...f.bind('status')}>
        {VEHICLE_STATUSES.map((s) => <option key={s} value={s}>{VEHICLE_STATUS_LABEL[s]}</option>)}
      </SelectField>
      <div className="flex justify-end gap-2 md:col-span-3">
        <button type="button" className={BTN_SM} onClick={onCancel}>Hủy</button>
        <button className={BTN_SM_PRIMARY} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </form>
  );
}
