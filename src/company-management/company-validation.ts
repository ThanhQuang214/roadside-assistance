// Validation UC08 – dùng chung cho API (company.api.ts) và form (CompanyManagePage.tsx).
// Hồ sơ công ty dùng validateCompanyProfile trong auth-validation.ts (chung với đăng ký UC01).
import type { FieldError } from '../auth/auth-validation.ts';
export { validateCompanyProfile } from '../auth/auth-validation.ts';

export const VEHICLE_STATUSES = ['Available', 'Busy', 'Maintenance'] as const;
export const VEHICLE_STATUS_LABEL = { Available: 'Sẵn sàng', Busy: 'Đang làm nhiệm vụ', Maintenance: 'Bảo trì' };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

/** Gói dịch vụ. Tạo mới cần serviceTypeCode; sửa cần isActive (UC08-3a, 5.1). */
export function validateService(s: any, mode: 'create' | 'update'): FieldError | null {
  if (mode === 'create' && !str(s?.serviceTypeCode)) return { field: 'serviceTypeCode', message: 'Vui lòng chọn loại dịch vụ.' };
  if (!str(s?.name)) return { field: 'name', message: 'Vui lòng nhập tên gói dịch vụ.' };
  if (s.description != null && typeof s.description !== 'string') return { field: 'description', message: 'Mô tả không hợp lệ.' };
  const price = num(s.basePrice);
  if (!(Number.isInteger(price) && price > 0)) return { field: 'basePrice', message: 'Giá niêm yết phải là số nguyên VND lớn hơn 0.' };
  if (mode === 'update' && typeof s.isActive !== 'boolean') return { field: 'isActive', message: 'Trạng thái cung cấp không hợp lệ.' };
  return null;
}

/** Phương tiện cứu hộ. Tạo mới được bỏ trống status (mặc định Available) (UC08-3b). */
export function validateVehicle(v: any, mode: 'create' | 'update'): FieldError | null {
  if (!str(v?.kind)) return { field: 'kind', message: 'Vui lòng nhập loại xe / thiết bị.' };
  if (!str(v.plateNumber)) return { field: 'plateNumber', message: 'Vui lòng nhập biển số / mã phương tiện.' };
  if ((mode === 'update' || v.status != null) && !VEHICLE_STATUSES.includes(v.status)) return { field: 'status', message: 'Trạng thái phương tiện không hợp lệ.' };
  return null;
}
