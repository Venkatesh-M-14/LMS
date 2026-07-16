import type { Response } from 'express';

/** Success envelope helpers — the only way handlers should write bodies. */
export function ok<TData, TMeta>(res: Response, data: TData, meta?: TMeta): void {
  res.status(200).json(meta === undefined ? { data } : { data, meta });
}

export function created<TData>(res: Response, data: TData): void {
  res.status(201).json({ data });
}

export function noContent(res: Response): void {
  res.status(204).end();
}
