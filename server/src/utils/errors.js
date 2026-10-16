export class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const notFound = (what = 'Record') => new AppError(404, `${what} not found`, 'NOT_FOUND');
export const conflict = (msg) => new AppError(409, msg, 'CONFLICT');
export const badRequest = (msg) => new AppError(400, msg, 'BAD_REQUEST');
