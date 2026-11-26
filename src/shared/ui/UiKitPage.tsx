// Danh mục UI Kit (M4) chạy trực tiếp – route /ui-kit. Dùng để đối chiếu UI Guidelines và chụp hình cho chương Thiết kế giao diện.
import { useState, type ReactNode } from 'react';
import { RESCUE_STATUSES } from '../state/rescue-request-state.ts';
import { Alert, RescueStatusChip, StatusChip, useToast } from './feedback.tsx';
import { Button, CARD, Field, InfoRow, SelectField, TextAreaField } from './form.tsx';
import { LocationPicker, MarkersMap, type LatLng } from './map.tsx';
import { ConfirmDialog } from './modal.tsx';

const COLORS = [
  ['primary', 'bg-primary', 'Hành động chính'], ['danger', 'bg-danger', 'Hủy, lỗi, Cancelled/Rejected'],
  ['success', 'bg-success', 'Thành công, Completed'], ['warning', 'bg-warning', 'Chờ xử lý, Pending'],
  ['text', 'bg-text', 'Chữ chính'], ['text-sub', 'bg-text-sub', 'Chữ phụ'],
  ['border', 'bg-border', 'Viền, phân cách'], ['background', 'bg-background', 'Nền màn hình'],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <h2 className="text-heading">{title}</h2>
      {children}
    </section>
  );
}

export default function UiKitPage() {
  const [toast, showToast] = useToast();
  const [dialog, setDialog] = useState<'confirm' | 'reason' | null>(null);
  const [pos, setPos] = useState<LatLng | null>(null);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-title">UI Kit – Hệ thống hỗ trợ sự cố xe</h1>
        <p className="text-body-sm text-text-sub">Component dùng chung trong <code>src/shared/ui</code>. Giá trị lấy từ <code>docs/contracts/design-tokens.css</code>.</p>
      </header>

      <Section title="Màu sắc">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLORS.map(([name, cls, use]) => (
            <div key={name} className="flex flex-col gap-1">
              <div className={`h-12 rounded-control border border-border ${cls}`} />
              <span className="text-label">{name}</span>
              <span className="text-caption text-text-sub">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Chữ (Inter)">
        <p className="text-title">Title 24/700 – Theo dõi yêu cầu</p>
        <p className="text-heading">Heading 20/600 – Đơn vị cứu hộ gợi ý</p>
        <p className="text-body">Body 16 – Mô tả sự cố, ô nhập ngoài trời</p>
        <p className="text-body-sm">Body-sm 14 – Nội dung bảng</p>
        <p className="text-label">Label 14/500 – Nhãn ô nhập</p>
        <p className="text-caption text-text-sub">Caption 12 – Chú thích</p>
      </Section>

      <Section title="Nút – default / loading / disabled">
        <Button size="xl" variant="danger" block>Gọi cứu hộ ngay</Button>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button loading loadingText="Đang gửi…">Gửi</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">Nhỏ 36px</Button>
          <Button size="sm" variant="secondary">Sửa</Button>
          <Button size="sm" variant="danger">Từ chối</Button>
        </div>
      </Section>

      <Section title="Ô nhập – label luôn hiện, lỗi dưới ô">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Số điện thoại liên hệ" placeholder="0912345678" hint="10 chữ số, bắt đầu bằng 0" />
          <Field label="Số điện thoại liên hệ" defaultValue="12345" error="Số điện thoại liên hệ không hợp lệ." />
          <SelectField label="Loại phương tiện" defaultValue="">
            <option value="">— Chọn loại xe —</option>
            <option>Xe máy</option>
            <option>Ô tô con</option>
          </SelectField>
          <Field label="Ô bị khóa" defaultValue="Không sửa được" disabled />
          <div className="md:col-span-2"><TextAreaField label="Mô tả sự cố" placeholder="Xe bị thủng lốp trước…" hint="10–500 ký tự" /></div>
        </div>
      </Section>

      <Section title="Chip trạng thái – màu + nhãn chữ">
        <div className="flex flex-wrap gap-2">{RESCUE_STATUSES.map((s) => <RescueStatusChip key={s} status={s} />)}</div>
        <div className="flex flex-wrap gap-2">
          <StatusChip tone="pending">Chờ duyệt</StatusChip>
          <StatusChip tone="completed">Đã duyệt</StatusChip>
          <StatusChip tone="closed">Bị từ chối</StatusChip>
        </div>
      </Section>

      <Section title="Thông báo">
        <Alert>Gửi yêu cầu thất bại. Vui lòng thử lại.</Alert>
        <Alert tone="warning">GPS bị từ chối. Hãy chạm vào bản đồ để chọn vị trí.</Alert>
        <Alert tone="info">Không thể phân tích tự động, chuyển sang tự chọn dịch vụ.</Alert>
        <Alert tone="success" action={<Button size="sm" variant="secondary">Xem đơn</Button>}>Đã gửi yêu cầu cứu hộ.</Alert>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => showToast('Đã lưu thay đổi')}>Hiện toast (tự ẩn 3 giây)</Button>
        </div>
        <p className="text-caption text-text-sub">Banner "Đã mất kết nối mạng" tự hiện ở đầu trang khi trình duyệt offline (DevTools → Network → Offline).</p>
      </Section>

      <Section title="Hộp thoại (Dependent child screen)">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialog('confirm')}>Xác nhận xóa</Button>
          <Button variant="danger" onClick={() => setDialog('reason')}>Hủy yêu cầu (bắt buộc lý do)</Button>
        </div>
      </Section>

      <Section title="Bản đồ – chọn vị trí">
        <LocationPicker label="Vị trí sự cố" value={pos} onChange={setPos} />
        <dl className="text-body-sm"><InfoRow label="Giá trị onChange" value={pos ? JSON.stringify(pos) : 'null'} /></dl>
      </Section>

      <Section title="Bản đồ – hiển thị marker">
        <MarkersMap markers={[
          { id: 'incident', lat: 21.0285, lng: 105.8542, label: 'Vị trí sự cố', tone: 'danger' },
          { id: 'c1', lat: 21.0368, lng: 105.8345, label: 'Cứu hộ Ba Đình – 2,4 km' },
          { id: 'c2', lat: 21.0122, lng: 105.8710, label: 'Cứu hộ Hai Bà Trưng – 2,5 km' },
        ]} />
      </Section>

      {dialog === 'confirm' && (
        <ConfirmDialog title="Xóa gói dịch vụ" danger confirmLabel="Xóa gói" message="Gói đã có đơn cứu hộ sẽ không xóa được."
          onClose={() => setDialog(null)} onConfirm={() => { setDialog(null); showToast('Đã xóa'); }} />
      )}
      {dialog === 'reason' && (
        <ConfirmDialog title="Hủy yêu cầu cứu hộ" danger confirmLabel="Xác nhận hủy" reasonLabel="Lý do hủy"
          reasonOptions={['Đã tự khắc phục được', 'Đã tìm được cứu hộ khác']}
          message="Chỉ hủy được khi đơn còn Chờ tiếp nhận."
          onClose={() => setDialog(null)} onConfirm={(reason) => { setDialog(null); showToast(`Đã hủy: ${reason}`); }} />
      )}
      {toast}
    </main>
  );
}
