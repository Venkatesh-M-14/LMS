import type { ErrorCode } from '../errors/codes';

/** Success envelope: every 2xx response body has this shape. */
export interface ApiSuccess<TData, TMeta = undefined> {
  data: TData;
  meta?: TMeta;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  /** Field-level issues for VALIDATION_FAILED. */
  details?: Array<{ path: string; message: string }>;
  requestId?: string;
}

/** Error envelope: every non-2xx response body has this shape. */
export interface ApiError {
  error: ApiErrorBody;
}

export interface OffsetMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface CursorMeta {
  nextCursor: string | null;
  hasMore: boolean;
}
