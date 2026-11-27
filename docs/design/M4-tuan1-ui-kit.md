# M4 – Tuần 1: UI Kit dùng chung & Component bản đồ

Hệ thống hỗ trợ sự cố xe trên đường · Người phụ trách: M4 · Dùng cho báo cáo mục **3.2.1** (Chuẩn hóa cấu hình màn hình) và **3.2.3** (Thiết kế màn hình).
Căn cứ: [UI Guidelines M4](../../../M4/01_UI_Guidelines_M4.docx), báo cáo mục 3.2.1 a–d, [design-tokens.css](../contracts/design-tokens.css).

**Xem trực tiếp:** chạy `npm run dev` rồi mở <http://localhost:5173/ui-kit>. Trang này hiển thị mọi component với dữ liệu mẫu, dùng để đối chiếu và chụp hình cho báo cáo.

---

## 1. Mã nguồn (`src/shared/ui/`)

| File | Component / hàm | Dùng ở đâu (hiện tại) |
|---|---|---|
| [`form.tsx`](../../src/shared/ui/form.tsx) | `Button`, `buttonClass`, `BTN_*`, `Field`, `SelectField`, `TextAreaField`, `useForm`, `InfoRow`, `CARD` | Mọi trang |
| [`feedback.tsx`](../../src/shared/ui/feedback.tsx) | `Alert`, `ALERT_ERROR`, `StatusChip`, `RescueStatusChip`, `RESCUE_STATUS_UI`, `useToast`, `NetworkBanner` | Mọi trang; `NetworkBanner` gắn một lần trong `main.tsx` |
| [`modal.tsx`](../../src/shared/ui/modal.tsx) | `Modal`, `ConfirmDialog` (tùy chọn bắt buộc nhập lý do) | Xóa gói dịch vụ (C-01), từ chối hồ sơ (AD-01); Tuần 2: hủy yêu cầu (S04), từ chối đơn (UC09) |
| [`map.tsx`](../../src/shared/ui/map.tsx) | `LocationPicker`, `MarkersMap`, `DEFAULT_CENTER`, kiểu `LatLng`, `MapMarker` | Đăng ký công ty (A-02), hồ sơ công ty (C-01), chi tiết hồ sơ Admin (AD-01); Tuần 2: S02, S03, S04 |
| [`UiKitPage.tsx`](../../src/shared/ui/UiKitPage.tsx) | Trang danh mục `/ui-kit` | – |

Phần đã thay so với bản tạm của M2/M3: ô nhập tọa độ tay được thay bằng `LocationPicker`, `confirm()` của trình duyệt khi xóa gói được thay bằng `ConfirmDialog`, `RejectDialog` riêng của Admin được thay bằng `ConfirmDialog reasonLabel`, `ApprovalChip` giờ dựng trên `StatusChip`, và các banner tự viết được thay bằng `Alert`.

---

## 2. Danh mục component (đặc tả control)

### 2.1 Nút – `Button`
| Prop | Giá trị | Ý nghĩa (UI Guidelines) |
|---|---|---|
| `variant` | `primary` (mặc định) / `secondary` / `danger` | Primary = gửi/tiếp tục; Secondary = trở lại/xem thêm; Danger = hủy/xóa |
| `size` | `xl` 56 px / `lg` 48 px (mặc định) / `sm` 36 px | `xl` cho "Gọi cứu hộ ngay" (S01); `lg` vùng chạm ngoài trời; `sm` cho bảng của Công ty & Admin |
| `loading`, `loadingText` | boolean, chuỗi | Khóa nút và đổi nhãn khi đang gửi để **chống gửi trùng** |
| `block` | boolean | Rộng 100 % (form mobile) |
| `disabled` | boolean | Trạng thái disabled (mờ 60 %, con trỏ cấm) |

Có focus ring 2 px màu primary khi dùng bàn phím. Nếu cần một `<Link>` trông như nút thì dùng `buttonClass(variant, size)`.

### 2.2 Ô nhập – `Field`, `SelectField`, `TextAreaField`
- Props chung: `label` (bắt buộc, luôn hiện), `error` (chữ đỏ dưới ô + viền đỏ + `aria-invalid`), `hint` (chú thích xám khi không lỗi), cùng mọi thuộc tính HTML gốc.
- Cao 48 px, chữ 16 px (không bị iOS tự phóng to khi nhập), bo góc 8 px. `disabled` hiện nền xám và chữ phụ.
- `useForm(initial)` trả về `{ values, bind(name), set(patch), err, setErr }`. `bind` gắn value, onChange và lỗi theo đúng ô, khớp với dạng `details.field` mà API trả về.

