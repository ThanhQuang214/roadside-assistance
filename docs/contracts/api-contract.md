# CONTRACT 2/3 – api-contract.md (Single Source of Truth – do M1 quản lý)

**Hệ thống hỗ trợ sự cố xe trên đường** · Phiên bản 1.1 – Tuần 2 (1.0 khóa đầu Tuần 1).
**1.1:** chỉ làm rõ, không đổi tên trường/endpoint – bán kính ghép nối và nguồn ETA (§3.3), `/ai/classify` tạm trả 503 tới Tuần 3, ràng buộc `photoUrl` (§3.4), thông báo 409 tiếng Việt và 409 khi ghi thanh toán ngoài Completed (§2).
Muốn đổi tên trường / thêm endpoint ngoài module của mình: báo nhóm trước, M1 cập nhật file này rồi mới code.

Bảng dữ liệu tương ứng: [schema.sql](schema.sql). Mã Actor/UC theo báo cáo (A0–A4, S1–S2, UC01–UC12).

---

## 1. Quy ước chung

### 1.1 Định dạng
- Base URL: `/api` (Vite dev proxy `/api` → `http://localhost:3000`).
- Request/response: JSON, UTF-8, trường **camelCase** (DB snake_case: `eta_minutes` ↔ `etaMinutes`).
- Thời gian: chuỗi ISO-8601 UTC. Tiền: số nguyên VND. Tọa độ: `lat`, `lng` (số thực).
- Danh sách trả về dạng `{ "items": [...] }` (MVP chưa phân trang).

### 1.2 Xác thực & phân quyền (M2 cài đặt)
- Header `Authorization: Bearer <JWT>`; payload JWT: `{ "sub": <userId>, "role": "USER" | "COMPANY" | "ADMIN" }`.
- Vai trò ↔ Actor: `USER` = A2 Người gặp sự cố, `COMPANY` = A3 Công ty cứu hộ, `ADMIN` = A4 Quản trị viên.
- Cột **Quyền** ở các bảng dưới: `public` = không cần token.
- Truy cập dữ liệu không thuộc mình (đơn của người khác, đơn giao cho công ty khác) → `404 NOT_FOUND` (không lộ sự tồn tại).
- Tài khoản `COMPANY` chưa `Approved` chỉ được dùng `GET /companies/me`; các API khác của công ty → `403 COMPANY_NOT_APPROVED`.

