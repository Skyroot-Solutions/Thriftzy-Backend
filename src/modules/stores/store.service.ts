import { Repository } from "typeorm";
import { Store } from "./store.entity";
import { Product } from "../products/product.entity";
import { Review } from "../reviews/review.entity";
import { AppDataSource } from "../../db/data-source";
import {
    StoreSearchParams,
    StoreCard,
    StoreDetail,
    StoreProductCard,
    StoreReviewSummary
} from "./store.types";
import { NotFoundError } from "../auth/auth.types";

export class StoreService {
    private storeRepository: Repository<Store>;
    private productRepository: Repository<Product>;
    private reviewRepository: Repository<Review>;

    constructor() {
        this.storeRepository = AppDataSource.getRepository(Store);
        this.productRepository = AppDataSource.getRepository(Product);
        this.reviewRepository = AppDataSource.getRepository(Review);
    }

    // ============== GET ALL STORES (Browse) ==============

    async getStores(params: StoreSearchParams = {}): Promise<{
        stores: StoreCard[];
        total: number;
        page: number;
        limit: number;
    }> {
        const page = params.page || 1;
        const limit = Math.min(params.limit || 20, 50);
        const skip = (page - 1) * limit;

        const queryBuilder = this.storeRepository
            .createQueryBuilder("store")
            .leftJoinAndSelect("store.products", "products")
            .leftJoinAndSelect("products.images", "images")
            .where("store.is_active = :isActive", { isActive: true });

        // Search by name or description
        if (params.query) {
            queryBuilder.andWhere(
                "(store.name ILIKE :query OR store.description ILIKE :query)",
                { query: `%${params.query}%` }
            );
        }

        // Filter by verified status
        if (params.is_verified !== undefined) {
            queryBuilder.andWhere("store.is_verified = :isVerified", { isVerified: params.is_verified });
        }

        // Sorting
        switch (params.sort_by) {
            case "rating":
                queryBuilder.orderBy("store.rating_avg", "DESC");
                break;
            case "popular":
                queryBuilder.orderBy("store.rating_count", "DESC");
                break;
            case "newest":
            default:
                queryBuilder.orderBy("store.created_at", "DESC");
                break;
        }

        const total = await queryBuilder.getCount();

        const stores = await queryBuilder
            .skip(skip)
            .take(limit)
            .getMany();

        return {
            stores: stores.map(s => this.toStoreCard(s)),
            total,
            page,
            limit
        };
    }

    // ============== GET STORE BY ID ==============

