# Hệ thống hỗ trợ sự cố xe trên đường (Roadside Assistance)

BTL IT4490 – Thiết kế và Xây dựng Phần mềm.

**Tài liệu dự án:**
- [kehoach.md](kehoach.md) – kế hoạch triển khai, phân công M1–M4 theo tuần
- [docs/design/M1-tuan1-kien-truc.md](docs/design/M1-tuan1-kien-truc.md) – Tech Stack, kiến trúc, class diagram State/Strategy, gói Entity
- [docs/design/M2-tuan1-xac-thuc.md](docs/design/M2-tuan1-xac-thuc.md) – Đăng ký/Đăng nhập/phân quyền: sequence, UI spec, design class, cách dùng middleware
- [docs/design/M3-tuan1-cong-ty-admin.md](docs/design/M3-tuan1-cong-ty-admin.md) – Quản lý dịch vụ/phương tiện (UC08), Admin thẩm định (UC10): sequence, UI spec, design class
- [docs/design/M4-tuan1-ui-kit.md](docs/design/M4-tuan1-ui-kit.md) – UI Kit dùng chung + component bản đồ; xem trực tiếp tại `/ui-kit`
- Tuần 2 – luồng End-to-End yêu cầu → điều phối cứu hộ:
  - [M1-tuan2-ghep-noi-maps.md](docs/design/M1-tuan2-ghep-noi-maps.md) – MapsSubsystem (OSRM), công thức ETA, API ghép nối
  - [M2-tuan2-yeu-cau-cuu-ho.md](docs/design/M2-tuan2-yeu-cau-cuu-ho.md) – UC03/UC04/UC05: sequence, design class, UI spec S01–S04
  - [M3-tuan2-dieu-phoi.md](docs/design/M3-tuan2-dieu-phoi.md) – UC09: sequence, design class, UI spec C-02
  - [M4-tuan2-ghep-noi-ui.md](docs/design/M4-tuan2-ghep-noi-ui.md) – sơ đồ chuyển màn hình cập nhật, xử lý lỗi & validation

**Hợp đồng giao tiếp** (Single Source of Truth – không tự sửa, báo M1):
- [docs/contracts/schema.sql](docs/contracts/schema.sql) – cấu trúc CSDL SQLite + danh mục seed
- [docs/contracts/api-contract.md](docs/contracts/api-contract.md) – endpoint, định dạng lỗi, validation, vòng đời đơn
- [docs/contracts/design-tokens.css](docs/contracts/design-tokens.css) – màu, chữ, kích thước UI (Tailwind `@theme`)

## Chạy dự án
Cần Node.js ≥ 22.18 (không cần cài DB – SQLite có sẵn trong Node, file `data/app.db` tự tạo).

```bash
npm install
npm run dev        # API http://localhost:3000  +  UI http://localhost:5173
npm test           # unit test (node --test)
npm run typecheck
npm run create-admin -- admin@example.com matkhau123   # tạo tài khoản ADMIN
```

Khoảng cách/ETA lấy từ OSRM công khai (cần Internet; lỗi/quá 3 giây tự chuyển sang ước tính đường chim bay). Biến môi trường tùy chọn: `MAPS_PROVIDER=offline` (không gọi OSRM), `OSRM_URL` (máy chủ OSRM tự host), `DB_PATH`, `PORT`, `JWT_SECRET`.

**Màn hình:** Người gặp sự cố `/` (S01) → `/requests/new` (S02–S03) → `/requests/:id` (S04) · Công ty `/company` (C-01), `/company/dispatch` (C-02) · Admin `/admin` (AD-01).

## Cấu trúc & người phụ trách
| Thư mục | Nội dung | Phụ trách |
|---|---|---|
| [`docs/contracts/`](docs/contracts/) | 3 file hợp đồng ở trên | M1 |
| [`src/shared/state/`](src/shared/state/) | State Pattern vòng đời đơn cứu hộ: [rescue-request-state.ts](src/shared/state/rescue-request-state.ts), [rescue-request-store.ts](src/shared/state/rescue-request-store.ts) | M1 |
| [`src/shared/strategy/`](src/shared/strategy/) | Strategy Pattern ghép nối & ETA: [matching-strategy.ts](src/shared/strategy/matching-strategy.ts), [eta-estimator.ts](src/shared/strategy/eta-estimator.ts) | M1 |
| [`src/shared/db.ts`](src/shared/db.ts), [`http.ts`](src/shared/http.ts) | Kết nối DB (`getDb()`), `HttpError` + định dạng lỗi chung | M1 |
| [`src/shared/ui/`](src/shared/ui/) | UI Kit: [form.tsx](src/shared/ui/form.tsx) (Button, Field…), [feedback.tsx](src/shared/ui/feedback.tsx) (Alert, chip, toast), [modal.tsx](src/shared/ui/modal.tsx) (ConfirmDialog), [map.tsx](src/shared/ui/map.tsx) (LocationPicker, MarkersMap), [use-polling.ts](src/shared/ui/use-polling.ts), [format.ts](src/shared/ui/format.ts) – danh mục tại `/ui-kit` | M4 |
| [`src/auth/`](src/auth/) | Đăng ký, đăng nhập, phân quyền: [auth-middleware.ts](src/auth/auth-middleware.ts) (`requireRole`, `requireApprovedCompany`), [session.tsx](src/auth/session.tsx) (`apiFetch`, `RequireRole`) | M2 |
| [`src/rescue-request/`](src/rescue-request/) | Tạo/theo dõi/hủy đơn: [rescue-request.api.ts](src/rescue-request/rescue-request.api.ts), S01–S04 (M2) · Tiếp nhận/điều phối: [rescue-dispatch.api.ts](src/rescue-request/rescue-dispatch.api.ts), [DispatchPage.tsx](src/rescue-request/DispatchPage.tsx) (M3) · Dùng chung: [rescue-store.ts](src/rescue-request/rescue-store.ts) (`transition()`), [rescue-validation.ts](src/rescue-request/rescue-validation.ts) | M2, M3 |
| [`src/company-management/`](src/company-management/) | Hồ sơ, dịch vụ, phương tiện ([company.api.ts](src/company-management/company.api.ts), trang `/company`), Admin duyệt ([admin.api.ts](src/company-management/admin.api.ts), trang `/admin`) | M3 |
| [`src/matching-ai/`](src/matching-ai/) | MapsSubsystem: [maps-subsystem.ts](src/matching-ai/maps-subsystem.ts) (`getEtaEstimator()`), API ghép nối: [matching.api.ts](src/matching-ai/matching.api.ts), nhãn sự cố: [incident-types.ts](src/matching-ai/incident-types.ts); AI phân loại (Tuần 3) | M1 |
| [`src/feedback-chat/`](src/feedback-chat/) | Đánh giá (M2), chat (M4) | M2, M4 |

Mỗi module: API trong `*.api.ts` (Express Router, mount 1 dòng ở [src/server.ts](src/server.ts)), trang trong `*.tsx` (thêm 1 `<Route>` ở [src/main.tsx](src/main.tsx)). Import file TypeScript **kèm đuôi `.ts`/`.tsx`**.

## Quy tắc Git
- `main` ổn định ← `dev` tích hợp ← `feature/<module>-<tên-tính-năng>`; merge vào `dev` qua Pull Request.
- Thay đổi trạng thái đơn **chỉ** qua `RescueRequestContext` + `saveRescueRequest` (xem [api-contract §2](docs/contracts/api-contract.md#2-vòng-đời-đơn-cứu-hộ-state-pattern--srcsharedstate)).
