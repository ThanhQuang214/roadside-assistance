# Hệ thống hỗ trợ sự cố xe trên đường (Roadside Assistance)

BTL IT4490 – Thiết kế và Xây dựng Phần mềm. Kế hoạch: [kehoach.md](../kehoach.md) · Kiến trúc & Tech Stack: [docs/design/M1-tuan1-kien-truc.md](../docs/design/M1-tuan1-kien-truc.md).

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
| `docs/contracts/` | `schema.sql`, `api-contract.md`, `design-tokens.css` – **không tự sửa, báo M1** | M1 |
| `src/shared/state/` | State Pattern vòng đời đơn cứu hộ | M1 |
| `src/shared/strategy/` | Strategy Pattern ghép nối & ETA | M1 |
| `src/shared/db.ts`, `http.ts` | Kết nối DB (`getDb()`), `HttpError` + định dạng lỗi chung | M1 |
| `src/shared/ui/` | UI components dùng chung, component bản đồ | M4 |
| `src/auth/` | Đăng ký, đăng nhập, phân quyền | M2 |
| `src/rescue-request/` | Tạo/theo dõi/hủy đơn (M2), tiếp nhận/điều phối (M3) | M2, M3 |
| `src/company-management/` | Hồ sơ, dịch vụ, phương tiện, Admin duyệt | M3 |
| `src/matching-ai/` | API ghép nối, AI phân loại | M1 |
| `src/feedback-chat/` | Đánh giá (M2), chat (M4) | M2, M4 |

Mỗi module: API trong `*.api.ts` (Express Router, mount 1 dòng ở `src/server.ts`), trang trong `*.tsx` (thêm 1 `<Route>` ở `src/main.tsx`). Import file TypeScript **kèm đuôi `.ts`/`.tsx`**.

## Quy tắc Git
- `main` ổn định ← `dev` tích hợp ← `feature/<module>-<tên-tính-năng>`; merge vào `dev` qua Pull Request.
- Thay đổi trạng thái đơn **chỉ** qua `RescueRequestContext` + `saveRescueRequest` (xem api-contract §2).
