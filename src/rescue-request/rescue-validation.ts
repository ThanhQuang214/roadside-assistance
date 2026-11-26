// Validation đơn cứu hộ – dùng chung cho API và form (S02, S04, C-02). Quy tắc: api-contract.md §1.4, §3.4.
import { PHONE_RE, type FieldError } from '../auth/auth-validation.ts';
import { INCIDENT_TYPES, URGENCIES } from '../matching-ai/incident-types.ts';

/** Đơn chưa kết thúc: S01 xếp vào "Đang xử lý", S04 tiếp tục polling. */
export const ACTIVE_STATUSES: string[] = ['Pending', 'Accepted', 'InProgress'];

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'EWALLET'] as const;
export const PAYMENT_METHOD_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', EWALLET: 'Ví điện tử' };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const posInt = (v: unknown) => Number.isInteger(num(v)) && num(v) > 0;

/** Tọa độ trên lãnh thổ Việt Nam (lat ∈ [8, 24], lng ∈ [102, 110]). */
export function validateLocation(b: any): FieldError | null {
  const lat = num(b?.lat), lng = num(b?.lng);
  return lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110 ? null : { field: 'lat', message: 'Vui lòng xác định vị trí sự cố trên lãnh thổ Việt Nam.' };
}

/** Phần người dùng nhập ở S02 (trước khi tìm công ty). Thứ tự = thứ tự ô trên form. */
export function validateRequestDraft(b: any): FieldError | null {
  const loc = validateLocation(b);
  if (loc) return loc;
  if (b.address != null && (typeof b.address !== 'string' || b.address.trim().length > 255)) return { field: 'address', message: 'Địa chỉ tối đa 255 ký tự.' };
  if (!str(b.vehicleTypeCode)) return { field: 'vehicleTypeCode', message: 'Vui lòng chọn loại phương tiện.' };
  const d = str(b.description).length;
  if (d < 10 || d > 500) return { field: 'description', message: 'Mô tả sự cố phải có từ 10 đến 500 ký tự.' };
  if (!PHONE_RE.test(str(b.contactPhone))) return { field: 'contactPhone', message: 'Số điện thoại liên hệ không hợp lệ.' };
  // Chỉ nhận ảnh đã upload qua POST /uploads: công ty sẽ mở URL này, không cho trỏ ra trang ngoài.
  if (b.photoUrl != null && !/^\/api\/uploads\/[\w-]+\.(jpg|png|webp)$/.test(b.photoUrl)) return { field: 'photoUrl', message: 'Ảnh hiện trường phải là JPG, PNG hoặc WebP.' };
  return null;
}

/** Toàn bộ body POST /rescue-requests (S03 gửi). */
export function validateCreateRequest(b: any): FieldError | null {
  const draft = validateRequestDraft(b ?? {});
  if (draft) return draft;
  if (!posInt(b.companyId) || !posInt(b.serviceId)) return { field: 'serviceId', message: 'Vui lòng chọn một công ty cứu hộ.' };
  const c = b.classification;
  if (!c || !INCIDENT_TYPES.includes(c.incidentType) || !URGENCIES.includes(c.urgency) || !['AI', 'MANUAL'].includes(c.source)
    || (c.confidence != null && !(num(c.confidence) >= 0 && num(c.confidence) <= 1))) {
    return { field: 'classification', message: 'Kết quả phân loại sự cố không hợp lệ.' };
  }
  return null;
}

export function validateEta(v: unknown): FieldError | null {
  const n = num(v);
  return Number.isInteger(n) && n >= 1 && n <= 600 ? null : { field: 'etaMinutes', message: 'ETA phải là số phút nguyên từ 1 đến 600.' };
}

export function validateReason(v: unknown): FieldError | null {
  const n = str(v).length;
  return n >= 1 && n <= 255 ? null : { field: 'reason', message: 'Vui lòng nhập lý do (tối đa 255 ký tự).' };
}

export function validatePayment(p: any): FieldError | null {
  const amount = num(p?.amount);
  if (!(Number.isInteger(amount) && amount >= 0)) return { field: 'amount', message: 'Số tiền phải là số nguyên VND, không âm.' };
  if (!PAYMENT_METHODS.includes(p.method)) return { field: 'method', message: 'Vui lòng chọn phương thức thanh toán.' };
  if (p.note != null && (typeof p.note !== 'string' || p.note.length > 255)) return { field: 'note', message: 'Ghi chú tối đa 255 ký tự.' };
  return null;
}
