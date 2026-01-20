import { Router } from "express";
import { WishlistController } from "./wishlist.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();
const wishlistController = new WishlistController();

router.get("/", authenticate, wishlistController.getWishlist);
router.post("/toggle", authenticate, wishlistController.toggleWishlist);

export default router;
