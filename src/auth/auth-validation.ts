// Validation đăng ký – dùng chung cho API (auth.api.ts) và form (RegisterPage.tsx). Quy tắc: api-contract.md §1.4, §3.2.

export type Role = 'USER' | 'COMPANY' | 'ADMIN';
export type FieldError = { field: string; message: string };

export const PHONE_RE = /^0\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

/** Trả lỗi đầu tiên theo thứ tự ô trên form (để UI báo đúng ô) hoặc null nếu hợp lệ. */
export function validateRegister(body: any): FieldError | null {
  if (body?.role !== 'USER' && body?.role !== 'COMPANY') return { field: 'role', message: 'Vui lòng chọn loại tài khoản.' };
  if (!str(body.fullName)) return { field: 'fullName', message: 'Vui lòng nhập họ tên.' };
  if (!PHONE_RE.test(str(body.phone))) return { field: 'phone', message: 'Số điện thoại không hợp lệ.' };
  if (!EMAIL_RE.test(str(body.email))) return { field: 'email', message: 'Email không hợp lệ.' };
  if (typeof body.password !== 'string' || body.password.length < 8) return { field: 'password', message: 'Mật khẩu phải có ít nhất 8 ký tự.' };
  if (body.role === 'USER') return null;

  const c = body.company ?? {};
  const profileErr = validateCompanyProfile(c);
  if (profileErr) return { field: `company.${profileErr.field}`, message: profileErr.message };
  if (!str(c.licenseNumber)) return { field: 'company.licenseNumber', message: 'Vui lòng nhập số giấy phép kinh doanh.' };
  if (!str(c.licenseFileUrl)) return { field: 'company.licenseFileUrl', message: 'Vui lòng tải lên giấy phép kinh doanh.' };
  return null;
}

/** Hồ sơ & phạm vi hoạt động công ty – dùng khi đăng ký (UC01) và khi công ty cập nhật (UC08, PUT /companies/me). */
export function validateCompanyProfile(c: any): FieldError | null {
  if (!str(c?.name)) return { field: 'name', message: 'Vui lòng nhập tên công ty.' };
  if (!PHONE_RE.test(str(c.phone))) return { field: 'phone', message: 'Số điện thoại công ty không hợp lệ.' };
  if (!str(c.address)) return { field: 'address', message: 'Vui lòng nhập địa chỉ trạm.' };
  const lat = num(c.stationLat), lng = num(c.stationLng);
  if (!(lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110)) return { field: 'stationLat', message: 'Vui lòng xác định vị trí trạm trên lãnh thổ Việt Nam.' };
  if (!(num(c.serviceRadiusKm) > 0)) return { field: 'serviceRadiusKm', message: 'Bán kính phục vụ phải lớn hơn 0 km.' };
  return null;
}
