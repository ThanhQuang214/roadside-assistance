// Chip trạng thái thẩm định công ty (dùng StatusChip của UI Kit: màu + nhãn chữ).
import { StatusChip, type ChipTone } from '../shared/ui/feedback.tsx';

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = { Pending: 'Chờ duyệt', Approved: 'Đã duyệt', Rejected: 'Bị từ chối' };
const TONE: Record<ApprovalStatus, ChipTone> = { Pending: 'pending', Approved: 'completed', Rejected: 'closed' };

export const ApprovalChip = ({ status }: { status: ApprovalStatus }) => <StatusChip tone={TONE[status]}>{APPROVAL_LABEL[status]}</StatusChip>;
