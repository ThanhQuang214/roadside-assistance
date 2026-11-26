// UI Kit (M4) – định dạng hiển thị dùng chung (tiền VND, thời gian vi-VN).
export const formatVnd = (n: number | null | undefined) => (n == null ? '–' : `${n.toLocaleString('vi-VN')} đ`);
export const formatDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('vi-VN') : '–');
export const formatTime = (iso: string | null | undefined) =>
  (iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '–');
