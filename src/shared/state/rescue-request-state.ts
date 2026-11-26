/**
 * State Pattern – vòng đời RescueRequest (báo cáo mục 3.4.2).
 *   Pending ─accept→ Accepted ─start→ InProgress ─complete→ Completed
 *   Pending ─cancel→ Cancelled      Pending ─reject→ Rejected
 * Mỗi lớp State chỉ override thao tác được phép; mọi thao tác khác ném InvalidTransitionError (→ HTTP 409).
 * Kiểm tra dữ liệu đầu vào (ETA > 0, lý do không rỗng) do controller làm trước khi gọi (api-contract §1.4).
 */

export const RESCUE_STATUSES = ['Pending', 'Accepted', 'InProgress', 'Completed', 'Cancelled', 'Rejected'] as const;
export type RescueStatus = (typeof RESCUE_STATUSES)[number];
export type RescueAction = 'accept' | 'reject' | 'cancel' | 'start' | 'complete' | 'updateEta' | 'recordPayment' | 'review';

/** Nhãn tiếng Việt – dùng cho thông báo lỗi 409 và chip trạng thái (shared/ui/feedback.tsx). */
export const RESCUE_STATUS_LABEL: Record<RescueStatus, string> = {
  Pending: 'Chờ tiếp nhận', Accepted: 'Đã tiếp nhận', InProgress: 'Đang xử lý',
  Completed: 'Hoàn tất', Cancelled: 'Đã hủy', Rejected: 'Bị từ chối',
};
const ACTION_LABEL: Record<RescueAction, string> = {
  accept: 'nhận đơn', reject: 'từ chối đơn', cancel: 'hủy yêu cầu', start: 'bắt đầu xử lý', complete: 'hoàn tất đơn',
  updateEta: 'cập nhật ETA', recordPayment: 'ghi nhận thanh toán', review: 'đánh giá',
};

export class InvalidTransitionError extends Error {
  readonly code = 'INVALID_STATE_TRANSITION';
  readonly status: RescueStatus;
  readonly action: RescueAction;

  constructor(status: RescueStatus, action: RescueAction) {
    // UC05-4.1 / UC09-4.1: người dùng cần biết đơn đang ở trạng thái nào để hiểu vì sao bị chặn.
    super(`Không thể ${ACTION_LABEL[action]} vì đơn cứu hộ đang ở trạng thái "${RESCUE_STATUS_LABEL[status]}".`);
    this.status = status;
    this.action = action;
  }
}

/** Các trường của rescue_requests mà vòng đời được phép thay đổi. */
export interface RescueLifecycleData {
  id: number;
  status: RescueStatus;
  etaMinutes: number | null;
  cancelReason: string | null;
  rejectReason: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  rejectedAt: string | null;
}

export interface RescueState {
  readonly status: RescueStatus;
  accept(ctx: RescueRequestContext, etaMinutes: number): void;
  reject(ctx: RescueRequestContext, reason: string): void;
  cancel(ctx: RescueRequestContext, reason: string): void;
  start(ctx: RescueRequestContext): void;
  complete(ctx: RescueRequestContext): void;
  updateEta(ctx: RescueRequestContext, etaMinutes: number): void;
  canRecordPayment(): boolean;
  canReview(): boolean;
}

const now = () => new Date().toISOString();

abstract class BaseState implements RescueState {
  abstract readonly status: RescueStatus;
  accept(_ctx: RescueRequestContext, _etaMinutes: number): void { throw this.deny('accept'); }
  reject(_ctx: RescueRequestContext, _reason: string): void { throw this.deny('reject'); }
  cancel(_ctx: RescueRequestContext, _reason: string): void { throw this.deny('cancel'); }
  start(_ctx: RescueRequestContext): void { throw this.deny('start'); }
  complete(_ctx: RescueRequestContext): void { throw this.deny('complete'); }
  updateEta(_ctx: RescueRequestContext, _etaMinutes: number): void { throw this.deny('updateEta'); }
  canRecordPayment(): boolean { return false; }
  canReview(): boolean { return false; }
  protected deny(action: RescueAction): InvalidTransitionError {
    return new InvalidTransitionError(this.status, action);
  }
}

export class PendingState extends BaseState {
  readonly status = 'Pending';
  override accept(ctx: RescueRequestContext, etaMinutes: number): void {
    ctx.data.etaMinutes = etaMinutes;
    ctx.data.acceptedAt = now();
    ctx.transitionTo('Accepted');
  }
  override reject(ctx: RescueRequestContext, reason: string): void {
    ctx.data.rejectReason = reason;
    ctx.data.rejectedAt = now();
    ctx.transitionTo('Rejected');
  }
  override cancel(ctx: RescueRequestContext, reason: string): void {
    ctx.data.cancelReason = reason;
    ctx.data.cancelledAt = now();
    ctx.transitionTo('Cancelled');
  }
}

export class AcceptedState extends BaseState {
  readonly status = 'Accepted';
  override start(ctx: RescueRequestContext): void {
    ctx.data.startedAt = now();
    ctx.transitionTo('InProgress');
  }
  override updateEta(ctx: RescueRequestContext, etaMinutes: number): void {
    ctx.data.etaMinutes = etaMinutes;
  }
}

export class InProgressState extends BaseState {
  readonly status = 'InProgress';
  override complete(ctx: RescueRequestContext): void {
    ctx.data.completedAt = now();
    ctx.transitionTo('Completed');
  }
  override updateEta(ctx: RescueRequestContext, etaMinutes: number): void {
    ctx.data.etaMinutes = etaMinutes;
  }
}

export class CompletedState extends BaseState {
  readonly status = 'Completed';
  override canRecordPayment(): boolean { return true; }
  override canReview(): boolean { return true; }
}

export class CancelledState extends BaseState {
  readonly status = 'Cancelled';
}

export class RejectedState extends BaseState {
  readonly status = 'Rejected';
}

// Các State không giữ dữ liệu riêng nên dùng chung 1 instance (Flyweight).
const STATES: Record<RescueStatus, RescueState> = {
  Pending: new PendingState(),
  Accepted: new AcceptedState(),
  InProgress: new InProgressState(),
  Completed: new CompletedState(),
  Cancelled: new CancelledState(),
  Rejected: new RejectedState(),
};

/** Context của State Pattern: controller chỉ gọi các method này, không tự gán status. */
export class RescueRequestContext {
  readonly data: RescueLifecycleData;
  private state: RescueState;

  constructor(data: RescueLifecycleData) {
    if (!(data.status in STATES)) throw new Error(`Trạng thái không hợp lệ: ${data.status}`);
    this.data = { ...data };
    this.state = STATES[data.status];
  }

  get status(): RescueStatus { return this.state.status; }

  /** Chỉ các lớp State gọi. */
  transitionTo(status: RescueStatus): void {
    this.state = STATES[status];
    this.data.status = status;
  }

  accept(etaMinutes: number): void { this.state.accept(this, etaMinutes); }
  reject(reason: string): void { this.state.reject(this, reason); }
  cancel(reason: string): void { this.state.cancel(this, reason); }
  start(): void { this.state.start(this); }
  complete(): void { this.state.complete(this); }
  updateEta(etaMinutes: number): void { this.state.updateEta(this, etaMinutes); }
  canRecordPayment(): boolean { return this.state.canRecordPayment(); }
  canReview(): boolean { return this.state.canReview(); }
}
