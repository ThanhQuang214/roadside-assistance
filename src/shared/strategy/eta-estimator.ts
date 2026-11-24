/**
 * Strategy Pattern – ước tính khoảng cách / ETA. Tuần 1 dùng đường chim bay;
 * Tuần 2 thêm MapsEtaEstimator (gọi MapsSubsystem/S2) cài cùng interface, không đổi nơi gọi.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface IEtaEstimator {
  /** Trả về khoảng cách (km) và ETA (phút, làm tròn lên) từ trạm công ty tới điểm sự cố. */
  estimate(from: GeoPoint, to: GeoPoint): Promise<{ distanceKm: number; etaMinutes: number }>;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Khoảng cách đường chim bay (Haversine), km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * ETA = thời gian chuẩn bị + quãng đường × hệ số đường vòng / vận tốc trung bình.
 * shortcut: tham số mặc định là giả định nội đô (30 km/h, đường thực ≈ 1.3 × chim bay, chuẩn bị 10 phút),
 * thay bằng MapsEtaEstimator ở Tuần 2.
 */
export class AverageSpeedEtaEstimator implements IEtaEstimator {
  readonly speedKmh: number;
  readonly detourFactor: number;
  readonly dispatchMinutes: number;

  constructor(speedKmh = 30, detourFactor = 1.3, dispatchMinutes = 10) {
    this.speedKmh = speedKmh;
    this.detourFactor = detourFactor;
    this.dispatchMinutes = dispatchMinutes;
  }

  async estimate(from: GeoPoint, to: GeoPoint) {
    const distanceKm = haversineKm(from, to) * this.detourFactor;
    const etaMinutes = Math.ceil(this.dispatchMinutes + (distanceKm / this.speedKmh) * 60);
    return { distanceKm: Math.round(distanceKm * 10) / 10, etaMinutes };
  }
}
