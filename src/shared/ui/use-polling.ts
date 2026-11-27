// UI Kit (M4) – polling định kỳ thay cho thời gian thực (tech stack: 5 giây/lần). Dùng ở S04 và bảng điều phối C-02.
import { useEffect, useRef } from 'react';

/** Gọi `load` ngay khi mount / đổi `deps`, rồi lặp mỗi `ms`; tab bị ẩn thì bỏ lượt; `ms = null` = dừng (vd. đơn đã kết thúc). */
export function usePolling(load: () => unknown, ms: number | null, deps: unknown[] = []) {
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        await latest.current();
      } finally {
        running = false;
      }
    };
    run();
    if (ms == null) return;
    // Không tạo nhiều request chồng nhau khi mạng chậm hơn chu kỳ polling.
    const t = setInterval(() => { if (!document.hidden) run(); }, ms);
    return () => clearInterval(t);
  }, [ms, ...deps]);
}
