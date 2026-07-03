import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import auditLogsRouter from "./auditLogs";
import mockupsRouter from "./mockups";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(auditLogsRouter);
router.use(mockupsRouter);

export default router;
