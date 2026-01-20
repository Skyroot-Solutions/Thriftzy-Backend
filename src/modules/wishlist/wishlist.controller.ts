import { Request, Response } from "express";
import { WishlistService } from "./wishlist.service";

export class WishlistController {
    private wishlistService: WishlistService;

    constructor() {
        this.wishlistService = new WishlistService();
    }

    getWishlist = async (req: Request, res: Response) => {
        try {
            // @ts-ignore
            const userId = req.user.userId;
            const wishlist = await this.wishlistService.getWishlist(userId);
            res.status(200).json(wishlist);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error fetching wishlist", error });
        }
    };

    toggleWishlist = async (req: Request, res: Response) => {
        try {
            // @ts-ignore
            const userId = req.user.userId;
            const { productId } = req.body;

            if (!productId) {
                res.status(400).json({ message: "Product ID is required" });
                return;
            }

            const result = await this.wishlistService.toggleWishlist(userId, parseInt(productId));
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ message: "Error toggling wishlist", error });
        }
    };
}
