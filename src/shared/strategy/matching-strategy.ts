/**
 * Strategy Pattern – xếp hạng công ty cứu hộ (báo cáo mục 3.4.3).
 * CompanyMatcher (Context) giữ một IMatchingStrategy, đổi được lúc chạy theo query `strategy` của
 * GET /api/matching/companies. Lọc (Approved, bán kính, loại dịch vụ) làm ở tầng truy vấn trước khi rank.
 */

export interface CompanyCandidate {
  companyId: number;
  companyName: string;
  serviceId: number;
  serviceName: string;
  price: number;          // VND
  distanceKm: number;
  etaMinutes: number;
  rating: number | null;  // null = chưa có đánh giá
  ratingCount: number;
}

export interface IMatchingStrategy {
  readonly name: MatchingStrategyName;
  /** Trả về mảng MỚI đã sắp xếp, tốt nhất đứng đầu; không sửa mảng đầu vào. */
  rank(candidates: readonly CompanyCandidate[]): CompanyCandidate[];
}

export type MatchingStrategyName = 'nearest' | 'rating' | 'weighted';

/** Ưu tiên gần nhất; hòa thì rẻ hơn trước. */
export class NearestDistanceStrategy implements IMatchingStrategy {
  readonly name = 'nearest';
  rank(candidates: readonly CompanyCandidate[]): CompanyCandidate[] {
    return [...candidates].sort((a, b) => a.distanceKm - b.distanceKm || a.price - b.price);
  }
}

/** Ưu tiên điểm đánh giá cao; chưa có đánh giá xếp cuối; hòa thì nhiều lượt đánh giá hơn, rồi gần hơn. */
export class HighestRatingStrategy implements IMatchingStrategy {
  readonly name = 'rating';
  rank(candidates: readonly CompanyCandidate[]): CompanyCandidate[] {
    return [...candidates].sort((a, b) =>
      (b.rating ?? -1) - (a.rating ?? -1) || b.ratingCount - a.ratingCount || a.distanceKm - b.distanceKm);
  }
}

export interface MatchingWeights {
  eta: number;
  rating: number;
  price: number;
}

/**
 * Điểm tổng hợp = Σ trọng số × giá trị chuẩn hóa về [0, 1] trong chính danh sách ứng viên
 * (ETA, giá: thấp hơn tốt hơn; rating: chia 5, chưa có đánh giá = 0).
 */
export class WeightedScoreStrategy implements IMatchingStrategy {
  readonly name = 'weighted';
  readonly weights: MatchingWeights;

  constructor(weights: MatchingWeights = { eta: 0.5, rating: 0.3, price: 0.2 }) {
    this.weights = weights;
  }

  score(c: CompanyCandidate, all: readonly CompanyCandidate[]): number {
    const w = this.weights;
    return w.eta * lowerIsBetter(c.etaMinutes, all.map((x) => x.etaMinutes))
      + w.rating * (c.rating ?? 0) / 5
      + w.price * lowerIsBetter(c.price, all.map((x) => x.price));
  }

  rank(candidates: readonly CompanyCandidate[]): CompanyCandidate[] {
    const scored = candidates.map((c) => ({ c, s: this.score(c, candidates) }));
    return scored.sort((a, b) => b.s - a.s || a.c.distanceKm - b.c.distanceKm).map((x) => x.c);
  }
}

function lowerIsBetter(value: number, values: number[]): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max === min ? 1 : (max - value) / (max - min);
}

export const MATCHING_STRATEGIES: Record<MatchingStrategyName, IMatchingStrategy> = {
  nearest: new NearestDistanceStrategy(),
  rating: new HighestRatingStrategy(),
  weighted: new WeightedScoreStrategy(),
};

/** Context của Strategy Pattern. */
export class CompanyMatcher {
  private strategy: IMatchingStrategy;

  constructor(strategy: IMatchingStrategy = MATCHING_STRATEGIES.nearest) {
    this.strategy = strategy;
  }

  setStrategy(strategy: IMatchingStrategy): void {
    this.strategy = strategy;
  }

  get strategyName(): MatchingStrategyName { return this.strategy.name; }

  match(candidates: readonly CompanyCandidate[]): CompanyCandidate[] {
    return this.strategy.rank(candidates);
  }
}
