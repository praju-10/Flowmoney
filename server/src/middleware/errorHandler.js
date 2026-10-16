import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export const asyncRoute = (fn) => (req, res, next) => {
  try { Promise.resolve(fn(req, res, next)).catch(next); } catch (e) { next(e); }
};

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Please check the highlighted fields.', code: 'VALIDATION',
      fields: Object.fromEntries(err.issues.map((i) => [i.path.join('.') || '_', i.message])),
    });
  }
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.', code: 'TOO_LARGE' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body.', code: 'BAD_JSON' });
  // Log only the error class + message — never request bodies or financial records.
  console.error(`[flowmoney] ${req.method} ${req.path} failed: ${err?.code || err?.name}: ${String(err?.message).slice(0, 200)}`);
  res.status(500).json({ error: 'Something went wrong and your change was NOT saved. Please try again.', code: 'INTERNAL' });
}
