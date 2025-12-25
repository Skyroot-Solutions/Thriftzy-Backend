import { Repository } from "typeorm";
import { Review } from "./review.entity";
import { Product } from "../products/product.entity";
import { Store } from "../stores/store.entity";
import { Order } from "../orders/order.entity";
import { SellerProfile } from "../seller/sellerProfile.entity";
import { AppDataSource } from "../../db/data-source";
import {
    CreateProductReviewRequest,
    CreateStoreReviewRequest,
    UpdateReviewRequest,
    SellerReplyRequest,
    ReviewResponse,
    ReviewListResponse,
    RatingDistribution,
    ReviewQueryParams,
    CanReviewResponse
} from "./review.types";
import { NotFoundError, ValidationError, ForbiddenError } from "../auth/auth.types";

export class ReviewService {
    private reviewRepository: Repository<Review>;
    private productRepository: Repository<Product>;
    private storeRepository: Repository<Store>;
    private orderRepository: Repository<Order>;
    private sellerProfileRepository: Repository<SellerProfile>;

    constructor() {
        this.reviewRepository = AppDataSource.getRepository(Review);
        this.productRepository = AppDataSource.getRepository(Product);
        this.storeRepository = AppDataSource.getRepository(Store);
        this.orderRepository = AppDataSource.getRepository(Order);
        this.sellerProfileRepository = AppDataSource.getRepository(SellerProfile);
    }

    // ============== GET PRODUCT REVIEWS ==============

