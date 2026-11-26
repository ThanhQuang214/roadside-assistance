// Control dùng chung tạm thời (M2, M3 đang dùng). shortcut: M4 thay bằng bộ UI Kit chính thức, giữ nguyên tên export để không phải sửa trang.
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

export const BTN_PRIMARY = 'h-12 w-full rounded-control bg-primary px-4 text-body font-semibold text-surface disabled:opacity-60';
export const BTN_SECONDARY = 'h-12 rounded-control border border-border bg-surface px-4 text-body font-medium disabled:opacity-60';
/** Nút nhỏ cho bảng/thanh công cụ phân hệ Công ty & Admin (36 px). */
export const BTN_SM = 'h-9 rounded-control border border-border bg-surface px-3 text-body-sm font-medium disabled:opacity-60';
export const BTN_SM_PRIMARY = 'h-9 rounded-control bg-primary px-3 text-body-sm font-semibold text-surface disabled:opacity-60';
export const BTN_SM_DANGER = 'h-9 rounded-control bg-danger px-3 text-body-sm font-semibold text-surface disabled:opacity-60';
export const CARD = 'rounded-card border border-border bg-surface p-4';
export const ALERT_ERROR = 'rounded-control bg-status-closed-bg p-3 text-body-sm text-status-closed-fg';
const CONTROL = 'h-12 rounded-control border border-border bg-surface px-3 text-body focus:outline-2 focus:outline-primary aria-invalid:border-danger disabled:bg-background';

function Labeled({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-label">{label}</label>
      {children}
      {error && <p id={`${id}-err`} className="text-body-sm text-danger">{error}</p>}
    </div>
  );
}

export function Field({ label, error, ...input }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Labeled id={id} label={label} error={error}>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
        className={`${CONTROL} file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-primary`} {...input} />
    </Labeled>
  );
}

export function SelectField({ label, error, children, ...select }: { label: string; error?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Labeled id={id} label={label} error={error}>
      <select id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} className={CONTROL} {...select}>{children}</select>
    </Labeled>
  );
}

/** Snackbar thành công tự ẩn sau 3 giây (UI Guidelines 3.2.1-c). Dùng: const [toast, showToast] = useToast(); … {toast} */
export function useToast() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 3000);
    return () => clearTimeout(t);
  }, [msg]);
  const toast = msg && (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-control bg-status-completed-bg px-4 py-3 text-body-sm font-medium text-status-completed-fg shadow-lg">
      {msg}
    </div>
  );
  return [toast, setMsg] as const;
}

/** Một dòng "nhãn – giá trị" trong thẻ thông tin; đặt trong <dl>. */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 last:border-0">
      <dt className="text-text-sub">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

/** State form + lỗi theo ô. `bind(name)` trả { value, onChange, error } để rải vào <Field>/<SelectField>. */
export function useForm(initial: Record<string, string> = {}) {
  const [values, setValues] = useState(initial);
  const [err, setErr] = useState<{ field: string; message: string } | null>(null);
  const bind = (name: string) => ({
    value: values[name] ?? '',
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })),
    error: err?.field === name ? err.message : undefined,
  });
  return { values, bind, err, setErr };
}
