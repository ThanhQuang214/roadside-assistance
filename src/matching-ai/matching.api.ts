// MatchingController (UC03 bước 4–5) – api-contract.md §3.3. Mount tại '/api' trong server.ts.
import type { DatabaseSync } from 'node:sqlite';
import { Router } from 'express';
import { getDb } from '../shared/db.ts';
import { HttpError } from '../shared/http.ts';
import { haversineKm, type GeoPoint, type IEtaEstimator } from '../shared/strategy/eta-estimator.ts';
import { CompanyMatcher, MATCHING_STRATEGIES, type CompanyCandidate, type MatchingStrategyName } from '../shared/strategy/matching-strategy.ts';
import { requireRole } from '../auth/auth-middleware.ts';
import { validateLocation } from '../rescue-request/rescue-validation.ts';
import { getEtaEstimator } from './maps-subsystem.ts';

export const matchingAiRouter = Router();

/**
 * Ứng viên = (công ty Approved, gói isActive đúng loại dịch vụ) có trạm nằm trong min(bán kính phục vụ của công ty, radiusKm).
 * Bán kính so theo đường chim bay (vùng phục vụ); distanceKm/etaMinutes trả về là quãng đường thực từ MapsSubsystem.
 * Chưa xếp hạng – CompanyMatcher làm ở bước sau.
 */
export async function findCandidates(db: DatabaseSync, incident: GeoPoint, serviceTypeCode: string, radiusKm: number,
  eta: IEtaEstimator = getEtaEstimator()): Promise<CompanyCandidate[]> {
  const rows = db.prepare(`
    SELECT c.id AS companyId, c.name AS companyName, c.station_lat AS lat, c.station_lng AS lng, c.service_radius_km AS serviceRadiusKm,
           c.rating_avg AS rating, c.rating_count AS ratingCount, s.id AS serviceId, s.name AS serviceName, s.base_price AS price
    FROM rescue_companies c
    JOIN rescue_services s ON s.company_id = c.id AND s.is_active = 1
    JOIN service_types t ON t.id = s.service_type_id
    WHERE c.approval_status = 'Approved' AND t.code = ?`).all(serviceTypeCode) as any[];
  const inRange = rows.filter((r) => haversineKm(r, incident) <= Math.min(r.serviceRadiusKm, radiusKm));
  const estimates = await eta.estimateMany(inRange.map((r) => ({ lat: r.lat, lng: r.lng })), incident);
  return inRange.map((r, i) => ({
    companyId: r.companyId, companyName: r.companyName, serviceId: r.serviceId, serviceName: r.serviceName, price: r.price,
    distanceKm: estimates[i].distanceKm, etaMinutes: estimates[i].etaMinutes, rating: r.rating, ratingCount: r.ratingCount,
  }));
}

matchingAiRouter.get('/matching/companies', ...requireRole('USER'), async (req, res) => {
  const { lat, lng, serviceTypeCode, radiusKm = '20', strategy = 'nearest' } = req.query as Record<string, string | undefined>;
  const loc = validateLocation({ lat, lng });
  if (loc) throw new HttpError(400, 'VALIDATION_ERROR', loc.message, { field: loc.field });
  const db = getDb();
  if (!serviceTypeCode || !db.prepare('SELECT 1 FROM service_types WHERE code = ?').get(serviceTypeCode)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Vui lòng chọn loại dịch vụ.', { field: 'serviceTypeCode' });
  }
  const radius = Number(radiusKm);
  if (!(radius > 0 && radius <= 200)) throw new HttpError(400, 'VALIDATION_ERROR', 'Bán kính tìm kiếm phải từ 1 đến 200 km.', { field: 'radiusKm' });
  if (!(strategy in MATCHING_STRATEGIES)) throw new HttpError(400, 'VALIDATION_ERROR', 'Cách sắp xếp không hợp lệ.', { field: 'strategy' });

  const candidates = await findCandidates(db, { lat: Number(lat), lng: Number(lng) }, serviceTypeCode, radius);
  const matcher = new CompanyMatcher(MATCHING_STRATEGIES[strategy as MatchingStrategyName]);
  res.json({ radiusKm: radius, strategy, items: matcher.match(candidates) });
});

// shortcut: S1 (AISubsystem) làm ở Tuần 3; tới lúc đó luôn trả 503 để UI chạy luồng UC03-4.1 (người dùng tự chọn dịch vụ).
matchingAiRouter.post('/ai/classify', ...requireRole('USER'), () => {
  throw new HttpError(503, 'AI_UNAVAILABLE', 'Chưa phân tích tự động được, vui lòng tự chọn loại dịch vụ.');
});
