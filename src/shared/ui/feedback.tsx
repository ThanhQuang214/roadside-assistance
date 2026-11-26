// UI Kit (M4) – thông báo & trạng thái theo UI Guidelines 3.2.1-b, c.
import { useEffect, useState, type ReactNode } from 'react';
import type { RescueStatus } from '../state/rescue-request-state.ts';

// ---------- Banner / thông báo inline ----------

const ALERT_TONE = {
  error: 'bg-status-closed-bg text-status-closed-fg',
  warning: 'bg-status-pending-bg text-status-pending-fg',
  info: 'bg-status-active-bg text-status-active-fg',
  success: 'bg-status-completed-bg text-status-completed-fg',
};
export const ALERT_ERROR = `rounded-control p-3 text-body-sm ${ALERT_TONE.error}`;

/** Banner trong trang. `action` = nút khắc phục bên phải (vd. "Tải lại", "Ngừng cung cấp"). */
export function Alert({ tone = 'error', action, children }: { tone?: keyof typeof ALERT_TONE; action?: ReactNode; children: ReactNode }) {
  return (
    <div role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={`flex items-center justify-between gap-3 rounded-control p-3 text-body-sm ${ALERT_TONE[tone]}`}>
      <span>{children}</span>
      {action}
    </div>
  );
}

// ---------- Status chip: nền nhạt + chữ đậm + LUÔN có nhãn chữ ----------

export type ChipTone = 'pending' | 'active' | 'completed' | 'closed';
const CHIP_TONE: Record<ChipTone, string> = {
  pending: 'bg-status-pending-bg text-status-pending-fg',
  active: 'bg-status-active-bg text-status-active-fg',
  completed: 'bg-status-completed-bg text-status-completed-fg',
  closed: 'bg-status-closed-bg text-status-closed-fg',
};

export function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-label ${CHIP_TONE[tone]}`}>{children}</span>;
}

/** Nhãn tiếng Việt + màu cho 6 trạng thái đơn cứu hộ (api-contract §2). */
export const RESCUE_STATUS_UI: Record<RescueStatus, { label: string; tone: ChipTone }> = {
  Pending: { label: 'Chờ tiếp nhận', tone: 'pending' },
  Accepted: { label: 'Đã tiếp nhận', tone: 'active' },
  InProgress: { label: 'Đang xử lý', tone: 'active' },
  Completed: { label: 'Hoàn tất', tone: 'completed' },
  Cancelled: { label: 'Đã hủy', tone: 'closed' },
  Rejected: { label: 'Bị từ chối', tone: 'closed' },
};

export function RescueStatusChip({ status }: { status: RescueStatus }) {
  return <StatusChip tone={RESCUE_STATUS_UI[status].tone}>{RESCUE_STATUS_UI[status].label}</StatusChip>;
}

// ---------- Toast & banner mất mạng (z-index trên bản đồ Leaflet ≤ 1000) ----------

/** Snackbar thành công tự ẩn sau 3 giây. Dùng: const [toast, showToast] = useToast(); … {toast} */
export function useToast() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 3000);
    return () => clearTimeout(t);
  }, [msg]);
  const toast = msg && (
    <div role="status" className="fixed bottom-6 left-1/2 z-[1100] -translate-x-1/2 rounded-control bg-status-completed-bg px-4 py-3 text-body-sm font-medium text-status-completed-fg shadow-lg">
      {msg}
    </div>
  );
  return [toast, setMsg] as const;
}

/** Banner cố định đầu trang khi mất mạng. Đặt một lần ở main.tsx. */
export function NetworkBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[1100] bg-status-pending-bg p-2 text-center text-body-sm font-medium text-status-pending-fg">
      Đã mất kết nối mạng. Đang chờ kết nối lại...
    </div>
  );
}
