import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { User } from "@workspace/db";
import { getUserForToken } from "../lib/auth";
import { hasPermission, type Permission } from "../lib/permissions";

const COMMAND_CENTER_SERVICE_USER: User = {
  id: 0,
  name: "Command Center",
  email: "command-center@internal.local",
  passwordHash: "",
  role: "super_admin",
  status: "active",
  isDemo: false,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

function matchesCommandCenterServiceToken(token: string): boolean {
  const expected = process.env.COLLABOS_COMMAND_CENTER_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const provided = Buffer.from(token);
  const reference = Buffer.from(expected);
  if (provided.length !== reference.length) return false;
  return timingSafeEqual(provided, reference);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  if (matchesCommandCenterServiceToken(token)) {
    req.user = COMMAND_CENTER_SERVICE_USER;
    req.sessionToken = token;
    next();
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
