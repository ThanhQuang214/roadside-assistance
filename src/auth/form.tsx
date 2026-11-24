// Ô nhập + class nút cho các trang auth. shortcut: thay bằng component của M4 (src/shared/ui) khi M4 xong.
import { useId, type InputHTMLAttributes } from 'react';

export const BTN_PRIMARY = 'h-12 w-full rounded-control bg-primary px-4 text-body font-semibold text-surface disabled:opacity-60';
export const BTN_SECONDARY = 'h-12 rounded-control border border-border bg-surface px-4 text-body font-medium';
export const CARD = 'rounded-card border border-border bg-surface p-4';

export function Field({ label, error, ...input }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label">{label}</label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className="h-12 rounded-control border border-border bg-surface px-3 text-body focus:outline-2 focus:outline-primary aria-invalid:border-danger file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-primary"
        {...input}
      />
      {error && <p id={`${id}-err`} className="text-body-sm text-danger">{error}</p>}
    </div>
  );
}
