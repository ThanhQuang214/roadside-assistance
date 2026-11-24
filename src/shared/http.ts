import type { ErrorRequestHandler } from 'express';
import { InvalidTransitionError } from './state/rescue-request-state.ts';

/** Lỗi nghiệp vụ trả về client theo định dạng chung trong api-contract.md (mục 1.3). */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  } else if (err instanceof InvalidTransitionError) {
    res.status(409).json({ error: { code: err.code, message: err.message, details: { status: err.status, action: err.action } } });
  } else if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Body JSON không hợp lệ' } });
  } else {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ, vui lòng thử lại' } });
  }
};
