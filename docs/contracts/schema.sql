-- =====================================================================
-- CONTRACT 1/3 – schema.sql  (Single Source of Truth – do M1 quản lý)
-- Hệ thống hỗ trợ sự cố xe trên đường – SQLite 3 (node:sqlite)
-- Phiên bản: 1.0 – khóa đầu Tuần 1. Muốn sửa: báo nhóm trước, M1 cập nhật.
--
-- Quy ước:
--   * Bảng/cột snake_case; JSON API dùng camelCase tương ứng.
--   * Thời gian: TEXT ISO-8601 UTC, ví dụ '2026-11-24T08:30:00.000Z'.
--   * Tiền: INTEGER, đơn vị VND. Tọa độ: REAL (WGS84). Boolean: INTEGER 0/1.
--   * File chạy lại nhiều lần không lỗi (IF NOT EXISTS / INSERT OR IGNORE).
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------- Danh mục cố định (seed, không có màn hình quản lý trong MVP) ----------

CREATE TABLE IF NOT EXISTS service_types (
  id    INTEGER PRIMARY KEY,
  code  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_types (
  id    INTEGER PRIMARY KEY,
  code  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL
);

INSERT OR IGNORE INTO service_types (id, code, name) VALUES
  (1, 'TOWING',         'Kéo / chở xe'),
  (2, 'TIRE',           'Vá / thay lốp'),
  (3, 'BATTERY',        'Kích bình / thay ắc quy'),
  (4, 'FUEL',           'Tiếp nhiên liệu'),
  (5, 'ON_SITE_REPAIR', 'Sửa chữa tại chỗ'),
  (6, 'LOCKOUT',        'Mở khóa xe');

INSERT OR IGNORE INTO vehicle_types (id, code, name) VALUES
  (1, 'MOTORBIKE', 'Xe máy'),
  (2, 'CAR',       'Ô tô con'),
  (3, 'TRUCK',     'Xe tải / xe khách');

-- ---------- Tài khoản (M2 – auth) ----------

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  phone          TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('USER', 'COMPANY', 'ADMIN')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------- Công ty cứu hộ (M3 – company-management) ----------

CREATE TABLE IF NOT EXISTS rescue_companies (
  id                 INTEGER PRIMARY KEY,
  user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id),  -- tài khoản role = COMPANY
  name               TEXT NOT NULL,
  phone              TEXT NOT NULL,
  address            TEXT NOT NULL,
  license_number     TEXT NOT NULL,
  license_file_url   TEXT NOT NULL,
  station_lat        REAL NOT NULL CHECK (station_lat BETWEEN -90 AND 90),
  station_lng        REAL NOT NULL CHECK (station_lng BETWEEN -180 AND 180),
  service_radius_km  REAL NOT NULL CHECK (service_radius_km > 0),
  approval_status    TEXT NOT NULL DEFAULT 'Pending'
                     CHECK (approval_status IN ('Pending', 'Approved', 'Rejected')),
  reject_reason      TEXT,
  approved_at        TEXT,
  rating_avg         REAL,                         -- NULL khi chưa có đánh giá; M2 cập nhật ở UC06
  rating_count       INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Gói dịch vụ + giá niêm yết của từng công ty. Không xóa cứng khi đã có đơn → is_active = 0.
CREATE TABLE IF NOT EXISTS rescue_services (
  id               INTEGER PRIMARY KEY,
  company_id       INTEGER NOT NULL REFERENCES rescue_companies(id),
  service_type_id  INTEGER NOT NULL REFERENCES service_types(id),
  name             TEXT NOT NULL,
  description      TEXT,
  base_price       INTEGER NOT NULL CHECK (base_price > 0),
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS rescue_vehicles (
  id            INTEGER PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES rescue_companies(id),
  kind          TEXT NOT NULL,                     -- loại xe/thiết bị, ví dụ 'Xe cẩu kéo 3.5T'
  plate_number  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Available'
                CHECK (status IN ('Available', 'Busy', 'Maintenance')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (company_id, plate_number)
);

-- ---------- Yêu cầu cứu hộ (M2 + M3 – rescue-request; trạng thái do State Pattern quản lý) ----------

CREATE TABLE IF NOT EXISTS rescue_requests (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  company_id       INTEGER NOT NULL REFERENCES rescue_companies(id),
  service_id       INTEGER NOT NULL REFERENCES rescue_services(id),
  vehicle_type_id  INTEGER NOT NULL REFERENCES vehicle_types(id),
  lat              REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng              REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  address          TEXT,
  description      TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 500),
  contact_phone    TEXT NOT NULL,
  photo_url        TEXT,
  distance_km      REAL,                           -- lúc gửi đơn, từ Matching
  estimated_price  INTEGER,                        -- giá niêm yết lúc gửi đơn (VND)
  status           TEXT NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending', 'Accepted', 'InProgress', 'Completed', 'Cancelled', 'Rejected')),
  eta_minutes      INTEGER CHECK (eta_minutes > 0),  -- ETA công ty phản hồi (UC09)
  cancel_reason    TEXT,
  reject_reason    TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  accepted_at      TEXT,
  started_at       TEXT,
  completed_at     TEXT,
  cancelled_at     TEXT,
  rejected_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_rescue_requests_user    ON rescue_requests (user_id, status);
CREATE INDEX IF NOT EXISTS idx_rescue_requests_company ON rescue_requests (company_id, status);

-- Kết quả phân loại sự cố (AI S1 hoặc người dùng tự chọn khi fallback), 1–1 với đơn.
CREATE TABLE IF NOT EXISTS incident_classifications (
  request_id                 INTEGER PRIMARY KEY REFERENCES rescue_requests(id),
  incident_type              TEXT NOT NULL,        -- nhãn AI, ví dụ 'FLAT_TIRE' (danh sách: api-contract.md §4)
  urgency                    TEXT NOT NULL CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH')),
  suggested_service_type_id  INTEGER REFERENCES service_types(id),
  confidence                 REAL CHECK (confidence BETWEEN 0 AND 1),
  source                     TEXT NOT NULL CHECK (source IN ('AI', 'MANUAL'))
);

-- Ghi nhận thanh toán (không thanh toán online), chỉ khi đơn Completed.
CREATE TABLE IF NOT EXISTS payment_records (
  request_id   INTEGER PRIMARY KEY REFERENCES rescue_requests(id),
  amount       INTEGER NOT NULL CHECK (amount >= 0),
  method       TEXT NOT NULL CHECK (method IN ('CASH', 'BANK_TRANSFER', 'EWALLET')),
  note         TEXT,
  recorded_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------- Đánh giá & tin nhắn (feedback-chat: M2 đánh giá, M4 chat) ----------

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY,
  request_id  INTEGER NOT NULL UNIQUE REFERENCES rescue_requests(id),  -- 1 đơn tối đa 1 đánh giá
  user_id     INTEGER NOT NULL REFERENCES users(id),
  company_id  INTEGER NOT NULL REFERENCES rescue_companies(id),
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment     TEXT,
  is_hidden   INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),  -- UC11 kiểm duyệt
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY,
  request_id      INTEGER NOT NULL REFERENCES rescue_requests(id),
  sender_user_id  INTEGER NOT NULL REFERENCES users(id),
  content         TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  read_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_request ON messages (request_id, id);
