// UC01 Đăng ký tài khoản (Người gặp sự cố / Công ty cứu hộ) – màn hình A-02 (docs/design/M2-tuan1-xac-thuc.md §3).
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { validateRegister, type FieldError } from './auth-validation.ts';
import { BTN_PRIMARY, BTN_SECONDARY, CARD, Field } from '../shared/ui/form.tsx';
import { ApiError, HOME_BY_ROLE, apiFetch, useAuth } from './session.tsx';

type RegisterRole = 'USER' | 'COMPANY';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<RegisterRole>('USER');
  const [f, setF] = useState<Record<string, string>>({});
  const [err, setErr] = useState<FieldError | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), [err]);

  const set = (name: string, value: string) => setF((prev) => ({ ...prev, [name]: value }));
  const bind = (name: string) => ({
    value: f[name] ?? '',
    onChange: (e: { target: { value: string } }) => set(name, e.target.value),
    error: err?.field === name ? err.message : undefined,
  });

  async function uploadLicense(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      set('company.licenseFileUrl', (await apiFetch('/uploads', { method: 'POST', body: fd })).url);
      setErr(null);
    } catch (e) {
      set('company.licenseFileUrl', '');
      setErr({ field: 'company.licenseFileUrl', message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  function useCurrentLocation() {
    navigator.geolocation?.getCurrentPosition(
      (p) => setF((prev) => ({ ...prev, 'company.stationLat': p.coords.latitude.toFixed(6), 'company.stationLng': p.coords.longitude.toFixed(6) })),
      () => setErr({ field: 'company.stationLat', message: 'Không lấy được vị trí, vui lòng nhập tọa độ.' }),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const company = Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith('company.')).map(([k, v]) => [k.slice(8), v]));
    const body = { role, email: f.email, password: f.password, fullName: f.fullName, phone: f.phone, company: role === 'COMPANY' ? company : undefined };
    const invalid = validateRegister(body)
      ?? (f.confirm !== f.password ? { field: 'confirm', message: 'Mật khẩu nhập lại không khớp.' } : null);
    setErr(invalid);
    if (invalid) return;

    setBusy(true);
    try {
      await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) });
      const user = await login(body.email, body.password);
      navigate(HOME_BY_ROLE[user.role], { replace: true });
    } catch (e) {
      const a = e as ApiError;
      setErr({ field: a.field ?? '', message: a.message });
    } finally {
      setBusy(false);
    }
  }

  const tab = (r: RegisterRole, label: string) => (
    <button type="button" role="tab" aria-selected={role === r} onClick={() => { setRole(r); setErr(null); }}
      className={`h-12 flex-1 rounded-control text-body font-medium ${role === r ? 'bg-primary text-surface' : 'text-text-sub'}`}>
      {label}
    </button>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <h1 className="text-title text-center">Đăng ký tài khoản</h1>
      <div role="tablist" className="flex gap-1 rounded-control border border-border bg-surface p-1">
        {tab('USER', 'Người gặp sự cố')}
        {tab('COMPANY', 'Công ty cứu hộ')}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {err && !err.field && <p role="alert" className="rounded-control bg-status-closed-bg p-3 text-body-sm text-status-closed-fg">{err.message}</p>}

        <fieldset className={`${CARD} flex min-w-0 flex-col gap-4`}>
          <legend className="text-heading">{role === 'COMPANY' ? 'Người đại diện' : 'Thông tin cá nhân'}</legend>
          <Field label="Họ tên" autoComplete="name" {...bind('fullName')} />
          <Field label="Số điện thoại" type="tel" inputMode="numeric" autoComplete="tel" placeholder="0912345678" {...bind('phone')} />
          <Field label="Email" type="email" autoComplete="email" {...bind('email')} />
          <Field label="Mật khẩu (ít nhất 8 ký tự)" type="password" autoComplete="new-password" {...bind('password')} />
          <Field label="Nhập lại mật khẩu" type="password" autoComplete="new-password" {...bind('confirm')} />
        </fieldset>

        {role === 'COMPANY' && (
          <fieldset className={`${CARD} flex min-w-0 flex-col gap-4`}>
            <legend className="text-heading">Hồ sơ công ty</legend>
            <Field label="Tên công ty" {...bind('company.name')} />
            <Field label="Số điện thoại công ty" type="tel" inputMode="numeric" {...bind('company.phone')} />
            <Field label="Địa chỉ trạm cứu hộ" {...bind('company.address')} />
            {/* shortcut: nhập tọa độ tay; đổi sang component chọn vị trí trên bản đồ của M4 khi có. */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vĩ độ trạm" type="number" step="any" {...bind('company.stationLat')} />
              <Field label="Kinh độ trạm" type="number" step="any" {...bind('company.stationLng')} />
            </div>
            <button type="button" onClick={useCurrentLocation} className={BTN_SECONDARY}>Dùng vị trí hiện tại</button>
            <Field label="Bán kính phục vụ (km)" type="number" min={1} {...bind('company.serviceRadiusKm')} />
            <Field label="Số giấy phép kinh doanh" {...bind('company.licenseNumber')} />
            <Field label="Ảnh/PDF giấy phép (≤ 5 MB)" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={uploading} onChange={(e) => uploadLicense(e.target.files?.[0])} error={bind('company.licenseFileUrl').error} />
            {uploading && <p className="text-body-sm text-text-sub">Đang tải lên…</p>}
            {f['company.licenseFileUrl'] && <p className="text-body-sm text-success">Đã tải lên giấy phép.</p>}
            <p className="text-body-sm text-text-sub">Hồ sơ sẽ ở trạng thái <b>Chờ duyệt</b> cho tới khi Quản trị viên thẩm định.</p>
          </fieldset>
        )}

        <button className={BTN_PRIMARY} disabled={busy || uploading}>{busy ? 'Đang gửi…' : role === 'COMPANY' ? 'Gửi hồ sơ đăng ký' : 'Đăng ký'}</button>
      </form>
      <p className="text-center text-body-sm text-text-sub">
        Đã có tài khoản? <Link to="/login" className="font-medium text-primary">Đăng nhập</Link>
      </p>
    </main>
  );
}
