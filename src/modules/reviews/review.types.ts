// ============== Request DTOs ==============

export interface CreateProductReviewRequest {
    product_id: number;
    rating: number; // 1-5
    description: string;
    images?: string[]; // Optional array of image URLs
}

export interface CreateStoreReviewRequest {
    store_id: number;
    rating: number; // 1-5
    description: string;
    images?: string[];
}

export interface UpdateReviewRequest {
    rating?: number;
    description?: string;
    images?: string[];
}

export interface SellerReplyRequest {
    reply: string;
}

// ============== Response DTOs ==============

export interface ReviewResponse {
    id: number;
    type: "product" | "store";
    product_id: number | null;
    store_id: number | null;
    rating: number;
    description: string;
    images: string[];
    user: {
        id: number;
        name: string;
    };
    target: {
        id: number;
        name: string;
    };
    seller_reply: string | null;
    seller_reply_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface ReviewListResponse {
    reviews: ReviewResponse[];
    total: number;
    page: number;
    limit: number;
    average_rating: number;
    rating_distribution: RatingDistribution;
}

export interface RatingDistribution {
    "5": number;
    "4": number;
    "3": number;
    "2": number;
    "1": number;
}

export interface UserReviewsResponse {
    product_reviews: ReviewResponse[];
    store_reviews: ReviewResponse[];
}

export interface CanReviewResponse {
    can_review: boolean;
    reason: string | null;
    has_existing_review: boolean;
    existing_review_id: number | null;
}

// ============== Query Params ==============

export interface ReviewQueryParams {
    page?: number;
    limit?: number;
    sort_by?: "newest" | "oldest" | "highest" | "lowest";
}
