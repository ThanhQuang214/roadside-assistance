import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CompanyMatcher, HighestRatingStrategy, MATCHING_STRATEGIES, NearestDistanceStrategy, WeightedScoreStrategy,
  type CompanyCandidate,
} from './matching-strategy.ts';
import { AverageSpeedEtaEstimator, haversineKm } from './eta-estimator.ts';

const c = (companyId: number, distanceKm: number, etaMinutes: number, price: number, rating: number | null, ratingCount = 1): CompanyCandidate =>
  ({ companyId, companyName: `C${companyId}`, serviceId: companyId, serviceName: 'Vá lốp', price, distanceKm, etaMinutes, rating, ratingCount });

const A = c(1, 2, 15, 300_000, 3.0);    // gần nhất, đắt nhất
const B = c(2, 8, 30, 100_000, 4.8);    // xa, rẻ, đánh giá cao
const C = c(3, 5, 22, 150_000, null, 0); // chưa có đánh giá
const ids = (xs: CompanyCandidate[]) => xs.map((x) => x.companyId);

test('NearestDistance: gần trước, hòa khoảng cách thì rẻ trước', () => {
  assert.deepEqual(ids(new NearestDistanceStrategy().rank([B, C, A])), [1, 3, 2]);
  const A2 = { ...A, companyId: 9, price: 100_000 };
  assert.deepEqual(ids(new NearestDistanceStrategy().rank([A, A2])), [9, 1]);
});

test('HighestRating: chưa có đánh giá xếp cuối', () => {
  assert.deepEqual(ids(new HighestRatingStrategy().rank([C, A, B])), [2, 1, 3]);
});

test('WeightedScore: cân bằng ETA/rating/giá, đổi trọng số thì đổi thứ tự', () => {
  // A = .5·1 + .3·.6 + .2·0 = .68 ; B = 0 + .288 + .2 = .488 ; C = .5·.533 + 0 + .2·.75 = .417
  assert.deepEqual(ids(new WeightedScoreStrategy().rank([C, B, A])), [1, 2, 3]);
  assert.deepEqual(ids(new WeightedScoreStrategy({ eta: 1, rating: 0, price: 0 }).rank([B, C, A])), [1, 3, 2]);
  // Một ứng viên duy nhất: không chia cho 0
  assert.ok(Number.isFinite(new WeightedScoreStrategy().score(A, [A])));
});

test('rank không sửa mảng đầu vào; danh sách rỗng trả rỗng', () => {
  const input = [B, C, A];
  for (const s of Object.values(MATCHING_STRATEGIES)) {
    s.rank(input);
    assert.deepEqual(ids(input), [2, 3, 1]);
    assert.deepEqual(s.rank([]), []);
  }
});

test('CompanyMatcher đổi strategy lúc chạy', () => {
  const matcher = new CompanyMatcher();
  assert.equal(matcher.strategyName, 'nearest');
  assert.equal(matcher.match([B, A])[0].companyId, 1);
  matcher.setStrategy(MATCHING_STRATEGIES.rating);
  assert.equal(matcher.match([B, A])[0].companyId, 2);
});

test('Haversine & ETA trung bình', async () => {
  const hanoi = { lat: 21.0285, lng: 105.8542 };
  const hcm = { lat: 10.8231, lng: 106.6297 };
  assert.ok(Math.abs(haversineKm(hanoi, hcm) - 1137) < 10);
  assert.equal(haversineKm(hanoi, hanoi), 0);

  const eta = new AverageSpeedEtaEstimator(30, 1, 10);
  const r = await eta.estimate(hanoi, { lat: hanoi.lat + 0.09, lng: hanoi.lng }); // ≈ 10.007 km
  assert.equal(r.distanceKm, 10);
  assert.equal(r.etaMinutes, 31); // ceil(10 phút chuẩn bị + 10.007 km / 30 km/h × 60 = 30.01)
});
