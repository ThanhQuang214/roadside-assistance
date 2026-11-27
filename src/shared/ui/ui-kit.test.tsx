import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Alert, RescueStatusChip, StatusChip } from './feedback.tsx';
import { Button, Field, SelectField, TextAreaField } from './form.tsx';
import { ConfirmDialog } from './modal.tsx';

describe('Button', () => {
  it('khóa thao tác và thông báo trạng thái khi loading', () => {
    render(<Button loading loadingText="Đang gửi yêu cầu…">Gửi yêu cầu</Button>);

    const button = screen.getByRole('button', { name: 'Đang gửi yêu cầu…' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('giữ nguyên thuộc tính HTML và trạng thái disabled', () => {
    render(<Button type="submit" disabled>Đăng nhập</Button>);

    const button = screen.getByRole('button', { name: 'Đăng nhập' }) as HTMLButtonElement;
    expect(button.type).toBe('submit');
    expect(button.disabled).toBe(true);
  });
});

describe('Form controls', () => {
  it('liên kết label, lỗi và aria-invalid cho Field', () => {
    render(<Field label="Số điện thoại" error="Số điện thoại không hợp lệ." />);

    const input = screen.getByRole('textbox', { name: 'Số điện thoại' });
    const error = screen.getByText('Số điện thoại không hợp lệ.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('hiển thị hint khi không có lỗi và hỗ trợ select/textarea', () => {
    render(
      <>
        <Field label="Email" hint="Dùng email đang hoạt động" />
        <SelectField label="Loại xe" defaultValue="MOTORBIKE">
          <option value="MOTORBIKE">Xe máy</option>
        </SelectField>
        <TextAreaField label="Mô tả sự cố" />
      </>,
    );

    expect(screen.getByText('Dùng email đang hoạt động')).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Loại xe' }) as HTMLSelectElement).value).toBe('MOTORBIKE');
    expect(screen.getByRole('textbox', { name: 'Mô tả sự cố' })).toBeTruthy();
  });
});

describe('Feedback', () => {
  it('dùng role phù hợp cho lỗi và thông tin', () => {
    render(
      <>
        <Alert>Không thể gửi yêu cầu.</Alert>
        <Alert tone="info">Đang tìm công ty phù hợp.</Alert>
      </>,
    );

    expect(screen.getByRole('alert').textContent).toContain('Không thể gửi');
    expect(screen.getByRole('status').textContent).toContain('Đang tìm');
  });

  it('luôn hiển thị nhãn chữ cho chip trạng thái', () => {
    render(
      <>
        <StatusChip tone="pending">Chờ duyệt</StatusChip>
        <RescueStatusChip status="InProgress" />
      </>,
    );

    expect(screen.getByText('Chờ duyệt')).toBeTruthy();
    expect(screen.getByText('Đang xử lý')).toBeTruthy();
  });
});

describe('ConfirmDialog', () => {
  it('không xác nhận khi thiếu lý do', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        title="Hủy yêu cầu"
        confirmLabel="Xác nhận hủy"
        reasonLabel="Lý do hủy"
        onConfirm={onConfirm}
        onClose={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Xác nhận hủy' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Vui lòng nhập lý do hủy.')).toBeTruthy();
  });

  it('điền lý do nhanh, cho sửa và gửi giá trị đã trim', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        title="Hủy yêu cầu"
        confirmLabel="Xác nhận hủy"
        reasonLabel="Lý do hủy"
        reasonOptions={['Đã tự khắc phục được']}
        onConfirm={onConfirm}
        onClose={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Đã tự khắc phục được' }));
    const reason = screen.getByRole('textbox', { name: 'Lý do hủy' }) as HTMLTextAreaElement;
    expect(reason.value).toBe('Đã tự khắc phục được');

    fireEvent.change(reason, { target: { value: '  Đổi kế hoạch  ' } });
    await user.click(screen.getByRole('button', { name: 'Xác nhận hủy' }));
    expect(onConfirm).toHaveBeenCalledWith('Đổi kế hoạch');
  });

  it('hiển thị lỗi bất đồng bộ và giữ hộp thoại mở', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error('Đơn đã được tiếp nhận.'));
    render(
      <ConfirmDialog
        title="Hủy yêu cầu"
        confirmLabel="Xác nhận hủy"
        onConfirm={onConfirm}
        onClose={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Xác nhận hủy' }));
    expect(await screen.findByText('Đơn đã được tiếp nhận.')).toBeTruthy();
    expect(screen.getByRole('dialog').hasAttribute('open')).toBe(true);
  });
});