### 1.3 Lỗi
Mọi lỗi trả cùng một dạng (đã cài trong `src/shared/http.ts`, module chỉ cần `throw new HttpError(...)`):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Mô tả sự cố phải có từ 10 đến 500 ký tự.", "details": { "field": "description" } } }
```

| HTTP | code | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Thiếu/sai trường; `details.field` = tên trường lỗi để UI báo đúng chỗ |
| 401 | `UNAUTHENTICATED` | Thiếu/sai/hết hạn token; sai email/mật khẩu |
| 403 | `FORBIDDEN` / `COMPANY_NOT_APPROVED` | Sai vai trò; công ty chưa được duyệt |
| 404 | `NOT_FOUND` | Không tồn tại hoặc không thuộc quyền |
| 409 | `INVALID_STATE_TRANSITION` | Thao tác sai vòng đời đơn (State Pattern ném `InvalidTransitionError`, kể cả xung đột đồng thời UC05-4.1 / UC09-4.1) |
| 409 | `CONFLICT` | Trùng dữ liệu (email, biển số), xóa gói dịch vụ đã có đơn (UC08-5.2), đơn đã đánh giá |
| 503 | `AI_UNAVAILABLE` | S1 lỗi/quá 5 giây → UI chuyển sang tự chọn dịch vụ (UC03-4.1) |
| 500 | `INTERNAL_ERROR` | Lỗi khác |

### 1.4 Validation dùng chung (khớp UI Guidelines mục 3.2.1-d)
| Trường | Quy tắc |
|---|---|
| `lat`, `lng` | Bắt buộc; `lat` ∈ [8, 24], `lng` ∈ [102, 110] (lãnh thổ VN) |
| `description` | 10–500 ký tự sau khi trim |
| `phone`, `contactPhone` | `^0\d{9}$` |
| `etaMinutes` | Số nguyên 1–600 |
| `reason` (hủy/từ chối) | Bắt buộc, 1–255 ký tự |
| `stars` | Số nguyên 1–5 |
| Ảnh/giấy phép upload | JPG/PNG/WebP (giấy phép thêm PDF), ≤ 5 MB |

---

## 2. Vòng đời đơn cứu hộ (State Pattern – `src/shared/state/`)

Trạng thái: `Pending` → `Accepted` → `InProgress` → `Completed`; nhánh kết thúc `Cancelled`, `Rejected`.

| Trạng thái hiện tại | Hành động (method `RescueRequestContext`) | Trạng thái mới | Ai làm | Endpoint |
|---|---|---|---|---|
| Pending | `accept(etaMinutes)` | Accepted | COMPANY | `POST /rescue-requests/:id/accept` |
| Pending | `reject(reason)` | Rejected | COMPANY | `POST /rescue-requests/:id/reject` |
| Pending | `cancel(reason)` | Cancelled | USER | `POST /rescue-requests/:id/cancel` |
| Accepted | `start()` | InProgress | COMPANY | `POST /rescue-requests/:id/start` |
| Accepted, InProgress | `updateEta(etaMinutes)` | (giữ nguyên) | COMPANY | `PATCH /rescue-requests/:id/eta` |
| InProgress | `complete()` | Completed | COMPANY | `POST /rescue-requests/:id/complete` |
| Completed | `canRecordPayment()` = true | – | COMPANY | `PUT /rescue-requests/:id/payment` |
| Completed | `canReview()` = true | – | USER | `POST /rescue-requests/:id/review` |

Mọi ô khác (kể cả `PUT …/payment` khi đơn chưa Completed) → `409 INVALID_STATE_TRANSITION`, `message` tiếng Việt nêu trạng thái hiện tại để UI hiển thị thẳng, ví dụ *"Không thể hủy yêu cầu vì đơn cứu hộ đang ở trạng thái "Đã tiếp nhận"."*; `details = { status, action }`. Cách dùng trong controller (bắt buộc để chống xung đột hủy/nhận cùng lúc):

```ts
const ctx = loadRescueRequest(db, id);          // null → 404
const expected = ctx.status;
ctx.cancel(reason);                             // sai trạng thái → InvalidTransitionError → 409
if (!saveRescueRequest(db, ctx, expected)) throw new InvalidTransitionError(...);  // ai đó vừa đổi trạng thái → 409
```

---

## 3. Endpoints

### 3.1 Danh mục – M1 (đã cài trong `src/server.ts`)
| Method | Path | Quyền | Response 200 |
|---|---|---|---|
| GET | `/catalog/service-types` | public | `{ items: [{ id, code, name }] }` – `TOWING, TIRE, BATTERY, FUEL, ON_SITE_REPAIR, LOCKOUT` |
| GET | `/catalog/vehicle-types` | public | `{ items: [{ id, code, name }] }` – `MOTORBIKE, CAR, TRUCK` |
| GET | `/health` | public | `{ ok: true }` |

### 3.2 Xác thực – M2 (`src/auth`) · UC01, UC02
| Method | Path | Quyền | Body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | public | `{ role: "USER"\|"COMPANY", email, password (≥8), fullName, phone, company? }` – `company` bắt buộc khi role COMPANY: `{ name, phone, address, licenseNumber, licenseFileUrl, stationLat, stationLng, serviceRadiusKm }` | `201 { user: User }` (công ty tạo với `approvalStatus: "Pending"`) |
| POST | `/auth/login` | public | `{ email, password }` | `200 { token, user: User }` |
| GET | `/auth/me` | đăng nhập | – | `200 { user: User, company?: Company }` |
| POST | `/uploads` | public (đăng ký cần upload giấy phép) | `multipart/form-data`, field `file` | `201 { url }` |

`User = { id, email, phone, fullName, role, createdAt }` (không bao giờ trả `passwordHash`).

### 3.3 Ghép nối & AI – M1 (`src/matching-ai`) · UC03 bước 4–5
| Method | Path | Quyền | Input | Response 200 |
|---|---|---|---|---|
| POST | `/ai/classify` | USER | `{ description }` | `{ incidentType, urgency, suggestedServiceTypeCode, confidence, source: "AI" }` hoặc `503 AI_UNAVAILABLE` – *Tuần 2 luôn trả 503 (S1 làm ở Tuần 3), UI chạy nhánh tự chọn dịch vụ* |
| GET | `/matching/companies` | USER | query `lat, lng, serviceTypeCode, radiusKm=20, strategy=nearest\|rating\|weighted` | `{ radiusKm, strategy, items: CompanyCandidate[] }` – rỗng thì UI gợi ý `radiusKm + 10` |

`incidentType` ∈ `FLAT_TIRE, DEAD_BATTERY, OUT_OF_FUEL, ENGINE_FAILURE, ACCIDENT, LOCKOUT, OTHER` · `urgency` ∈ `LOW, MEDIUM, HIGH`.

`CompanyCandidate = { companyId, companyName, serviceId, serviceName, price, distanceKm, etaMinutes, rating (null nếu chưa có), ratingCount }` – chỉ gồm công ty `Approved`, gói `isActive`, có trạm cách điểm sự cố (đường chim bay) không quá `min(serviceRadiusKm của công ty, radiusKm của truy vấn)`; `radiusKm` ∈ (0, 200]. Từ Tuần 2 `distanceKm` = quãng đường lái xe và `etaMinutes = ceil(10 + phút lái × 1.5)` lấy từ MapsSubsystem (OSRM); Maps lỗi/quá 3 giây → ước tính đường chim bay như Tuần 1 (xem [M1-tuan2](../design/M1-tuan2-ghep-noi-maps.md)).

### 3.4 Yêu cầu cứu hộ – M2 phía USER, M3 phía COMPANY (`src/rescue-request`) · UC03, UC04, UC05, UC09
| Method | Path | Quyền | Body | Response |
|---|---|---|---|---|
| POST | `/rescue-requests` | USER | `{ companyId, serviceId, vehicleTypeCode, lat, lng, address?, description, contactPhone, photoUrl?, classification: { incidentType, urgency, confidence?, source: "AI"\|"MANUAL" } }` | `201 { request: RescueRequest }` – server tự tính lại `distanceKm`, `estimatedPrice`; công ty phải `Approved`, gói thuộc công ty và `isActive`; `photoUrl` phải là URL do `POST /uploads` trả về (`/api/uploads/…jpg\|png\|webp`) |
| GET | `/rescue-requests` | USER (đơn của mình) / COMPANY (đơn giao cho mình) | query `status?` | `{ items: RescueRequest[] }` mới nhất trước |
| GET | `/rescue-requests/:id` | chủ đơn / công ty được giao | – | `{ request: RescueRequest }` – client polling 5 giây/lần |
| POST | `/rescue-requests/:id/cancel` | USER | `{ reason }` | `200 { request }` |
| POST | `/rescue-requests/:id/accept` | COMPANY | `{ etaMinutes }` | `200 { request }` |
| POST | `/rescue-requests/:id/reject` | COMPANY | `{ reason }` | `200 { request }` |
| POST | `/rescue-requests/:id/start` | COMPANY | – | `200 { request }` |
| PATCH | `/rescue-requests/:id/eta` | COMPANY | `{ etaMinutes }` | `200 { request }` |
| POST | `/rescue-requests/:id/complete` | COMPANY | `{ payment? : Payment }` (có thể ghi thanh toán sau – UC09-6a) | `200 { request }` |
| PUT | `/rescue-requests/:id/payment` | COMPANY | `Payment = { amount, method: "CASH"\|"BANK_TRANSFER"\|"EWALLET", note? }` | `200 { request }` |

```ts
RescueRequest = {
  id, status, createdAt, updatedAt,
  acceptedAt, startedAt, completedAt, cancelledAt, rejectedAt,   // null nếu chưa tới
  lat, lng, address, description, contactPhone, photoUrl,
  vehicleType: { code, name },
  service: { id, name, serviceTypeCode },
  company: { id, name, phone, stationLat, stationLng },
  user: { id, fullName },                       // COMPANY thấy thêm contactPhone ở trên
  distanceKm, estimatedPrice, etaMinutes, cancelReason, rejectReason,
  classification: { incidentType, urgency, confidence, source } | null,
  payment: Payment & { recordedAt } | null,
  reviewed: boolean
}
```

### 3.5 Quản lý công ty – M3 (`src/company-management`) · UC08
| Method | Path | Quyền | Body / Response |
|---|---|---|---|
| GET | `/companies/me` | COMPANY | `{ company: Company }` |
| PUT | `/companies/me` | COMPANY | `{ name, phone, address, stationLat, stationLng, serviceRadiusKm }` → `{ company }` |
| GET | `/companies/me/services` | COMPANY | `{ items: Service[] }` |
| POST | `/companies/me/services` | COMPANY | `{ serviceTypeCode, name, description?, basePrice }` → `201 { service }` |
| PUT | `/companies/me/services/:id` | COMPANY | `{ name, description?, basePrice, isActive }` → `{ service }` |
| DELETE | `/companies/me/services/:id` | COMPANY | `204`; đã có đơn → `409 CONFLICT` (gợi ý đặt `isActive: false`) |
| GET | `/companies/me/vehicles` | COMPANY | `{ items: Vehicle[] }` |
| POST | `/companies/me/vehicles` | COMPANY | `{ kind, plateNumber, status? }` → `201 { vehicle }` |
| PUT | `/companies/me/vehicles/:id` | COMPANY | `{ kind, plateNumber, status }` → `{ vehicle }` |

```ts
Company = { id, name, phone, address, licenseNumber, licenseFileUrl, stationLat, stationLng, serviceRadiusKm,
            approvalStatus: "Pending" | "Approved" | "Rejected", rejectReason, approvedAt, ratingAvg, ratingCount, createdAt }
