// ============== Query Parameters ==============

export interface StoreSearchParams {
    query?: string;
    sort_by?: "rating" | "newest" | "popular";
    is_verified?: boolean;
    page?: number;
    limit?: number;
}

// ============== Response DTOs ==============

export interface StoreCard {
    id: number;
    name: string;
    slug: string;
    description: string;
    logo_url: string;
    rating_avg: number;
    rating_count: number;
    is_verified: boolean;
    products_count: number;
    created_at: Date;
    products?: StoreProductCard[];
}

export interface StoreDetail {
    id: number;
    name: string;
    slug: string;
    description: string;
    logo_url: string;
    rating_avg: number;
    rating_count: number;
    is_verified: boolean;
    products_count: number;
    categories: string[];
    reviews: StoreReviewSummary[];
    featured_products: StoreProductCard[];
    created_at: Date;
}

export interface StoreProductCard {
    id: number;
    title: string;
    price: number;
    condition: "new" | "good" | "fair";
    category: string;
    thumbnail: string | null;
    rating_avg: number;
    rating_count: number;
}

export interface StoreReviewSummary {
    id: number;
    user_name: string;
    rating: number;
    comment: string;
    created_at: Date;
}

export interface StoreListResponse {
    success: boolean;
    data: {
        stores: StoreCard[];
        total: number;
        page: number;
        limit: number;
    };
}

export interface StoreDetailResponse {
    success: boolean;
    data: StoreDetail;
}

// ============== Seller Info (for public view) ==============

export interface SellerPublicInfo {
    id: number;
    store_name: string;
    is_verified: boolean;
    member_since: Date;
}
