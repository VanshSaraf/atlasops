import { Router, Request, Response } from "express";
import { createLogger } from "../utils";
import { RuntimeDiagnosticsService } from "../services";

const logger = createLogger("HealthRoute");
const router = Router();
const diagnostics = new RuntimeDiagnosticsService();

router.get("/health", async (_req: Request, res: Response) => {
  logger.debug("Health check requested");
  const health = await diagnostics.getHealth();
  res.json(health);
});

export default router;
