// UI Kit (M4) – nút, ô nhập, thẻ thông tin. Theo UI Guidelines 3.2.1 và design-tokens.css; danh mục: /ui-kit, docs/design/M4-tuan1-ui-kit.md.
import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

// ---------- Nút: Primary (gửi/tiếp tục), Secondary (trở lại/xem thêm), Danger (hủy/xóa); luôn có default/loading/disabled ----------

const BTN_BASE = 'inline-flex items-center justify-center gap-2 rounded-control font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60';
const VARIANT = {
  primary: 'bg-primary text-surface',
  secondary: 'border border-border bg-surface',
  danger: 'bg-danger text-surface',
};
const SIZE = {
  xl: 'h-14 px-6 text-heading',      // 56 px – nút "Gọi cứu hộ ngay" (S01)
  lg: 'h-12 px-4 text-body',         // 48 px – mặc định, thao tác ngoài trời
  sm: 'h-9 px-3 text-body-sm',       // 36 px – bảng/thanh công cụ phân hệ Công ty & Admin
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  block?: boolean;
  /** Đang xử lý: khóa nút (chống gửi trùng) và đổi nhãn thành loadingText. */
  loading?: boolean;
  loadingText?: string;
};

export function Button({ variant = 'primary', size = 'lg', block, loading, loadingText = 'Đang xử lý…', className = '', disabled, children, ...rest }: ButtonProps) {
  return (
    <button className={`${BTN_BASE} ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? loadingText : children}
    </button>
  );
}

/** Class của Button cho phần tử không phải <button> (vd. <Link> trông như nút). */
export const buttonClass = (variant: keyof typeof VARIANT = 'primary', size: keyof typeof SIZE = 'lg') => `${BTN_BASE} ${VARIANT[variant]} ${SIZE[size]}`;
export const BTN_PRIMARY = `${buttonClass('primary')} w-full`;
export const BTN_SECONDARY = buttonClass('secondary');
export const BTN_SM = buttonClass('secondary', 'sm');
export const BTN_SM_PRIMARY = buttonClass('primary', 'sm');
export const BTN_SM_DANGER = buttonClass('danger', 'sm');

// ---------- Ô nhập: label luôn hiện, placeholder chỉ là gợi ý, lỗi đỏ ngay dưới ô ----------

export const CARD = 'rounded-card border border-border bg-surface p-4';
const CONTROL = 'rounded-control border border-border bg-surface px-3 text-body focus:outline-2 focus:outline-primary aria-invalid:border-danger disabled:bg-background disabled:text-text-sub';

function Labeled({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-label">{label}</label>
      {children}
      {error ? <p id={`${id}-err`} className="text-body-sm text-danger">{error}</p>
        : hint && <p id={`${id}-err`} className="text-caption text-text-sub">{hint}</p>}
    </div>
  );
}

type Common = { label: string; error?: string; hint?: string };
const describe = (id: string, c: Common) => ({ 'aria-invalid': !!c.error, 'aria-describedby': c.error || c.hint ? `${id}-err` : undefined });

export function Field({ label, error, hint, ...input }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Labeled id={id} label={label} error={error} hint={hint}>
      <input id={id} {...describe(id, { label, error, hint })}
        className={`${CONTROL} h-12 file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-primary`} {...input} />
    </Labeled>
  );
}

export function SelectField({ label, error, hint, children, ...select }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Labeled id={id} label={label} error={error} hint={hint}>
      <select id={id} {...describe(id, { label, error, hint })} className={`${CONTROL} h-12`} {...select}>{children}</select>
    </Labeled>
  );
}

export function TextAreaField({ label, error, hint, ...area }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Labeled id={id} label={label} error={error} hint={hint}>
      <textarea id={id} rows={4} {...describe(id, { label, error, hint })} className={`${CONTROL} py-3`} {...area} />
    </Labeled>
  );
}

/** State form + lỗi theo ô. `bind(name)` trả { value, onChange, error } để rải vào Field/SelectField/TextAreaField. */
export function useForm(initial: Record<string, string> = {}) {
  const [values, setValues] = useState(initial);
  const [err, setErr] = useState<{ field: string; message: string } | null>(null);
  const bind = (name: string) => ({
    value: values[name] ?? '',
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })),
    error: err?.field === name ? err.message : undefined,
  });
  /** Gán nhiều ô cùng lúc (vd. vĩ độ + kinh độ từ bản đồ). */
  const set = (patch: Record<string, string>) => setValues((v) => ({ ...v, ...patch }));
  return { values, bind, set, err, setErr };
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
