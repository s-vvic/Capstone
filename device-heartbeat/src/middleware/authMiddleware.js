import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
export function authenticate(req, res, next) {
  try {
    const match = /^Bearer ([^ ]+)$/.exec(req.headers.authorization || "");
    if (!match) throw AppError.unauthorized("JWT Bearer token required");
    const decoded = jwt.verify(match[1], env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (typeof decoded.sub !== "string" || !decoded.sub)
      throw AppError.unauthorized("JWT subject required");
    req.user = {
      userId: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      plan: decoded.plan,
    };
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired authentication token"));
  }
}
