import { AppError } from "../errors/AppError.js";
export function errorHandler(err, req, res, next) {
  let error = err;
  if (err.type === "entity.parse.failed")
    error = AppError.badRequest("Invalid JSON");
  else if (err.type === "entity.too.large")
    error = AppError.badRequest("Request body too large");
  else if (err.code === "23505")
    error = AppError.conflict("Duplicate board or VPN IP");
  else if (!(err instanceof AppError)) {
    // The request error observer logs the original cause and stack before conversion.
    error = AppError.internal("Internal server error");
  }
  const body = { error_code: error.code, message: error.message };
  if (error.details) body.details = error.details;
  res.status(error.status).json(body);
}
export function notFoundHandler(req, res, next) {
  next(AppError.notFound("Resource not found"));
}
