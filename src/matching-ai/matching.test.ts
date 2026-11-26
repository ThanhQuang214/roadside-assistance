import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { errorHandler } from '../shared/http.ts';
import { getDb, openDb } from '../shared/db.ts';
import { AverageSpeedEtaEstimator } from '../shared/strategy/eta-estimator.ts';
import { signToken } from '../auth/auth-middleware.ts';
import { MapsEtaEstimator, OsrmMapsSubsystem, type IMapsSubsystem } from './maps-subsystem.ts';
import { findCandidates, matchingAiRouter } from './matching.api.ts';

process.env.DB_PATH = ':memory:';
process.env.MAPS_PROVIDER = 'offline'; // không gọi OSRM thật khi test

const incident = { lat: 21.0285, lng: 105.8542 };
const fallback = new AverageSpeedEtaEstimator(30, 1, 10);

test('MapsEtaEstimator: ETA = ceil(10 + phút lái × 1.5); không có đường → fallback cho trạm đó; Maps lỗi → fallback cả danh sách', async () => {
  const ok: IMapsSubsystem = { routeMany: async (o) => o.map((_, i) => (i === 1 ? null : { distanceKm: 8.12, durationMinutes: 12 })) };
  const [a, b] = await new MapsEtaEstimator(ok, fallback).estimateMany([incident, { lat: 21.1185, lng: 105.8542 }], incident);
  assert.deepEqual(a, { distanceKm: 8.1, etaMinutes: 28 });
  assert.deepEqual(b, { distanceKm: 10, etaMinutes: 31 }); // fallback: 10 km chim bay / 30 km/h + 10 phút

  const down: IMapsSubsystem = { routeMany: async () => { throw new Error('timeout'); } };
  assert.deepEqual(await new MapsEtaEstimator(down, fallback).estimate(incident, incident), { distanceKm: 0, etaMinutes: 10 });
});

test('OsrmMapsSubsystem: gọi Table API đúng tọa độ (lng,lat; điểm sự cố là destination 0), đọc null; quá timeout → ném lỗi', async () => {
  let url = '';
  const osrm = createServer((req, res) => {
    url = req.url!;
    if (url.includes('slow')) return; // không trả lời
    res.end(JSON.stringify({ code: 'Ok', durations: [[600], [null]], distances: [[5000], [null]] }));
  }).listen(0);
  after(() => osrm.close());
  const base = `http://localhost:${(osrm.address() as AddressInfo).port}`;

  const routes = await new OsrmMapsSubsystem(base).routeMany([{ lat: 21, lng: 105.8 }, { lat: 21.1, lng: 105.9 }], incident);
  assert.equal(url, '/table/v1/driving/105.8542,21.0285;105.8,21;105.9,21.1?sources=1;2&destinations=0&annotations=duration,distance');
  assert.deepEqual(routes, [{ distanceKm: 5, durationMinutes: 10 }, null]);
  assert.deepEqual(await new OsrmMapsSubsystem(base).routeMany([], incident), []);
  await assert.rejects(new OsrmMapsSubsystem(`${base}/slow`, 50).routeMany([incident], incident));
});

