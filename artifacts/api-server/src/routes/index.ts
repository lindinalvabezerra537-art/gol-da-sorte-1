import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import paymentsRouter from "./payments";
import settingsRouter from "./settings";
import adminRouter from "./admin";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/payments", paymentsRouter);
router.use("/settings", settingsRouter);
router.use("/admin", adminRouter);
router.use("/chat", chatRouter);

export default router;
