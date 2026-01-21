import { Router, Request, Response } from "express";
import { featuredStoreController } from "./featuredStore.controller";
import { adminAuthenticate } from "../admin/admin.middleware";

const router = Router();

// ============== ALL ROUTES REQUIRE ADMIN AUTHENTICATION ==============

router.use(adminAuthenticate);

// ============== ADMIN ROUTES ==============

/**
 * @route   GET /admin/featured-requests
 * @desc    Get all featured requests
 * @access  Admin
 */
router.get(
    "/",
    (req: Request, res: Response) => featuredStoreController.getAllRequests(req, res)
);

/**
 * @route   PATCH /admin/featured-requests/:id
 * @desc    Update featured request status (approve/reject)
 * @access  Admin
 */
router.patch(
    "/:id",
    (req: Request, res: Response) => featuredStoreController.updateRequest(req, res)
);

export { router as adminFeaturedRoutes };