    async getProductReviews(productId: number, params: ReviewQueryParams = {}): Promise<ReviewListResponse> {
        const product = await this.productRepository.findOne({ where: { id: productId } });
        if (!product) {
            throw new NotFoundError("Product not found");
        }

        const page = params.page || 1;
        const limit = Math.min(params.limit || 10, 50);
        const skip = (page - 1) * limit;

        const queryBuilder = this.reviewRepository
            .createQueryBuilder("review")
            .leftJoinAndSelect("review.user", "user")
            .leftJoinAndSelect("review.product", "product")
            .where("review.product_id = :productId", { productId });

        this.applySorting(queryBuilder, params.sort_by);

        const [reviews, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();
        const stats = await this.getProductRatingStats(productId);

        return {
            reviews: reviews.map(r => this.toReviewResponse(r, "product")),
            total,
            page,
            limit,
            average_rating: stats.average,
            rating_distribution: stats.distribution
        };
    }

    // ============== GET STORE REVIEWS ==============

    async getStoreReviews(storeId: number, params: ReviewQueryParams = {}): Promise<ReviewListResponse> {
        const store = await this.storeRepository.findOne({ where: { id: storeId } });
        if (!store) {
            throw new NotFoundError("Store not found");
        }

        const page = params.page || 1;
        const limit = Math.min(params.limit || 10, 50);
        const skip = (page - 1) * limit;

        const queryBuilder = this.reviewRepository
            .createQueryBuilder("review")
            .leftJoinAndSelect("review.user", "user")
            .leftJoinAndSelect("review.store", "store")
            .where("review.store_id = :storeId", { storeId });

        this.applySorting(queryBuilder, params.sort_by);

        const [reviews, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();
        const stats = await this.getStoreRatingStats(storeId);

        return {
            reviews: reviews.map(r => this.toReviewResponse(r, "store")),
            total,
            page,
            limit,
            average_rating: stats.average,
            rating_distribution: stats.distribution
        };
    }

    // ============== GET USER REVIEWS ==============

    async getUserReviews(userId: number): Promise<{ product_reviews: ReviewResponse[]; store_reviews: ReviewResponse[] }> {
        const productReviews = await this.reviewRepository.find({
            where: { user_id: userId },
            relations: ["product", "user"],
            order: { created_at: "DESC" }
        });

        const storeReviews = await this.reviewRepository.find({
            where: { user_id: userId },
            relations: ["store", "user"],
            order: { created_at: "DESC" }
        });

        return {
            product_reviews: productReviews.filter(r => r.product_id !== null).map(r => this.toReviewResponse(r, "product")),
            store_reviews: storeReviews.filter(r => r.store_id !== null).map(r => this.toReviewResponse(r, "store"))
        };
    }

    // ============== CAN REVIEW PRODUCT ==============

    async canReviewProduct(userId: number, productId: number): Promise<CanReviewResponse> {
        const product = await this.productRepository.findOne({ where: { id: productId } });
        if (!product) {
            return { can_review: false, reason: "Product not found", has_existing_review: false, existing_review_id: null };
        }

        // Users can review products multiple times (no restriction on existing reviews)
        const purchasedOrder = await this.orderRepository
            .createQueryBuilder("order")
            .innerJoin("order.items", "items")
            .where("order.user_id = :userId", { userId })
            .andWhere("items.product_id = :productId", { productId })
            .andWhere("order.status = :status", { status: "delivered" })
            .getOne();

        if (!purchasedOrder) {
            return { can_review: false, reason: "You can only review products you have purchased", has_existing_review: false, existing_review_id: null };
        }

        return { can_review: true, reason: null, has_existing_review: false, existing_review_id: null };
    }

    // ============== CAN REVIEW STORE ==============

    async canReviewStore(userId: number, storeId: number): Promise<CanReviewResponse> {
        const store = await this.storeRepository.findOne({ where: { id: storeId } });
        if (!store) {
            return { can_review: false, reason: "Store not found", has_existing_review: false, existing_review_id: null };
        }

        // Users can review stores multiple times (no restriction on existing reviews)
        const purchasedOrder = await this.orderRepository.findOne({ where: { user_id: userId, store_id: storeId, status: "delivered" } });
        if (!purchasedOrder) {
            return { can_review: false, reason: "You can only review stores you have purchased from", has_existing_review: false, existing_review_id: null };
        }

        return { can_review: true, reason: null, has_existing_review: false, existing_review_id: null };
    }

    // ============== CREATE PRODUCT REVIEW ==============

    async createProductReview(userId: number, data: CreateProductReviewRequest): Promise<ReviewResponse> {
        this.validateReviewData(data.rating, data.description);

        const canReview = await this.canReviewProduct(userId, data.product_id);
        if (!canReview.can_review) {
            throw new ValidationError(canReview.reason || "Cannot review this product");
        }

        const product = await this.productRepository.findOne({ where: { id: data.product_id } });

        const review = this.reviewRepository.create({
            user_id: userId,
            product_id: data.product_id,
            store_id: product!.store_id,
            rating: data.rating,
            description: data.description.trim(),
            images: data.images || []
        });

        await this.reviewRepository.save(review);
        await this.updateStoreRating(product!.store_id);

        const savedReview = await this.reviewRepository.findOne({
            where: { id: review.id },
            relations: ["user", "product"]
        });

        return this.toReviewResponse(savedReview!, "product");
    }

    // ============== CREATE STORE REVIEW ==============

    async createStoreReview(userId: number, data: CreateStoreReviewRequest): Promise<ReviewResponse> {
        this.validateReviewData(data.rating, data.description);

        const canReview = await this.canReviewStore(userId, data.store_id);
        if (!canReview.can_review) {
            throw new ValidationError(canReview.reason || "Cannot review this store");
        }

        const review = this.reviewRepository.create({
            user_id: userId,
            product_id: undefined,
            store_id: data.store_id,
            rating: data.rating,
            description: data.description.trim(),
            images: data.images || []
        });

        await this.reviewRepository.save(review);
        await this.updateStoreRating(data.store_id);

        const savedReview = await this.reviewRepository.findOne({
            where: { id: review.id },
            relations: ["user", "store"]
        });

        return this.toReviewResponse(savedReview!, "store");
    }

    // ============== UPDATE REVIEW ==============

    async updateReview(userId: number, reviewId: number, data: UpdateReviewRequest): Promise<ReviewResponse> {
        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
            relations: ["user", "product", "store"]
        });

        if (!review) throw new NotFoundError("Review not found");
        if (review.user_id !== userId) throw new ForbiddenError("You can only edit your own reviews");

        if (data.rating !== undefined) {
            if (data.rating < 1 || data.rating > 5) throw new ValidationError("Rating must be between 1 and 5");
            review.rating = data.rating;
        }

        if (data.description !== undefined) {
            if (data.description.trim().length < 10 || data.description.trim().length > 1000) {
                throw new ValidationError("Description must be between 10 and 1000 characters");
            }
            review.description = data.description.trim();
        }

        if (data.images !== undefined) {
            review.images = data.images;
        }

        await this.reviewRepository.save(review);

        if (review.store_id) {
            await this.updateStoreRating(review.store_id);
        } else if (review.product_id) {
            const product = await this.productRepository.findOne({ where: { id: review.product_id } });
            if (product) await this.updateStoreRating(product.store_id);
        }

        const type = review.product_id ? "product" : "store";
        return this.toReviewResponse(review, type);
    }

