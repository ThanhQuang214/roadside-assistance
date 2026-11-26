// MapsSubsystem – phân hệ giao tiếp Actor S2 (Bản đồ), thay cho lớp phân tích MapsBoundary (báo cáo 3.3.1).
// Thiết kế: docs/design/M1-tuan2-ghep-noi-maps.md. Nơi khác chỉ dùng getEtaEstimator(), không gọi OSRM trực tiếp.
import { AverageSpeedEtaEstimator, type Estimate, type GeoPoint, type IEtaEstimator } from '../shared/strategy/eta-estimator.ts';

/** Một tuyến đường do Maps trả về. */
export type Route = { distanceKm: number; durationMinutes: number };

/** Interface của phân hệ: đổi nhà cung cấp bản đồ (OSRM, Google, Mapbox…) chỉ cần cài lại interface này. */
export interface IMapsSubsystem {
  /** Tuyến lái xe từ từng điểm `origins` tới `destination`; null = Maps không tìm được đường. Lỗi mạng/timeout → ném lỗi. */
  routeMany(origins: GeoPoint[], destination: GeoPoint): Promise<(Route | null)[]>;
}

/**
 * OSRM Table API (https://project-osrm.org): 1 request cho cả danh sách trạm.
 * shortcut: mặc định dùng máy chủ demo công khai router.project-osrm.org (lưu lượng thấp, không SLA);
 * chạy thật thì tự host OSRM và đặt OSRM_URL.
 */
export class OsrmMapsSubsystem implements IMapsSubsystem {
  readonly baseUrl: string;
  readonly timeoutMs: number;

  constructor(baseUrl = process.env.OSRM_URL ?? 'https://router.project-osrm.org', timeoutMs = 3000) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async routeMany(origins: GeoPoint[], destination: GeoPoint): Promise<(Route | null)[]> {
    if (origins.length === 0) return [];
    const coords = [destination, ...origins].map((p) => `${p.lng},${p.lat}`).join(';');
    const sources = origins.map((_, i) => i + 1).join(';');
    const r = await fetch(`${this.baseUrl}/table/v1/driving/${coords}?sources=${sources}&destinations=0&annotations=duration,distance`,
      { signal: AbortSignal.timeout(this.timeoutMs) });
    const data = await r.json() as { code: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
    if (!r.ok || data.code !== 'Ok' || !data.durations || !data.distances) throw new Error(`OSRM lỗi: ${data.code ?? r.status}`);
    return origins.map((_, i) => {
      const seconds = data.durations![i]?.[0];
      const meters = data.distances![i]?.[0];
      return seconds == null || meters == null ? null : { distanceKm: meters / 1000, durationMinutes: seconds / 60 };
    });
  }
}

/**
 * IEtaEstimator dựa trên MapsSubsystem: ETA = ceil(dispatchMinutes + thời gian lái xe × trafficFactor).
 * Maps lỗi/timeout → dùng `fallback` cho cả danh sách; Maps không có đường cho 1 trạm → fallback cho trạm đó.
 * shortcut: trafficFactor 1.5 bù việc OSRM tính tốc độ đường thông thoáng (không có dữ liệu kẹt xe).
 */
export class MapsEtaEstimator implements IEtaEstimator {
  readonly maps: IMapsSubsystem;
  readonly fallback: IEtaEstimator;
  readonly dispatchMinutes: number;
  readonly trafficFactor: number;

  constructor(maps: IMapsSubsystem, fallback: IEtaEstimator = new AverageSpeedEtaEstimator(), dispatchMinutes = 10, trafficFactor = 1.5) {
    this.maps = maps;
    this.fallback = fallback;
    this.dispatchMinutes = dispatchMinutes;
    this.trafficFactor = trafficFactor;
  }

  async estimate(from: GeoPoint, to: GeoPoint): Promise<Estimate> {
    return (await this.estimateMany([from], to))[0];
  }

  async estimateMany(from: GeoPoint[], to: GeoPoint): Promise<Estimate[]> {
    let routes: (Route | null)[];
    try {
      routes = await this.maps.routeMany(from, to);
    } catch (e) {
      console.warn('MapsSubsystem không phản hồi, dùng ước tính đường chim bay:', (e as Error).message);
      return this.fallback.estimateMany(from, to);
    }
    return Promise.all(routes.map((route, i) => route
      ? {
        distanceKm: Math.round(route.distanceKm * 10) / 10,
        etaMinutes: Math.ceil(this.dispatchMinutes + route.durationMinutes * this.trafficFactor),
      }
      : this.fallback.estimate(from[i], to)));
  }
}

let instance: IEtaEstimator | undefined;

/** Estimator dùng chung cho ghép nối (UC03) và tạo đơn. MAPS_PROVIDER=offline → chỉ đường chim bay (test, máy không có mạng). */
export function getEtaEstimator(): IEtaEstimator {
  return (instance ??= process.env.MAPS_PROVIDER === 'offline'
    ? new AverageSpeedEtaEstimator()
    : new MapsEtaEstimator(new OsrmMapsSubsystem()));
}