Service = { id, serviceTypeCode, name, description, basePrice, isActive }
Vehicle = { id, kind, plateNumber, status: "Available" | "Busy" | "Maintenance" }
```

### 3.6 Quản trị – M3 (`src/company-management`) · UC10 (Tuần 1), UC11–UC12 (Tuần 3)
| Method | Path | Quyền | Body / Response |
|---|---|---|---|
| GET | `/admin/companies` | ADMIN | query `approvalStatus?`, `q?` (tên/mã) → `{ items: Company[] }` |
| GET | `/admin/companies/:id` | ADMIN | `{ company }` |
| POST | `/admin/companies/:id/approve` | ADMIN | → `{ company }`; không còn `Pending` → `409 CONFLICT` |
| POST | `/admin/companies/:id/reject` | ADMIN | `{ reason }` → `{ company }`; không còn `Pending` → `409 CONFLICT` |
| GET | `/admin/stats` | ADMIN | *Tuần 3 – chốt sau* |
| PATCH | `/admin/reviews/:id` | ADMIN | `{ isHidden }` → `{ review }` *(Tuần 3)* |
| DELETE | `/admin/reviews/:id` | ADMIN | `204` *(Tuần 3)* |

### 3.7 Đánh giá & tin nhắn – M2 / M4 (`src/feedback-chat`) · UC06, UC07 (Tuần 3)
| Method | Path | Quyền | Body / Response |
|---|---|---|---|
| POST | `/rescue-requests/:id/review` | USER (chủ đơn) | `{ stars, comment? }` → `201 { review }`; cập nhật `ratingAvg`, `ratingCount` của công ty trong cùng transaction |
| GET | `/companies/:id/reviews` | đăng nhập | `{ items: Review[] }` (ẩn `isHidden`, trừ ADMIN) |
| GET | `/rescue-requests/:id/messages` | chủ đơn / công ty được giao | query `afterId?` (polling) → `{ items: Message[] }` |
| POST | `/rescue-requests/:id/messages` | chủ đơn / công ty được giao | `{ content }` → `201 { message }` |

```ts
Review  = { id, requestId, stars, comment, isHidden, createdAt, user: { id, fullName } }
Message = { id, requestId, senderUserId, content, createdAt, readAt }
```

---

## 4. Ánh xạ nhãn AI → loại dịch vụ đề xuất (UC03 bước 4)

| incidentType | suggestedServiceTypeCode |
|---|---|
| FLAT_TIRE | TIRE |
| DEAD_BATTERY | BATTERY |
| OUT_OF_FUEL | FUEL |
| ENGINE_FAILURE | ON_SITE_REPAIR |
| ACCIDENT | TOWING |
| LOCKOUT | LOCKOUT |
| OTHER | `null` (người dùng tự chọn) |