    // ============== DELETE REVIEW ==============

    async deleteReview(userId: number, reviewId: number): Promise<void> {
        const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
        if (!review) throw new NotFoundError("Review not found");
        if (review.user_id !== userId) throw new ForbiddenError("You can only delete your own reviews");

        const storeId = review.store_id;
        const productId = review.product_id;

        await this.reviewRepository.remove(review);

        if (storeId) {
            await this.updateStoreRating(storeId);
        } else if (productId) {
            const product = await this.productRepository.findOne({ where: { id: productId } });
            if (product) await this.updateStoreRating(product.store_id);
        }
    }

    // ============== GET REVIEW BY ID ==============

    async getReviewById(reviewId: number): Promise<ReviewResponse> {
        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
            relations: ["user", "product", "store"]
        });

        if (!review) throw new NotFoundError("Review not found");

        const type = review.product_id ? "product" : "store";
        return this.toReviewResponse(review, type);
    }

    // ============== SELLER: ADD REPLY TO REVIEW ==============

    async addSellerReply(userId: number, reviewId: number, data: SellerReplyRequest): Promise<ReviewResponse> {
        // Get seller profile
        const sellerProfile = await this.sellerProfileRepository.findOne({ where: { user_id: userId } });
        if (!sellerProfile) throw new ForbiddenError("Only sellers can reply to reviews");

        // Get review
        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
            relations: ["user", "product", "store"]
        });
        if (!review) throw new NotFoundError("Review not found");

        // Check if seller owns the store
        if (!review.store_id) throw new ValidationError("Review has no associated store");

        const store = await this.storeRepository.findOne({ where: { id: review.store_id } });
        if (!store || store.seller_id !== sellerProfile.id) {
            throw new ForbiddenError("You can only reply to reviews on your own products/store");
        }

        // Validate reply
        if (!data.reply || data.reply.trim().length < 5 || data.reply.trim().length > 500) {
            throw new ValidationError("Reply must be between 5 and 500 characters");
        }

        // Update review with seller reply
        review.seller_reply = data.reply.trim();
        review.seller_reply_at = new Date();

        await this.reviewRepository.save(review);

        const type = review.product_id ? "product" : "store";
        return this.toReviewResponse(review, type);
    }

    // ============== SELLER: DELETE REPLY ==============

    async deleteSellerReply(userId: number, reviewId: number): Promise<ReviewResponse> {
        const sellerProfile = await this.sellerProfileRepository.findOne({ where: { user_id: userId } });
        if (!sellerProfile) throw new ForbiddenError("Only sellers can delete replies");

        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
            relations: ["user", "product", "store"]
        });
        if (!review) throw new NotFoundError("Review not found");

        if (!review.store_id) throw new ValidationError("Review has no associated store");

        const store = await this.storeRepository.findOne({ where: { id: review.store_id } });
        if (!store || store.seller_id !== sellerProfile.id) {
            throw new ForbiddenError("You can only delete replies on your own products/store");
        }

        review.seller_reply = null as any;
        review.seller_reply_at = null as any;

        await this.reviewRepository.save(review);

        const type = review.product_id ? "product" : "store";
        return this.toReviewResponse(review, type);
    }

    // ============== HELPER METHODS ==============

    private validateReviewData(rating: number, description: string): void {
        if (rating < 1 || rating > 5) throw new ValidationError("Rating must be between 1 and 5");
        if (!description || description.trim().length < 10 || description.trim().length > 1000) {
            throw new ValidationError("Description must be between 10 and 1000 characters");
        }
    }

    private applySorting(queryBuilder: any, sortBy?: string): void {
        switch (sortBy) {
            case "oldest": queryBuilder.orderBy("review.created_at", "ASC"); break;
            case "highest": queryBuilder.orderBy("review.rating", "DESC"); break;
            case "lowest": queryBuilder.orderBy("review.rating", "ASC"); break;
            default: queryBuilder.orderBy("review.created_at", "DESC"); break;
        }
    }

    private async getProductRatingStats(productId: number): Promise<{ average: number; distribution: RatingDistribution }> {
        const reviews = await this.reviewRepository.find({ where: { product_id: productId } });
        return this.calculateRatingStats(reviews);
    }

    private async getStoreRatingStats(storeId: number): Promise<{ average: number; distribution: RatingDistribution }> {
        const reviews = await this.reviewRepository.find({ where: { store_id: storeId } });
        return this.calculateRatingStats(reviews);
    }

    private calculateRatingStats(reviews: Review[]): { average: number; distribution: RatingDistribution } {
        const distribution: RatingDistribution = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
        if (reviews.length === 0) return { average: 0, distribution };

        let sum = 0;
        for (const review of reviews) {
            sum += review.rating;
            const key = String(review.rating) as keyof RatingDistribution;
            if (distribution[key] !== undefined) distribution[key]++;
        }

        return { average: Math.round((sum / reviews.length) * 10) / 10, distribution };
    }

    private async updateStoreRating(storeId: number): Promise<void> {
        const products = await this.productRepository.find({ where: { store_id: storeId } });
        const productIds = products.map(p => p.id);

        const query = this.reviewRepository.createQueryBuilder("review")
            .where("review.store_id = :storeId", { storeId });

        if (productIds.length > 0) {
            query.orWhere("review.product_id IN (:...productIds)", { productIds });
        }

        const allReviews = await query.getMany();

        if (allReviews.length === 0) {
            await this.storeRepository.update(storeId, { rating_avg: 0, rating_count: 0 });
            return;
        }

        const sum = allReviews.reduce((acc, r) => acc + r.rating, 0);
        const avg = Math.round((sum / allReviews.length) * 100) / 100;

        await this.storeRepository.update(storeId, { rating_avg: avg, rating_count: allReviews.length });
    }

    private toReviewResponse(review: Review, type: "product" | "store"): ReviewResponse {
        let target: { id: number; name: string };

        if (type === "product") {
            target = { id: review.product?.id || review.product_id || 0, name: review.product?.title || "Unknown Product" };
        } else {
            target = { id: review.store?.id || review.store_id || 0, name: review.store?.name || "Unknown Store" };
        }

        return {
            id: review.id,
            type,
            product_id: review.product_id,
            store_id: review.store_id,
            rating: review.rating,
            description: review.description,
            images: review.images || [],
            user: { id: review.user?.id || review.user_id, name: review.user?.name || "Anonymous" },
            target,
            seller_reply: review.seller_reply || null,
            seller_reply_at: review.seller_reply_at || null,
            created_at: review.created_at,
            updated_at: review.updated_at
        };
    }
}

export const reviewService = new ReviewService();
