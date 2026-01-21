import { Router, Request, Response } from "express";
import { featuredStoreController } from "./featuredStore.controller";

const router = Router();

// ============== PUBLIC ROUTES ==============

/**
 * @route   GET /stores/featured
 * @desc    Get currently active featured store
 * @access  Public
 */
router.get(
    "/",
    (req: Request, res: Response) => featuredStoreController.getActiveFeaturedStore(req, res)
);

export { router as publicFeaturedRoutes };
