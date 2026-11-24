// Đọc RescueCompany theo đúng kiểu `Company` trong api-contract.md §3.5 (dùng ở /auth/me, /companies/me, /admin/companies).
import type { DatabaseSync } from 'node:sqlite';

export const COMPANY_SELECT = `
  SELECT id, name, phone, address, license_number AS licenseNumber, license_file_url AS licenseFileUrl,
         station_lat AS stationLat, station_lng AS stationLng, service_radius_km AS serviceRadiusKm,
         approval_status AS approvalStatus, reject_reason AS rejectReason, approved_at AS approvedAt,
         rating_avg AS ratingAvg, rating_count AS ratingCount, created_at AS createdAt
  FROM rescue_companies`;

export const findCompanyById = (db: DatabaseSync, id: number) => db.prepare(`${COMPANY_SELECT} WHERE id = ?`).get(id);
export const findCompanyByUserId = (db: DatabaseSync, userId: number) => db.prepare(`${COMPANY_SELECT} WHERE user_id = ?`).get(userId);