    async getStoreById(storeId: number): Promise<StoreDetail> {
        const store = await this.storeRepository.findOne({
            where: { id: storeId, is_active: true },
            relations: ["products", "products.images", "products.reviews", "reviews", "reviews.user"]
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        return this.toStoreDetail(store);
    }

    // ============== GET STORE BY SLUG ==============

    async getStoreBySlug(slug: string): Promise<StoreDetail> {
        const store = await this.storeRepository.findOne({
            where: { slug, is_active: true },
            relations: ["products", "products.images", "products.reviews", "reviews", "reviews.user"]
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        return this.toStoreDetail(store);
    }

    // ============== GET STORE PRODUCTS ==============

    async getStoreProducts(storeId: number, params: { page?: number; limit?: number; category?: string; sort_by?: string } = {}): Promise<{
        products: StoreProductCard[];
        total: number;
        page: number;
        limit: number;
    }> {
        // Verify store exists and is active
        const store = await this.storeRepository.findOne({
            where: { id: storeId, is_active: true }
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        const page = params.page || 1;
        const limit = Math.min(params.limit || 20, 50);
        const skip = (page - 1) * limit;

        const queryBuilder = this.productRepository
            .createQueryBuilder("product")
            .leftJoinAndSelect("product.images", "images")
            .leftJoinAndSelect("product.reviews", "reviews")
            .where("product.store_id = :storeId", { storeId })
            .andWhere("product.quantity > 0");

        if (params.category) {
            queryBuilder.andWhere("product.category = :category", { category: params.category });
        }

        // Sorting
        switch (params.sort_by) {
            case "price_asc":
                queryBuilder.orderBy("product.price", "ASC");
                break;
            case "price_desc":
                queryBuilder.orderBy("product.price", "DESC");
                break;
            case "popular":
                queryBuilder.orderBy("(SELECT COUNT(*) FROM reviews WHERE reviews.product_id = product.id)", "DESC");
                break;
            case "newest":
            default:
                queryBuilder.orderBy("product.created_at", "DESC");
                break;
        }

        const total = await queryBuilder.getCount();

        const products = await queryBuilder
            .skip(skip)
            .take(limit)
            .getMany();

        return {
            products: products.map(p => this.toStoreProductCard(p)),
            total,
            page,
            limit
        };
    }

    // ============== GET STORE REVIEWS ==============

    async getStoreReviews(storeId: number, params: { page?: number; limit?: number } = {}): Promise<{
        reviews: StoreReviewSummary[];
        total: number;
        page: number;
        limit: number;
    }> {
        // Verify store exists and is active
        const store = await this.storeRepository.findOne({
            where: { id: storeId, is_active: true }
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        const page = params.page || 1;
        const limit = Math.min(params.limit || 10, 50);
        const skip = (page - 1) * limit;

        const [reviews, total] = await this.reviewRepository.findAndCount({
            where: { store_id: storeId },
            relations: ["user"],
            order: { created_at: "DESC" },
            skip,
            take: limit
        });

        return {
            reviews: reviews.map(r => this.toStoreReviewSummary(r)),
            total,
            page,
            limit
        };
    }

    // ============== GET FEATURED STORES ==============

    async getFeaturedStores(limit: number = 6): Promise<StoreCard[]> {
        const stores = await this.storeRepository
            .createQueryBuilder("store")
            .leftJoinAndSelect("store.products", "products")
            .where("store.is_active = :isActive", { isActive: true })
            .andWhere("store.is_verified = :isVerified", { isVerified: true })
            .orderBy("store.rating_avg", "DESC")
            .addOrderBy("store.rating_count", "DESC")
            .take(limit)
            .getMany();

        return stores.map(s => this.toStoreCard(s));
    }

    // ============== GET STORE CATEGORIES ==============

    async getStoreCategories(storeId: number): Promise<string[]> {
        const categories = await this.productRepository
            .createQueryBuilder("product")
            .select("DISTINCT product.category", "category")
            .where("product.store_id = :storeId", { storeId })
            .andWhere("product.quantity > 0")
            .getRawMany();

        return categories.map(c => c.category);
    }

    // ============== HELPER METHODS ==============

    private toStoreCard(store: Store): StoreCard {
        return {
            id: store.id,
            name: store.name,
            slug: store.slug,
            description: store.description,
            logo_url: store.logo_url,
            rating_avg: parseFloat(String(store.rating_avg)) || 0,
            rating_count: store.rating_count,
            is_verified: store.is_verified,
            products_count: store.products?.filter(p => p.quantity > 0).length || 0,
            created_at: store.created_at,
            products: (store.products || [])
                .filter(p => p.quantity > 0)
                .slice(0, 2)
                .map(p => this.toStoreProductCard(p))
        };
    }

    private toStoreDetail(store: Store): StoreDetail {
        const products = store.products?.filter(p => p.quantity > 0) || [];
        const categories = [...new Set(products.map(p => p.category))];

        // Get store reviews
        const reviews = (store.reviews || []).slice(0, 5);

        // Featured products (top rated or newest)
        const featuredProducts = products
            .sort((a, b) => {
                const aRating = this.getAverageRating(a.reviews || []);
                const bRating = this.getAverageRating(b.reviews || []);
                return bRating - aRating;
            })
            .slice(0, 8);

        return {
            id: store.id,
            name: store.name,
            slug: store.slug,
            description: store.description,
            logo_url: store.logo_url,
            rating_avg: parseFloat(String(store.rating_avg)) || 0,
            rating_count: store.rating_count,
            is_verified: store.is_verified,
            products_count: products.length,
            categories,
            reviews: reviews.map(r => this.toStoreReviewSummary(r)),
            featured_products: featuredProducts.map(p => this.toStoreProductCard(p)),
            created_at: store.created_at
        };
    }

    private toStoreProductCard(product: Product): StoreProductCard {
        const reviews = product.reviews || [];
        const avgRating = this.getAverageRating(reviews);

        // Get first image as thumbnail
        const sortedImages = (product.images || []).sort((a, b) => a.position - b.position);
        const thumbnail = sortedImages.length > 0 ? sortedImages[0].image_url : null;

        return {
            id: product.id,
            title: product.title,
            price: product.price,
            condition: product.condition,
            category: product.category,
            thumbnail,
            rating_avg: avgRating,
            rating_count: reviews.length
        };
    }

    private toStoreReviewSummary(review: Review): StoreReviewSummary {
        return {
            id: review.id,
            user_name: review.user?.name || "Anonymous",
            rating: review.rating,
            comment: review.description || "",
            created_at: review.created_at
        };
    }

    private getAverageRating(reviews: Review[]): number {
        if (reviews.length === 0) return 0;
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        return Math.round((sum / reviews.length) * 10) / 10;
    }
}

// Export singleton instance
export const storeService = new StoreService();