function seed(db = getDb()) {
  db.exec(`
    INSERT INTO users (id, email, phone, password_hash, full_name, role) VALUES
      (1, 'u@t.vn', '0900000001', 'x', 'Người dùng', 'USER'),
      (2, 'a@t.vn', '0900000002', 'x', 'A', 'COMPANY'), (3, 'b@t.vn', '0900000003', 'x', 'B', 'COMPANY'),
      (4, 'c@t.vn', '0900000004', 'x', 'C', 'COMPANY'), (5, 'd@t.vn', '0900000005', 'x', 'D', 'COMPANY');
    INSERT INTO rescue_companies (id, user_id, name, phone, address, license_number, license_file_url,
      station_lat, station_lng, service_radius_km, approval_status, rating_avg, rating_count) VALUES
      (1, 2, 'Gần, điểm thấp', '0241', 'HN', 'GP1', '/f', 21.0375, 105.8542, 10, 'Approved', 3.0, 4),   -- ~1 km
      (2, 3, 'Xa, điểm cao', '0242', 'HN', 'GP2', '/f', 21.0735, 105.8542, 30, 'Approved', 4.9, 10),    -- ~5 km
      (3, 4, 'Chưa duyệt', '0243', 'HN', 'GP3', '/f', 21.0285, 105.8550, 30, 'Pending', NULL, 0),
      (4, 5, 'Bán kính nhỏ', '0244', 'HN', 'GP4', '/f', 21.1185, 105.8542, 5, 'Approved', NULL, 0);    -- ~10 km > 5
    INSERT INTO rescue_services (company_id, service_type_id, name, base_price, is_active) VALUES
      (1, 2, 'Vá lốp A', 100000, 1), (1, 3, 'Ắc quy A', 200000, 1), (2, 2, 'Vá lốp B', 80000, 1), (2, 2, 'Lốp B cũ', 1, 0),
      (3, 2, 'Vá lốp C', 50000, 1), (4, 2, 'Vá lốp D', 50000, 1);
  `);
}

test('findCandidates: chỉ Approved + gói isActive đúng loại + trong min(bán kính công ty, bán kính tìm)', async () => {
  const db = openDb(':memory:');
  seed(db);
  const names = async (radius: number) => (await findCandidates(db, incident, 'TIRE', radius, fallback)).map((c) => c.serviceName).sort();
  assert.deepEqual(await names(20), ['Vá lốp A', 'Vá lốp B']);
  assert.deepEqual(await names(3), ['Vá lốp A']);
  const [a] = await findCandidates(db, incident, 'BATTERY', 20, fallback);
  assert.deepEqual(a, { companyId: 1, companyName: 'Gần, điểm thấp', serviceId: 2, serviceName: 'Ắc quy A', price: 200000,
    distanceKm: 1, etaMinutes: 13, rating: 3, ratingCount: 4 }); // ceil(10 + 1.0007 km / 30 km/h × 60)
});

test('GET /matching/companies: xếp hạng theo strategy, validation, chỉ USER; /ai/classify → 503 (Tuần 3)', async () => {
  seed();
  const app = express();
  app.use(express.json());
  app.use('/api', matchingAiRouter);
  app.use(errorHandler);
  const server = app.listen(0);
  after(() => server.close());
  const get = async (q: string, token = signToken(1, 'USER')) => {
    const r = await fetch(`http://localhost:${(server.address() as AddressInfo).port}/api/matching/companies?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status, body: await r.json() as any };
  };
  const q = 'lat=21.0285&lng=105.8542&serviceTypeCode=TIRE';
  assert.deepEqual((await get(q)).body.items.map((c: any) => c.companyId), [1, 2]);
  const byRating = await get(`${q}&strategy=rating&radiusKm=30`);
  assert.deepEqual([byRating.body.strategy, byRating.body.radiusKm, byRating.body.items[0].companyId], ['rating', 30, 2]);
  assert.deepEqual((await get(`${q}&radiusKm=0.5`)).body.items, []);

  assert.equal((await get('lat=50&lng=105&serviceTypeCode=TIRE')).body.error.details.field, 'lat');
  assert.equal((await get('lat=21&lng=105.8&serviceTypeCode=XXX')).body.error.details.field, 'serviceTypeCode');
  assert.equal((await get(`${q}&strategy=random`)).body.error.details.field, 'strategy');
  assert.equal((await get(q, signToken(2, 'COMPANY'))).status, 403);

  const ai = await fetch(`http://localhost:${(server.address() as AddressInfo).port}/api/ai/classify`, {
    method: 'POST', headers: { Authorization: `Bearer ${signToken(1, 'USER')}`, 'Content-Type': 'application/json' }, body: '{"description":"Xe thủng lốp"}',
  });
  assert.deepEqual([ai.status, (await ai.json() as any).error.code], [503, 'AI_UNAVAILABLE']);
});
