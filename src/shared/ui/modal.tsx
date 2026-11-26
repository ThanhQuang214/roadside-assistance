// UI Kit (M4) – cửa sổ con phụ thuộc (Dependent child screen): <dialog> modal chặn tương tác màn cha tới khi đóng.
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, TextAreaField } from './form.tsx';

/** Hiện khi được render, đóng bằng Esc hoặc onClose. Cha bỏ render để đóng. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby={titleId}
      className="m-auto w-[calc(100%-32px)] max-w-md rounded-card border border-border bg-surface p-6 text-text backdrop:bg-text/40">
      <h2 id={titleId} className="mb-4 text-heading">{title}</h2>
      {children}
    </dialog>
  );
}

type ConfirmProps = {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** Có giá trị → bắt buộc nhập lý do (1–255 ký tự) trước khi xác nhận, vd. "Lý do hủy", "Lý do từ chối". */
  reasonLabel?: string;
  /** Lý do chọn nhanh (UC05 bước 2): chạm để điền vào ô lý do, vẫn sửa được. */
  reasonOptions?: string[];
  /** Ném lỗi → hiện lỗi trong hộp thoại và giữ hộp thoại mở. */
  onConfirm: (reason: string) => unknown;
  onClose: () => void;
};

export function ConfirmDialog({ title, message, confirmLabel, danger, reasonLabel, reasonOptions, onConfirm, onClose }: ConfirmProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (reasonLabel && !reason.trim()) return setError(`Vui lòng nhập ${reasonLabel.toLowerCase()}.`);
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {message && <div className="text-body text-text-sub">{message}</div>}
        {reasonLabel && reasonOptions && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={`${reasonLabel} chọn nhanh`}>
            {reasonOptions.map((o) => (
              <button key={o} type="button" aria-pressed={reason === o} onClick={() => { setReason(o); setError(''); }}
                className="min-h-9 rounded-full border border-border px-3 text-body-sm aria-pressed:border-primary aria-pressed:bg-status-active-bg aria-pressed:text-status-active-fg">
                {o}
              </button>
            ))}
          </div>
        )}
        {reasonLabel ? (
          <TextAreaField label={reasonLabel} autoFocus maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} error={error} />
        ) : error && <p role="alert" className="text-body-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Quay lại</Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" loading={busy}>{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
