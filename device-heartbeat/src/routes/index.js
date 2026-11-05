import { Router } from "express";
import internalRoutes from "./internalRoutes.js";
import deviceRoutes from "./deviceRoutes.js";
const router = Router();
router.use("/devices", internalRoutes);
router.use("/devices", deviceRoutes);
export default router;
