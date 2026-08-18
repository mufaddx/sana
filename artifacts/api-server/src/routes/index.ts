import { Router, type IRouter } from "express";
import healthRouter from "./health";
import realWorldLinkRouter from "./real-world-link";

const router: IRouter = Router();

router.use(healthRouter);
router.use(realWorldLinkRouter);

export default router;