### 2.3 Thông báo – `Alert`, `useToast`, `NetworkBanner`
| Tình huống (báo cáo 3.2.1-c) | Component |
|---|---|
| Lỗi gửi / lỗi máy chủ, giữ dữ liệu form | `<Alert>` (đỏ, `role="alert"`) |
| GPS bị từ chối / tín hiệu yếu | `<Alert tone="warning">` (vàng), có sẵn trong `LocationPicker` |
| AI không phân tích được, chuyển sang tự chọn | `<Alert tone="info">` |
| Thao tác thành công | `useToast()`: snackbar xanh nhạt tự ẩn sau 3 giây |
| Mất kết nối mạng | `NetworkBanner`: banner vàng cố định đầu trang "Đã mất kết nối mạng. Đang chờ kết nối lại..." |
| Lỗi có cách khắc phục ngay | `<Alert action={<button>…</button>}>` (vd. "Tải lại", "Ngừng cung cấp") |

Toast và banner có `z-index` 1100, cao hơn các control của Leaflet (≤ 1000) nên không bị bản đồ che.

### 2.4 Chip trạng thái – `StatusChip`, `RescueStatusChip`
Luôn gồm **nền nhạt + chữ đậm + nhãn chữ** (không chỉ dựa vào màu):

| Trạng thái đơn | Nhãn | Tone |
|---|---|---|
| Pending | Chờ tiếp nhận | `pending` (vàng/nâu) |
| Accepted | Đã tiếp nhận | `active` (xanh dương) |
| InProgress | Đang xử lý | `active` |
| Completed | Hoàn tất | `completed` (xanh lá) |
| Cancelled | Đã hủy | `closed` (đỏ) |
| Rejected | Bị từ chối | `closed` |

`RESCUE_STATUS_UI` được export để M2/M3 dùng chung nhãn (Tuần 2, S04 và bảng điều phối).

### 2.5 Hộp thoại – `Modal`, `ConfirmDialog`
- Dựng trên `<dialog>` gốc với `showModal()`: chặn tương tác với màn cha, đóng được bằng Esc, giữ focus bên trong hộp thoại. Đây là mẫu **Dependent child screen** trong slide Bài 05.
- `ConfirmDialog` nhận các props: `title`, `message`, `confirmLabel`, `danger`, `reasonLabel?`, `onConfirm(reason)`, `onClose`.
  - Khi có `reasonLabel`, hộp thoại bắt buộc nhập lý do (1–255 ký tự). Bỏ trống sẽ báo "Vui lòng nhập {lý do …}." và không gọi `onConfirm`.
  - Nếu `onConfirm` ném lỗi, lỗi hiện trong hộp thoại và hộp thoại vẫn mở. Nút xác nhận có trạng thái loading.

```tsx
// Tuần 2 – S04 Hủy yêu cầu (UC05)
<ConfirmDialog title="Hủy yêu cầu cứu hộ" danger confirmLabel="Xác nhận hủy" reasonLabel="Lý do hủy"
  message="Chỉ hủy được khi đơn còn Chờ tiếp nhận."
  onConfirm={(reason) => apiFetch(`/rescue-requests/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) })}
  onClose={() => setOpen(false)} />
