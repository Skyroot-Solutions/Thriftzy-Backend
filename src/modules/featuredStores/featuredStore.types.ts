// ============== Request DTOs ==============

export interface CreateFeaturedRequestDTO {
    message?: string;
    requested_days?: number;
}

export interface UpdateFeaturedRequestDTO {
    status: "approved" | "rejected";
    admin_notes?: string;
    featured_start_date?: string;
    featured_end_date?: string;
}

// ============== Response DTOs ==============

export interface FeaturedRequestResponse {
    id: number;
    store: {
        id: number;
        name: string;
        slug: string;
        logo_url: string;
    };
    message: string | null;
    status: "pending" | "approved" | "rejected" | "expired";
    requested_days: number;
    featured_start_date: string | null;
    featured_end_date: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface FeaturedRequestListResponse {
    requests: FeaturedRequestResponse[];
    total: number;
    page: number;
    limit: number;
}

export interface ActiveFeaturedStoreResponse {
    id: number;
    name: string;
    slug: string;
    logo_url: string;
    description: string;
    rating_avg: number;
    rating_count: number;
    is_verified: boolean;
    products_count: number;
    featured_until: string;
}

// ============== Query Params ==============

export interface FeaturedRequestQueryParams {
    status?: "pending" | "approved" | "rejected" | "expired";
    page?: number;
    limit?: number;
}
