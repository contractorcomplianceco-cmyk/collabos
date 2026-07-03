import type { NextFunction, Request, Response } from "express";
import type { User } from "@workspace/db";
import { getUserForToken } from "../lib/auth";
import { hasPermission, type Permission } from "../lib/permissions";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const user = await getUserForToken(token);
  if (!user) {
    res.status(401).json({ message: "Session expired or invalid" });
    return;
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({ message: "Access denied: missing permission" });
      return;
    }
    next();
  };
}
