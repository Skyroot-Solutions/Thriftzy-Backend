import { AppDataSource } from "../../db/data-source";
import { Wishlist } from "./wishlist.entity";
import { Product } from "../products/product.entity";
import { Repository } from "typeorm";

export class WishlistService {
    private wishlistRepository: Repository<Wishlist>;
    private productRepository: Repository<Product>;

    constructor() {
        this.wishlistRepository = AppDataSource.getRepository(Wishlist);
        this.productRepository = AppDataSource.getRepository(Product);
    }

    async getWishlist(userId: number): Promise<Wishlist[]> {
        return this.wishlistRepository.find({
            where: { user_id: userId },
            relations: ["product", "product.images"]
        });
    }

    async addToWishlist(userId: number, productId: number): Promise<Wishlist> {
        const existingFunction = await this.wishlistRepository.findOne({
            where: { user_id: userId, product_id: productId }
        });

        if (existingFunction) {
            return existingFunction; // Already in wishlist
        }

        const wishlist = this.wishlistRepository.create({
            user_id: userId,
            product_id: productId
        });

        return this.wishlistRepository.save(wishlist);
    }

    async removeFromWishlist(userId: number, productId: number): Promise<void> {
        await this.wishlistRepository.delete({
            user_id: userId,
            product_id: productId
        });
    }

    async toggleWishlist(userId: number, productId: number): Promise<{ added: boolean }> {
        const existing = await this.wishlistRepository.findOne({
            where: { user_id: userId, product_id: productId }
        });

        if (existing) {
            await this.wishlistRepository.remove(existing);
            return { added: false };
        } else {
            const newItem = this.wishlistRepository.create({
                user_id: userId,
                product_id: productId
            });
            await this.wishlistRepository.save(newItem);
            return { added: true };
        }
    }
}
