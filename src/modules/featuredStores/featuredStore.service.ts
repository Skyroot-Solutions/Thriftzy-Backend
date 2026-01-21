import { Repository, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import { FeaturedStoreRequest, FeaturedRequestStatus } from "./featuredStoreRequest.entity";
import { Store } from "../stores/store.entity";
import { SellerProfile } from "../seller/sellerProfile.entity";
import {
    CreateFeaturedRequestDTO,
    UpdateFeaturedRequestDTO,
    FeaturedRequestResponse,
    FeaturedRequestListResponse,
    ActiveFeaturedStoreResponse,
    FeaturedRequestQueryParams
} from "./featuredStore.types";
import { NotFoundError, ValidationError } from "../auth/auth.types";

export class FeaturedStoreService {
    private requestRepository: Repository<FeaturedStoreRequest>;
    private storeRepository: Repository<Store>;
    private sellerProfileRepository: Repository<SellerProfile>;

    constructor() {
        this.requestRepository = AppDataSource.getRepository(FeaturedStoreRequest);
        this.storeRepository = AppDataSource.getRepository(Store);
        this.sellerProfileRepository = AppDataSource.getRepository(SellerProfile);
    }

    private async getSellerProfile(userId: number): Promise<SellerProfile> {
        const profile = await this.sellerProfileRepository.findOne({
            where: { user_id: userId }
        });
        if (!profile) {
            throw new NotFoundError("Seller profile not found");
        }
        return profile;
    }

    // ============== SELLER ENDPOINTS ==============

    /**
     * Create a featured store request (Seller)
     */
    async createRequest(userId: number, storeId: number, data: CreateFeaturedRequestDTO): Promise<FeaturedRequestResponse> {
        const profile = await this.getSellerProfile(userId);

        // Verify store belongs to seller
        const store = await this.storeRepository.findOne({
            where: { id: storeId, seller_id: profile.id }
        });

        if (!store) {
            throw new NotFoundError("Store not found or does not belong to you");
        }

        // Check if there's already a pending request for this store
        const existingRequest = await this.requestRepository.findOne({
            where: { store_id: storeId, status: "pending" as FeaturedRequestStatus }
        });

        if (existingRequest) {
            throw new ValidationError("You already have a pending featured request for this store");
        }

        // Create the request
        const request = this.requestRepository.create({
            store_id: storeId,
            message: data.message || undefined,
            requested_days: data.requested_days || 7,
            status: "pending" as FeaturedRequestStatus
        });

        await this.requestRepository.save(request);

        // Reload with relations
        const savedRequest = await this.requestRepository.findOne({
            where: { id: request.id },
            relations: ["store"]
        });

        return this.toResponse(savedRequest!);
    }

    /**
     * Get seller's featured requests
     */
    async getSellerRequests(userId: number, storeId?: number): Promise<FeaturedRequestResponse[]> {
        const profile = await this.getSellerProfile(userId);

        // Get all stores for this seller
        const stores = await this.storeRepository.find({
            where: { seller_id: profile.id }
        });

        const storeIds = stores.map(s => s.id);

        if (storeIds.length === 0) {
            return [];
        }

        let queryBuilder = this.requestRepository
            .createQueryBuilder("request")
            .leftJoinAndSelect("request.store", "store")
            .where("request.store_id IN (:...storeIds)", { storeIds })
            .orderBy("request.created_at", "DESC");

        if (storeId) {
            queryBuilder = queryBuilder.andWhere("request.store_id = :storeId", { storeId });
        }

        const requests = await queryBuilder.getMany();

        return requests.map(r => this.toResponse(r));
    }

    // ============== ADMIN ENDPOINTS ==============

    /**
     * Get all featured requests (Admin)
     */
    async getAllRequests(params: FeaturedRequestQueryParams): Promise<FeaturedRequestListResponse> {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;

        let queryBuilder = this.requestRepository
            .createQueryBuilder("request")
            .leftJoinAndSelect("request.store", "store")
            .orderBy("request.created_at", "DESC");

        if (params.status) {
            queryBuilder = queryBuilder.where("request.status = :status", { status: params.status });
        }

        const [requests, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return {
            requests: requests.map(r => this.toResponse(r)),
            total,
            page,
            limit
        };
    }

    /**
     * Update featured request status (Admin)
     */
    async updateRequest(requestId: number, adminId: number, data: UpdateFeaturedRequestDTO): Promise<FeaturedRequestResponse> {
        const request = await this.requestRepository.findOne({
            where: { id: requestId },
            relations: ["store"]
        });

        if (!request) {
            throw new NotFoundError("Featured request not found");
        }

        request.status = data.status as FeaturedRequestStatus;
        request.admin_notes = data.admin_notes || undefined as any;
        request.approved_by = adminId;

        if (data.status === "approved") {
            // Set featured dates
            const startDate = data.featured_start_date
                ? new Date(data.featured_start_date)
                : new Date();

            const endDate = data.featured_end_date
                ? new Date(data.featured_end_date)
                : new Date(startDate.getTime() + request.requested_days * 24 * 60 * 60 * 1000);

            request.featured_start_date = startDate;
            request.featured_end_date = endDate;
        }

        await this.requestRepository.save(request);

        return this.toResponse(request);
    }

    // ============== PUBLIC ENDPOINTS ==============

    /**
     * Get currently active featured store (Public)
     */
    async getActiveFeaturedStore(): Promise<ActiveFeaturedStoreResponse | null> {
        const now = new Date();
        console.log("[Featured] === Checking for active featured store at:", now.toISOString(), "===");

        // First, find any approved request to debug
        const anyApproved = await this.requestRepository
            .createQueryBuilder("request")
            .leftJoinAndSelect("request.store", "store")
            .where("request.status = :status", { status: "approved" })
            .orderBy("request.created_at", "DESC")
            .getOne();

        if (anyApproved) {
            console.log("[Featured] Found approved request:", {
                id: anyApproved.id,
                store: anyApproved.store?.name,
                start: anyApproved.featured_start_date,
                end: anyApproved.featured_end_date
            });
        }

        // Find an approved request where the current time is within the featured period
        // Use simpler date comparison - just check if status is approved and end date is in future
        const activeRequest = await this.requestRepository
            .createQueryBuilder("request")
            .leftJoinAndSelect("request.store", "store")
            .where("request.status = :status", { status: "approved" })
            .andWhere("request.featured_end_date >= :now", { now })
            .orderBy("request.featured_start_date", "DESC")
            .getOne();

        if (!activeRequest || !activeRequest.store) {
            console.log("[Featured] No active featured store found");
            return null;
        }

        console.log("[Featured] Active featured store:", activeRequest.store.name);
        const store = activeRequest.store;

        // Get products count
        const productsCount = await AppDataSource.getRepository("Product")
            .count({ where: { store_id: store.id } });

        // Handle featured_end_date as either Date or string
        let featuredUntil = "";
        if (activeRequest.featured_end_date) {
            featuredUntil = typeof activeRequest.featured_end_date === 'string'
                ? activeRequest.featured_end_date
                : activeRequest.featured_end_date.toISOString();
        }

        return {
            id: store.id,
            name: store.name,
            slug: store.slug,
            logo_url: store.logo_url,
            description: store.description,
            rating_avg: typeof store.rating_avg === 'string' ? parseFloat(store.rating_avg) : (store.rating_avg || 0),
            rating_count: store.rating_count || 0,
            is_verified: store.is_verified,
            products_count: productsCount,
            featured_until: featuredUntil
        };
    }

    // ============== CRON JOB ==============

    /**
     * Mark expired requests (called by cron job)
     */
    async markExpiredRequests(): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const result = await this.requestRepository
            .createQueryBuilder()
            .update(FeaturedStoreRequest)
            .set({ status: "expired" as FeaturedRequestStatus })
            .where("status = :status", { status: "approved" })
            .andWhere("featured_end_date < :today", { today })
            .execute();

        return result.affected || 0;
    }

    // ============== HELPERS ==============

    private toResponse(request: FeaturedStoreRequest): FeaturedRequestResponse {
        // Helper to safely convert date to ISO string (handles both Date objects and strings)
        const toISOSafe = (date: Date | string | null | undefined): string | null => {
            if (!date) return null;
            if (typeof date === 'string') return date;
            if (date instanceof Date) return date.toISOString();
            return null;
        };

        return {
            id: request.id,
            store: {
                id: request.store?.id || 0,
                name: request.store?.name || "",
                slug: request.store?.slug || "",
                logo_url: request.store?.logo_url || ""
            },
            message: request.message,
            status: request.status,
            requested_days: request.requested_days,
            featured_start_date: toISOSafe(request.featured_start_date),
            featured_end_date: toISOSafe(request.featured_end_date),
            admin_notes: request.admin_notes,
            created_at: toISOSafe(request.created_at) || new Date().toISOString(),
            updated_at: toISOSafe(request.updated_at) || new Date().toISOString()
        };
    }
}

export const featuredStoreService = new FeaturedStoreService();
