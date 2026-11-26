// Nhãn phân loại sự cố (AI S1 hoặc người dùng tự chọn) – api-contract.md §3.3, §4. Dùng chung API + UI; Tuần 3 AI trả đúng các nhãn này.

export const INCIDENT_TYPES = ['FLAT_TIRE', 'DEAD_BATTERY', 'OUT_OF_FUEL', 'ENGINE_FAILURE', 'ACCIDENT', 'LOCKOUT', 'OTHER'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export const URGENCIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Urgency = (typeof URGENCIES)[number];

export const INCIDENT_LABEL: Record<IncidentType, string> = {
  FLAT_TIRE: 'Thủng / hỏng lốp', DEAD_BATTERY: 'Hết ắc quy', OUT_OF_FUEL: 'Hết nhiên liệu', ENGINE_FAILURE: 'Hỏng động cơ',
  ACCIDENT: 'Tai nạn / va chạm', LOCKOUT: 'Kẹt khóa / mất chìa', OTHER: 'Sự cố khác',
};
export const URGENCY_LABEL: Record<Urgency, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao' };

/** §4: nhãn AI → loại dịch vụ đề xuất (null = người dùng tự chọn). */
export const SUGGESTED_SERVICE_TYPE: Record<IncidentType, string | null> = {
  FLAT_TIRE: 'TIRE', DEAD_BATTERY: 'BATTERY', OUT_OF_FUEL: 'FUEL', ENGINE_FAILURE: 'ON_SITE_REPAIR',
  ACCIDENT: 'TOWING', LOCKOUT: 'LOCKOUT', OTHER: null,
};

export type Classification = { incidentType: IncidentType; urgency: Urgency; confidence: number | null; source: 'AI' | 'MANUAL' };
