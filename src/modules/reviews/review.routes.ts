import { Router, Request, Response } from "express";
import { reviewController } from "./review.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();

// ============== PUBLIC ROUTES ==============

/**
 * @route   GET /reviews/products/:productId
 * @desc    Get reviews for a product
 * @access  Public
 */
router.get("/products/:productId", (req: Request, res: Response) =>
    reviewController.getProductReviews(req, res)
);

/**
 * @route   GET /reviews/stores/:storeId
 * @desc    Get reviews for a store
 * @access  Public
 */
router.get("/stores/:storeId", (req: Request, res: Response) =>
    reviewController.getStoreReviews(req, res)
);

/**
 * @route   GET /reviews/:id
 * @desc    Get review by ID
 * @access  Public
 */
router.get("/:id", (req: Request, res: Response) =>
    reviewController.getReviewById(req, res)
);

// ============== AUTHENTICATED ROUTES ==============

/**
 * @route   GET /reviews/products/:productId/can-review
 * @desc    Check if user can review a product
 * @access  Private
 */
router.get("/products/:productId/can-review", authenticate, (req: Request, res: Response) =>
    reviewController.canReviewProduct(req, res)
);

/**
 * @route   GET /reviews/stores/:storeId/can-review
 * @desc    Check if user can review a store
 * @access  Private
 */
router.get("/stores/:storeId/can-review", authenticate, (req: Request, res: Response) =>
    reviewController.canReviewStore(req, res)
);

/**
 * @route   GET /reviews/me
 * @desc    Get current user's reviews
 * @access  Private
 */
router.get("/me", authenticate, (req: Request, res: Response) =>
    reviewController.getUserReviews(req, res)
);

/**
 * @route   POST /reviews/products
 * @desc    Create a product review
 * @access  Private
 * @body    { product_id, rating, description, images? }
 */
router.post("/products", authenticate, (req: Request, res: Response) =>
    reviewController.createProductReview(req, res)
);

/**
 * @route   POST /reviews/stores
 * @desc    Create a store review
 * @access  Private
 * @body    { store_id, rating, description, images? }
 */
router.post("/stores", authenticate, (req: Request, res: Response) =>
    reviewController.createStoreReview(req, res)
);

/**
 * @route   POST /reviews/:id/reply
 * @desc    Seller adds a reply to a review (only one reply allowed)
 * @access  Private (Seller only - must own the product/store)
 * @body    { reply }
 */
router.post("/:id/reply", authenticate, (req: Request, res: Response) =>
    reviewController.addReply(req, res)
);

/**
 * @route   PATCH /reviews/:id
 * @desc    Update a review
 * @access  Private (owner only)
 * @body    { rating?, description?, images? }
 */
router.patch("/:id", authenticate, (req: Request, res: Response) =>
    reviewController.updateReview(req, res)
);

/**
 * @route   DELETE /reviews/:id
 * @desc    Delete a review
 * @access  Private (owner only)
 */
router.delete("/:id", authenticate, (req: Request, res: Response) =>
    reviewController.deleteReview(req, res)
);

/**
 * @route   DELETE /reviews/:id/reply
 * @desc    Seller deletes their reply
 * @access  Private (seller who created the reply only)
 */
router.delete("/:id/reply", authenticate, (req: Request, res: Response) =>
    reviewController.deleteReply(req, res)
);

export { router as reviewRoutes };
