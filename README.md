# Hệ thống hỗ trợ sự cố xe trên đường (Roadside Assistance)

BTL IT4490 – Thiết kế và Xây dựng Phần mềm.

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
```

## Cấu trúc & người phụ trách
| Thư mục | Nội dung | Phụ trách |
|---|---|---|
| [`docs/contracts/`](docs/contracts/) | 3 file hợp đồng ở trên | M1 |
| [`src/shared/state/`](src/shared/state/) | State Pattern vòng đời đơn cứu hộ: [rescue-request-state.ts](src/shared/state/rescue-request-state.ts), [rescue-request-store.ts](src/shared/state/rescue-request-store.ts) | M1 |
| [`src/shared/strategy/`](src/shared/strategy/) | Strategy Pattern ghép nối & ETA: [matching-strategy.ts](src/shared/strategy/matching-strategy.ts), [eta-estimator.ts](src/shared/strategy/eta-estimator.ts) | M1 |
| [`src/shared/db.ts`](src/shared/db.ts), [`http.ts`](src/shared/http.ts) | Kết nối DB (`getDb()`), `HttpError` + định dạng lỗi chung | M1 |
| `src/shared/ui/` | UI components dùng chung, component bản đồ | M4 |
| `src/auth/` | Đăng ký, đăng nhập, phân quyền | M2 |
| `src/rescue-request/` | Tạo/theo dõi/hủy đơn (M2), tiếp nhận/điều phối (M3) | M2, M3 |
| `src/company-management/` | Hồ sơ, dịch vụ, phương tiện, Admin duyệt | M3 |
| `src/matching-ai/` | API ghép nối, AI phân loại | M1 |
| `src/feedback-chat/` | Đánh giá (M2), chat (M4) | M2, M4 |

Mỗi module: API trong `*.api.ts` (Express Router, mount 1 dòng ở [src/server.ts](src/server.ts)), trang trong `*.tsx` (thêm 1 `<Route>` ở [src/main.tsx](src/main.tsx)). Import file TypeScript **kèm đuôi `.ts`/`.tsx`**.

## Quy tắc Git
- `main` ổn định ← `dev` tích hợp ← `feature/<module>-<tên-tính-năng>`; merge vào `dev` qua Pull Request.
- Thay đổi trạng thái đơn **chỉ** qua `RescueRequestContext` + `saveRescueRequest` (xem [api-contract §2](docs/contracts/api-contract.md#2-vòng-đời-đơn-cứu-hộ-state-pattern--srcsharedstate)).