```

---

## 3. Component bản đồ (Actor S2 – OpenStreetMap)

Dùng Leaflet + react-leaflet với bản đồ nền OpenStreetMap, không cần API key. Ghim được vẽ bằng CSS theo token màu (`danger` = vị trí sự cố, `primary` = công ty, `success`), không dùng ảnh marker mặc định của Leaflet vì ảnh này hay hỏng đường dẫn khi build bằng Vite. Tâm mặc định là Hồ Hoàn Kiếm, Hà Nội.

### 3.1 `LocationPicker` – chọn một tọa độ
| Prop | Kiểu | Ghi chú |
|---|---|---|
| `value` | `{ lat, lng } \| null` | Tọa độ hiện tại; `null` = chưa chọn |
| `onChange` | `(p) => void` | Gọi khi chạm bản đồ, kéo ghim hoặc lấy được GPS (làm tròn 6 chữ số) |
| `label`, `error` | string | Lỗi → viền đỏ + chữ đỏ dưới bản đồ |
| `disabled` | boolean | Chỉ xem (công ty chưa duyệt) |
| `autoLocate` | boolean | Tự lấy GPS khi mở nếu chưa có vị trí (dùng cho S02) |
| `height` | number (px) | Mặc định 280 |

Hành vi (báo cáo 3.2.1-c, UC03-2.1):
1. Nút "Dùng vị trí hiện tại": khi đang lấy GPS, nút đổi thành "Đang xác định vị trí hiện tại...", chờ tối đa **5 giây**.
2. Nếu GPS bị từ chối hoặc quá 5 giây: hiện banner vàng "Không lấy được vị trí… Hãy chạm vào bản đồ để chọn vị trí". Banner tự ẩn khi người dùng chạm chọn.
3. Chạm vào bản đồ để đặt ghim, kéo ghim để chỉnh. Tọa độ hiện dạng chữ bên dưới, có `aria-live` để trình đọc màn hình đọc được.

```tsx
const [pos, setPos] = useState<LatLng | null>(null);
<LocationPicker label="Vị trí sự cố" value={pos} onChange={setPos} autoLocate error={err?.field === 'lat' ? err.message : undefined} />
```

### 3.2 `MarkersMap` – hiển thị nhiều điểm
`markers: { id, lat, lng, label, tone? }[]`, `height?`. Bản đồ tự căn khung cho vừa mọi điểm (một điểm thì zoom 15), chạm vào ghim để xem nhãn. Dùng cho S03 (vị trí sự cố + các công ty gợi ý), S04 (sự cố + trạm công ty), AD-01 (vị trí trạm của hồ sơ).

---

## 4. Ánh xạ UI Guidelines → code

| Quy chuẩn (báo cáo 3.2.1) | Cài đặt |
|---|---|
| Màu Primary/Danger/Success/Warning, chữ, nền, viền | Token trong `design-tokens.css` → utility Tailwind (`bg-primary`, `text-danger`…); component không chứa mã hex |
| Typography Inter: Title 24, Heading 20, Body 16, Label 14 | `text-title`, `text-heading`, `text-body`, `text-label` |
| Vùng chạm ≥ 44 px, nút ngoài trời 48 px, nút khẩn cấp 56 px, nút desktop 36 px | `Button size="lg" / "xl" / "sm"`; ô nhập cao 48 px |
| Card nền sáng, viền 1 px, bo 12 px | `CARD` = `rounded-card border border-border bg-surface` |
| Label luôn hiện, lỗi ngay dưới ô, không mất dữ liệu | `Field` / `useForm` / lỗi `details.field` từ API |
| Status chip màu + chữ | `StatusChip`, `RescueStatusChip` |
| Thông báo theo tình huống | `Alert`, `useToast`, `NetworkBanner`, banner GPS trong `LocationPicker` |
| Dependent child screen (modal) | `Modal`, `ConfirmDialog` |
| Truy cập: focus state, nhãn chữ cho thao tác quan trọng | Focus ring trên nút và ô nhập, `aria-invalid` / `aria-describedby`, `role="alert"` / `"status"` |

---

## 5. Mockup high-fidelity

File Figma: [M4 – Roadside Assistance](https://www.figma.com/design/VWHGe3zp03lWKj1ZTteq7l/M4---Roadside-Assistance---Low-Fidelity-Mobile-Wireframes).

Trong file có ba phần:

- `Page 1`: 4 wireframe low-fidelity mobile ban đầu.
- `01 Design System`: token màu, typography và component Button / Field / StatusChip / Alert / ConfirmDialog / LocationPicker bám theo mục 4.
- `02 High-fidelity — Tuần 1`: A-01 đăng nhập, A-02 đăng ký User/Company, A-03 tài khoản, C-01 hồ sơ công ty và AD-01 thẩm định đơn vị.

Bản high-fidelity hiện là **bản nháp cần căn chỉnh lần cuối**: chuẩn hóa control mobile về cùng chiều rộng `358 px`, sửa auto-layout/`Fill container` và cân lại hai màn desktop trước khi xuất ảnh cho báo cáo. Không dùng bản nháp này làm ảnh nộp cuối cùng cho tới khi hoàn tất việc căn chỉnh.

## 6. Kiểm thử UI Kit

Ngày 27/11/2026 đã kiểm tra thủ công trang `/ui-kit`: Button, form control, Alert, status chip, toast, modal, GPS, marker, offline banner và responsive hoạt động đúng đặc tả.

Automated test nằm tại [`src/shared/ui/ui-kit.test.tsx`](../../src/shared/ui/ui-kit.test.tsx), chạy bằng Vitest + Testing Library trong môi trường jsdom:

```bash
npm run test:ui   # chỉ UI Kit M4
npm run test:all  # 30 test backend + 9 test UI
```

Kết quả ngày 27/11/2026: **9/9 UI test pass**, **30/30 backend test pass**, `npm run typecheck` và `npm run build` đều pass. Phạm vi automated test gồm loading/disabled của Button, liên kết label–error–ARIA của form, role của Alert, nhãn chữ của status chip và validation/error bất đồng bộ của `ConfirmDialog`.

## 7. Việc còn mở
1. **Căn chỉnh bản high-fidelity Figma** và chụp lại ảnh sau khi mọi control mobile thẳng mép, desktop cân cột.
2. **Tìm theo địa chỉ** (gõ địa chỉ để ra tọa độ) cần dịch vụ geocoding. Nên làm cùng MapsSubsystem của M1 ở Tuần 2, rồi thêm ô tìm vào `LocationPicker`.
3. **Lưu bản nháp khi mất mạng** (báo cáo 3.2.1-c) thuộc form S02, M2 làm ở Tuần 2. `NetworkBanner` hiện chỉ báo trạng thái mạng.
4. Bản đồ dùng tile công khai `tile.openstreetmap.org`, chỉ phù hợp cho demo hoặc lưu lượng thấp theo chính sách sử dụng của OSM.
