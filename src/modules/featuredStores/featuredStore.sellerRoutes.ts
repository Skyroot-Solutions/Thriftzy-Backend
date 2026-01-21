import { Router, Request, Response } from "express";
import { featuredStoreController } from "./featuredStore.controller";
import { authenticate, sellerOnly } from "../auth/auth.middleware";

const router = Router();

// ============== ALL ROUTES REQUIRE SELLER AUTHENTICATION ==============

router.use(authenticate, sellerOnly);

// ============== SELLER ROUTES ==============

/**
 * @route   POST /seller/featured-requests
 * @desc    Create a featured store request
 * @access  Seller
 */
router.post(
    "/",
    (req: Request, res: Response) => featuredStoreController.createRequest(req, res)
);

/**
 * @route   GET /seller/featured-requests
 * @desc    Get seller's featured requests
 * @access  Seller
 */
router.get(
    "/",
    (req: Request, res: Response) => featuredStoreController.getSellerRequests(req, res)
);

export { router as sellerFeaturedRoutes };
