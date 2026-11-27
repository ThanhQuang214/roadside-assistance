import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateRequestPage from './CreateRequestPage.tsx';
import DispatchPage from './DispatchPage.tsx';
import RescueHomePage from './RescueHomePage.tsx';
import TrackRequestPage from './TrackRequestPage.tsx';
import type { RescueRequest } from './rescue-store.ts';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../auth/session.tsx', () => ({
  apiFetch: mocks.apiFetch,
  useAuth: () => ({ user: { id: 1, fullName: 'Nguyễn Văn An', phone: '0912345678', role: 'USER' } }),
}));

vi.mock('../shared/ui/map.tsx', () => ({
  LocationPicker: ({ onChange, error }: { onChange: (p: { lat: number; lng: number }) => void; error?: string }) => (
    <div>
      <button type="button" onClick={() => onChange({ lat: 21.0285, lng: 105.8542 })}>Chọn vị trí GPS</button>
      {error && <span>{error}</span>}
    </div>
  ),
  MarkersMap: () => <div aria-label="Bản đồ vị trí" />,
}));

const request: RescueRequest = {
  id: 12,
  status: 'Pending',
  createdAt: '2026-11-27T02:00:00.000Z',
  updatedAt: '2026-11-27T02:00:00.000Z',
  acceptedAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  rejectedAt: null,
  lat: 21.0285,
  lng: 105.8542,
  address: 'Hồ Gươm',
  description: 'Xe máy bị thủng lốp sau, không thể tiếp tục di chuyển.',
  contactPhone: '0912345678',
  photoUrl: null,
  vehicleType: { code: 'MOTORBIKE', name: 'Xe máy' },
  service: { id: 3, name: 'Vá lốp', serviceTypeCode: 'TIRE' },
  company: { id: 2, name: 'Cứu hộ Hà Nội', phone: '0241234567', stationLat: 21.03, stationLng: 105.85 },
  user: { id: 1, fullName: 'Nguyễn Văn An' },
  distanceKm: 1.3,
  estimatedPrice: 150000,
  etaMinutes: null,
  cancelReason: null,
  rejectReason: null,
  classification: null,
  payment: null,
  reviewed: false,
};

beforeEach(() => { mocks.apiFetch.mockReset(); });

describe('ghép nối UI tuần 2', () => {
  it('Home cho thử lại sau lỗi tải và xóa banner khi thành công', async () => {
    mocks.apiFetch
      .mockRejectedValueOnce(new Error('Không thể kết nối máy chủ, vui lòng thử lại.'))
      .mockResolvedValueOnce({ items: [] });
    const user = userEvent.setup();

    render(<MemoryRouter><RescueHomePage /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Chưa có yêu cầu nào đã kết thúc.')).toBeTruthy();
    expect(screen.queryByText('Không thể kết nối máy chủ, vui lòng thử lại.')).toBeNull();
  });

  it('màn theo dõi cho thử lại mà không làm mất route requestId', async () => {
    mocks.apiFetch
      .mockRejectedValueOnce(new Error('Mạng không ổn định.'))
      .mockResolvedValue({ request });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/requests/12']}>
        <Routes><Route path="/requests/:id" element={<TrackRequestPage />} /></Routes>
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByRole('heading', { name: 'Yêu cầu #12' })).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenLastCalledWith('/rescue-requests/12');
  });

  it('màn tạo yêu cầu báo lỗi danh mục và tải lại được', async () => {
    mocks.apiFetch.mockImplementation((path: string) => {
      const vehicleCalls = mocks.apiFetch.mock.calls.filter(([p]) => p === '/catalog/vehicle-types').length;
      if (path === '/catalog/vehicle-types' && vehicleCalls === 1) return Promise.reject(new Error('Không tải được danh mục.'));
      if (path === '/catalog/vehicle-types') return Promise.resolve({ items: [{ id: 1, code: 'MOTORBIKE', name: 'Xe máy' }] });
      if (path === '/catalog/service-types') return Promise.resolve({ items: [{ id: 2, code: 'TIRE', name: 'Vá lốp' }] });
      return Promise.reject(new Error(`API ngoài dự kiến: ${path}`));
    });
    const user = userEvent.setup();

    render(<MemoryRouter><CreateRequestPage /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Xe máy')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Phân tích & Tìm cứu hộ' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('giữ modal và dữ liệu từ chối khi lỗi mạng để công ty gửi lại', async () => {
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/rescue-requests') return Promise.resolve({ items: [request] });
      if (path === '/rescue-requests/12') return Promise.resolve({ request });
      if (path === '/rescue-requests/12/reject') {
        return Promise.reject(Object.assign(new Error('Không thể kết nối máy chủ, vui lòng thử lại.'), { status: 0 }));
      }
      return Promise.reject(new Error(`API ngoài dự kiến: ${path}`));
    });
    const user = userEvent.setup();

    render(<MemoryRouter><DispatchPage /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: '#12' }));
    await user.click(screen.getByRole('button', { name: 'Từ chối đơn' }));
    await user.click(screen.getByRole('button', { name: 'Hết xe / thiết bị phù hợp' }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText('Không thể kết nối máy chủ, vui lòng thử lại.')).toBeTruthy();
    expect((within(dialog).getByRole('textbox', { name: 'Lý do từ chối' }) as HTMLTextAreaElement).value)
      .toBe('Hết xe / thiết bị phù hợp');
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith('/rescue-requests/12/reject', expect.anything()));
  });
});
