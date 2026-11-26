// UI Kit (M4) – polling định kỳ thay cho thời gian thực (tech stack: 5 giây/lần). Dùng ở S04 và bảng điều phối C-02.
import { useEffect, useRef } from 'react';

/** Gọi `load` ngay khi mount / đổi `deps`, rồi lặp mỗi `ms`; tab bị ẩn thì bỏ lượt; `ms = null` = dừng (vd. đơn đã kết thúc). */
export function usePolling(load: () => unknown, ms: number | null, deps: unknown[] = []) {
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    latest.current();
    if (ms == null) return;
    const t = setInterval(() => { if (!document.hidden) latest.current(); }, ms);
    return () => clearInterval(t);
  }, [ms, ...deps]);
}
