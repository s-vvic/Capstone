import { Router } from "express";
import { internalDeviceController as controller } from "../controllers/internalDeviceController.js";
const router = Router();
router.post("/provision-by-mac", controller.provision);
router.post("/heartbeat", controller.heartbeat);
export default router;
