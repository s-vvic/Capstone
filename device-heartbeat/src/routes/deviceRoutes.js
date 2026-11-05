import { Router } from "express";
import { deviceController as controller } from "../controllers/deviceController.js";
import { authenticate } from "../middleware/authMiddleware.js";
const router = Router();
router.use((req, res, next) =>
  (req.app.locals.authenticateClient || authenticate)(req, res, next),
);
router.post("/register", controller.register);
router.get("/", controller.list);
router.get("/:mac/status", controller.getStatus);
router.patch("/:mac", controller.update);
export default router;
