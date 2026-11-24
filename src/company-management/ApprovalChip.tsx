// Chip trạng thái thẩm định công ty: màu + nhãn chữ (không chỉ dựa vào màu).
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = { Pending: 'Chờ duyệt', Approved: 'Đã duyệt', Rejected: 'Bị từ chối' };
const CLS: Record<ApprovalStatus, string> = {
  Pending: 'bg-status-pending-bg text-status-pending-fg',
  Approved: 'bg-status-completed-bg text-status-completed-fg',
  Rejected: 'bg-status-closed-bg text-status-closed-fg',
};

export function ApprovalChip({ status }: { status: ApprovalStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-label ${CLS[status]}`}>{APPROVAL_LABEL[status]}</span>;
}
