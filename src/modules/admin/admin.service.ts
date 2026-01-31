
import { Repository } from "typeorm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../db/data-source";
import { Admin } from "./admin.entity";
import { AdminWallet } from "./adminWallet.entity";
import { CommissionSettings } from "./commissionSettings.entity";
import { Store } from "../stores/store.entity";
import { Order } from "../orders/order.entity";
import { Payout } from "../payouts/payout.entity";
import { SellerProfile } from "../seller/sellerProfile.entity";
import { Product } from "../products/product.entity";
import { User } from "../users/user.entity";
import { SellerBankKyc } from "../sellerDocuments/sellerBank.entity";
import { SupportTicket } from "../support/supportTicket.entity";
import {
    AdminLoginRequest,
    AdminRegisterRequest,
    AdminAuthResponse,
    AdminJwtPayload,
    AdminResponse,
    StoreWithSellerResponse,
    StoreQueryParams,
    UpdateStoreStatusRequest,
    DashboardStats,
    StoreRevenueResponse,
    AdminProfitResponse,
    StoreProfitResponse,
    CommissionSettingsResponse,
    UpdateCommissionRateRequest,
    PayoutRequestResponse,
    ProcessPayoutRequest,
    PayoutQueryParams,
    AdminUnauthorizedError,
    AdminForbiddenError
} from "./admin.types";
import { NotFoundError, ValidationError } from "../auth/auth.types";

// JWT Configuration
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "admin-super-secret-key-change-in-production";
const COMMISSION_RATE = 0.05; // 5% commission

export class AdminService {
    private adminRepository: Repository<Admin>;
    private adminWalletRepository: Repository<AdminWallet>;
    private storeRepository: Repository<Store>;
    private orderRepository: Repository<Order>;
    private payoutRepository: Repository<Payout>;
    private sellerProfileRepository: Repository<SellerProfile>;
    private userRepository: Repository<User>;
    private bankKycRepository: Repository<SellerBankKyc>;
    private supportTicketRepository: Repository<SupportTicket>;
    private commissionSettingsRepository: Repository<CommissionSettings>;

    constructor() {
        this.adminRepository = AppDataSource.getRepository(Admin);
        this.adminWalletRepository = AppDataSource.getRepository(AdminWallet);
        this.storeRepository = AppDataSource.getRepository(Store);
        this.orderRepository = AppDataSource.getRepository(Order);
        this.payoutRepository = AppDataSource.getRepository(Payout);
        this.sellerProfileRepository = AppDataSource.getRepository(SellerProfile);
        this.userRepository = AppDataSource.getRepository(User);
        this.bankKycRepository = AppDataSource.getRepository(SellerBankKyc);
        this.supportTicketRepository = AppDataSource.getRepository(SupportTicket);
        this.commissionSettingsRepository = AppDataSource.getRepository(CommissionSettings);
    }

    // ============== ADMIN AUTHENTICATION ==============

    async register(data: AdminRegisterRequest): Promise<AdminAuthResponse> {
        const existingAdmin = await this.adminRepository.findOne({
            where: { email: data.email }
        });

        if (existingAdmin) {
            throw new ValidationError("Admin with this email already exists");
        }

        const passwordHash = await bcrypt.hash(data.password, 12);

        const admin = this.adminRepository.create({
            name: data.name,
            email: data.email,
            password_hash: passwordHash,
            role: data.role || "admin"
        });

        await this.adminRepository.save(admin);

        const tokens = this.generateTokens(admin);

        return {
            success: true,
            message: "Admin registered successfully",
            data: {
                admin: this.toAdminResponse(admin),
                tokens
            }
        };
    }

    /**
     * Authenticate admin and generate tokens
     * 
     * @param data - Admin login credentials
     * @returns Authentication response with admin info and tokens
     * @throws AdminUnauthorizedError if credentials are invalid
     * @throws AdminForbiddenError if admin account is disabled
     */
    async login(data: AdminLoginRequest): Promise<AdminAuthResponse> {
        const admin = await this.adminRepository.findOne({
            where: { email: data.email }
        });

        if (!admin) {
            throw new AdminUnauthorizedError("Invalid credentials");
        }

        if (!admin.is_active) {
            throw new AdminForbiddenError("Admin account is disabled");
        }

        const isPasswordValid = await bcrypt.compare(data.password, admin.password_hash);
        if (!isPasswordValid) {
            throw new AdminUnauthorizedError("Invalid credentials");
        }

        const tokens = this.generateTokens(admin);

        return {
            success: true,
            message: "Login successful",
            data: {
                admin: this.toAdminResponse(admin),
                tokens
            }
        };
    }

    /**
     * Verify admin access token
     * 
     * @param token - JWT access token
     * @returns Decoded JWT payload
     * @throws AdminUnauthorizedError if token is invalid
     */
    verifyAccessToken(token: string): AdminJwtPayload {
        try {
            const payload = jwt.verify(token, ADMIN_JWT_SECRET) as AdminJwtPayload;
            if (payload.type !== "access") {
                throw new AdminUnauthorizedError("Invalid token type");
            }
            return payload;
        } catch (error) {
            throw new AdminUnauthorizedError("Invalid or expired token");
        }
    }

    /**
     * Generate JWT tokens for admin
     */
    private generateTokens(admin: Admin) {
        const ACCESS_TOKEN_EXPIRY = 86400; // 24 hours in seconds
        const REFRESH_TOKEN_EXPIRY = 604800; // 7 days in seconds

        const payload: Omit<AdminJwtPayload, "iat" | "exp" | "type"> = {
            adminId: admin.id,
            email: admin.email,
            role: admin.role
        };

        const accessToken = jwt.sign(
            { ...payload, type: "access" },
            ADMIN_JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            { ...payload, type: "refresh" },
            ADMIN_JWT_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        return {
            accessToken,
            refreshToken,
            expiresIn: ACCESS_TOKEN_EXPIRY
        };
    }

    /**
     * Convert Admin entity to response DTO
     */
    private toAdminResponse(admin: Admin): AdminResponse {
        return {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            is_active: admin.is_active,
            created_at: admin.created_at
        };
    }

    // ============== DASHBOARD STATS ==============

    async getDashboardStats(): Promise<DashboardStats> {
        // Total revenue from paid orders
        const revenueResult = await this.orderRepository
            .createQueryBuilder("order")
            .select("SUM(order.total_amount)", "total")
            .where("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .getRawOne();

        // Total commission earned
        const commissionResult = await this.orderRepository
            .createQueryBuilder("order")
            .select("SUM(order.admin_commission)", "total")
            .where("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .getRawOne();

        // Total orders count
        const totalOrders = await this.orderRepository.count();
        const totalStores = await this.storeRepository.count();
        const pendingStores = await this.storeRepository.count({ where: { is_verified: false } });
        const verifiedStores = await this.storeRepository.count({ where: { is_verified: true } });
        const totalSellers = await this.userRepository.count({ where: { role: "seller" } });
        const totalBuyers = await this.userRepository.count({ where: { role: "buyer" } });
        const pendingPayouts = await this.payoutRepository.count({ where: { status: "pending" } });
        const openTickets = await this.supportTicketRepository.count({ where: { status: "open" } });

        return {
            total_revenue: parseFloat(revenueResult?.total) || 0,
            total_commission: parseFloat(commissionResult?.total) || 0,
            total_orders: totalOrders,
            total_stores: totalStores,
            pending_stores: pendingStores,
            verified_stores: verifiedStores,
            total_sellers: totalSellers,
            total_buyers: totalBuyers,
            pending_payouts: pendingPayouts,
            open_tickets: openTickets
        };
    }

    // ============== STORE MANAGEMENT ==============

    async getStores(params: StoreQueryParams = {}): Promise<{
        stores: StoreWithSellerResponse[];
        total: number;
        page: number;
        limit: number;
    }> {
        const page = params.page || 1;
        const limit = Math.min(params.limit || 10, 50);
        const skip = (page - 1) * limit;

        const queryBuilder = this.storeRepository
            .createQueryBuilder("store")
            .leftJoinAndSelect("store.seller_profile", "seller")
            .leftJoinAndSelect("seller.user", "user")
            .leftJoin("store.products", "products")
            .leftJoin("store.orders", "orders")
            .addSelect("COUNT(DISTINCT products.id)", "product_count")
            .addSelect("COUNT(DISTINCT orders.id)", "order_count")
            .addSelect("COALESCE(SUM(orders.total_amount), 0)", "total_revenue")
            .groupBy("store.id")
            .addGroupBy("seller.id")
            .addGroupBy("user.id");

        // Apply filters
        if (params.status === "pending") {
            queryBuilder.andWhere("store.is_verified = :verified", { verified: false });
        } else if (params.status === "verified") {
            queryBuilder.andWhere("store.is_verified = :verified", { verified: true });
        }

        if (params.search) {
            queryBuilder.andWhere(
                "(store.name ILIKE :search OR user.name ILIKE :search OR user.email ILIKE :search)",
                { search: `%${params.search}%` }
            );
        }

        const rawResults = await queryBuilder
            .orderBy("store.created_at", "DESC")
            .skip(skip)
            .take(limit)
            .getRawAndEntities();

        const total = await queryBuilder.getCount();

        const stores = rawResults.entities.map((store, index) => {
            const raw = rawResults.raw[index];
            return this.toStoreWithSellerResponse(store, {
                product_count: parseInt(raw.product_count) || 0,
                order_count: parseInt(raw.order_count) || 0,
                total_revenue: parseFloat(raw.total_revenue) || 0
            });
        });

        return { stores, total, page, limit };
    }

    /**
     * Get enriched sellers list for admin
     * Returns: [{ id, user_id, name, kyc_verified, subscription_plan, stores: [{ id, name }], total_products, total_revenue }]
     */
    async getAllSellersWithStores(): Promise<Array<{
        id: number;
        user_id: number;
        name: string | null;
        kyc_verified: boolean;
        subscription_plan: string;
        stores: Array<{ id: number; name: string }>;
        total_products: number;
        total_revenue: number;
        email: string | null;
    }>> {
        const profiles = await this.sellerProfileRepository.find({
            relations: ["user", "stores"]
        });

        const productRepo = AppDataSource.getRepository(Product);
        const results: Array<{
            id: number;
            user_id: number;
            name: string | null;
            kyc_verified: boolean;
            subscription_plan: string;
            stores: Array<{ id: number; name: string }>;
            total_products: number;
            total_revenue: number;
            email: string | null;
        }> = [];

        for (const profile of profiles) {
            const stores = profile.stores || [];
            const storeIds = stores.map(s => s.id);

            const totalProducts = storeIds.length > 0
                ? await productRepo.count({ where: storeIds.map(id => ({ store_id: id })) })
                : 0;

            let totalRevenue = 0;
            if (storeIds.length > 0) {
                const revenueResult = await this.orderRepository
                    .createQueryBuilder("order")
                    .where("order.store_id IN (:...storeIds)", { storeIds })
                    .andWhere("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
                    .select("COALESCE(SUM(order.total_amount), 0)", "total")
                    .getRawOne();

                totalRevenue = parseFloat(revenueResult?.total || "0");
            }

            results.push({
                id: profile.id,
                user_id: profile.user_id,
                name: profile.user?.name || null,
                kyc_verified: !!profile.kyc_verified,
                subscription_plan: "basic",
                stores: stores.map(s => ({ id: s.id, name: s.name })),
                total_products: totalProducts,
                total_revenue: totalRevenue
                ,email: profile.user?.email || null
            });
        }

        return results;
    }

    /**
     * Get a single seller by ID with enriched data
     * Returns: { id, user_id, name, email, kyc_verified, subscription_plan, stores: [{ id, name }], total_products, total_revenue }
     */
    async getSellerById(sellerId: number): Promise<{
        id: number;
        user_id: number;
        name: string | null;
        email: string | null;
        kyc_verified: boolean;
        subscription_plan: string;
        stores: Array<{ id: number; name: string }>;
        total_products: number;
        total_revenue: number;
    }> {
        const profile = await this.sellerProfileRepository.findOne({
            where: { id: sellerId },
            relations: ["user", "stores"]
        });

        if (!profile) {
            throw new NotFoundError("Seller not found");
        }

        const stores = profile.stores || [];
        const storeIds = stores.map(s => s.id);

        const productRepo = AppDataSource.getRepository(Product);
        const totalProducts = storeIds.length > 0
            ? await productRepo.count({ where: storeIds.map(id => ({ store_id: id })) })
            : 0;

        let totalRevenue = 0;
        if (storeIds.length > 0) {
            const revenueResult = await this.orderRepository
                .createQueryBuilder("order")
                .where("order.store_id IN (:...storeIds)", { storeIds })
                .andWhere("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
                .select("COALESCE(SUM(order.total_amount), 0)", "total")
                .getRawOne();

            totalRevenue = parseFloat(revenueResult?.total || "0");
        }

        return {
            id: profile.id,
            user_id: profile.user_id,
            name: profile.user?.name || null,
            email: profile.user?.email || null,
            kyc_verified: !!profile.kyc_verified,
            subscription_plan: "basic",
            stores: stores.map(s => ({ id: s.id, name: s.name })),
            total_products: totalProducts,
            total_revenue: totalRevenue
        };
    }

    async getStoreById(storeId: number): Promise<StoreWithSellerResponse> {
        const store = await this.storeRepository.findOne({
            where: { id: storeId },
            relations: ["seller_profile", "seller_profile.user"]
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        // Get additional stats
        const stats = await this.orderRepository
            .createQueryBuilder("order")
            .select("COUNT(order.id)", "order_count")
            .addSelect("COALESCE(SUM(order.total_amount), 0)", "total_revenue")
            .where("order.store_id = :storeId", { storeId })
            .andWhere("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .getRawOne();

        const productCount = await AppDataSource.getRepository("Product").count({
            where: { store_id: storeId }
        });

        return this.toStoreWithSellerResponse(store, {
            product_count: productCount,
            order_count: parseInt(stats?.order_count) || 0,
            total_revenue: parseFloat(stats?.total_revenue) || 0
        });
    }

    async updateStoreStatus(storeId: number, data: UpdateStoreStatusRequest): Promise<StoreWithSellerResponse> {
        const store = await this.storeRepository.findOne({
            where: { id: storeId },
            relations: ["seller_profile", "seller_profile.user"]
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        store.is_verified = data.is_verified;
        if (data.is_active !== undefined) {
            store.is_active = data.is_active;
        }

        await this.storeRepository.save(store);

        return this.getStoreById(storeId);
    }

    private toStoreWithSellerResponse(
        store: Store,
        stats: { product_count: number; order_count: number; total_revenue: number }
    ): StoreWithSellerResponse {
        return {
            id: store.id,
            name: store.name,
            slug: store.slug,
            description: store.description,
            logo_url: store.logo_url,
            rating_avg: store.rating_avg,
            rating_count: store.rating_count,
            is_active: store.is_active,
            is_verified: store.is_verified,
            created_at: store.created_at,
            updated_at: store.updated_at,
            seller: {
                id: store.seller_profile?.id ?? 0,
                user_id: store.seller_profile?.user_id ?? 0,
                kyc_verified: store.seller_profile?.kyc_verified ?? false,
                seller_status: store.seller_profile?.seller_status ?? "pending",
                user: {
                    id: store.seller_profile?.user?.id ?? 0,
                    name: store.seller_profile?.user?.name || "",
                    email: store.seller_profile?.user?.email || "",
                    phone: store.seller_profile?.user?.phone || ""
                }
            },
            total_products: stats.product_count,
            total_orders: stats.order_count,
            total_revenue: stats.total_revenue
        };
    }

    // ============== REVENUE ANALYTICS ==============

    async getRevenueByStore(): Promise<StoreRevenueResponse[]> {
        const results = await this.orderRepository
            .createQueryBuilder("order")
            .leftJoin("order.store", "store")
            .select("order.store_id", "store_id")
            .addSelect("store.name", "store_name")
            .addSelect("COUNT(order.id)", "total_orders")
            .addSelect("COALESCE(SUM(order.total_amount), 0)", "total_revenue")
            .addSelect("COALESCE(SUM(order.admin_commission), 0)", "admin_commission")
            .addSelect("COALESCE(SUM(order.seller_amount), 0)", "seller_earnings")
            .where("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .groupBy("order.store_id")
            .addGroupBy("store.name")
            .orderBy("total_revenue", "DESC")
            .getRawMany();

        return results.map(row => ({
            store_id: row.store_id,
            store_name: row.store_name || "Unknown Store",
            total_orders: parseInt(row.total_orders) || 0,
            total_revenue: parseFloat(row.total_revenue) || 0,
            admin_commission: parseFloat(row.admin_commission) || 0,
            seller_earnings: parseFloat(row.seller_earnings) || 0
        }));
    }

    async getTotalRevenue(): Promise<{
        total_revenue: number;
        total_commission: number;
        total_seller_earnings: number;
        orders_count: number;
    }> {
        const result = await this.orderRepository
            .createQueryBuilder("order")
            .select("COUNT(order.id)", "orders_count")
            .addSelect("COALESCE(SUM(order.total_amount), 0)", "total_revenue")
            .addSelect("COALESCE(SUM(order.admin_commission), 0)", "total_commission")
            .addSelect("COALESCE(SUM(order.seller_amount), 0)", "total_seller_earnings")
            .where("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .getRawOne();

        return {
            total_revenue: parseFloat(result?.total_revenue) || 0,
            total_commission: parseFloat(result?.total_commission) || 0,
            total_seller_earnings: parseFloat(result?.total_seller_earnings) || 0,
            orders_count: parseInt(result?.orders_count) || 0
        };
    }

    // ============================================================================
    // PAYOUT MANAGEMENT
    // ============================================================================


    async getPayoutRequests(params: PayoutQueryParams = {}): Promise<{
        payouts: PayoutRequestResponse[];
        total: number;
        page: number;
        limit: number;
    }> {
        const page = params.page || 1;
        const limit = Math.min(params.limit || 10, 50);
        const skip = (page - 1) * limit;

        const queryBuilder = this.payoutRepository
            .createQueryBuilder("payout")
            .leftJoinAndSelect("payout.seller_profile", "seller")
            .leftJoinAndSelect("seller.user", "user")
            .leftJoinAndSelect("seller.bankKyc", "bank")
            .leftJoinAndSelect("payout.store", "store");

        if (params.status) {
            queryBuilder.andWhere("payout.status = :status", { status: params.status });
        }

        if (params.seller_id) {
            queryBuilder.andWhere("payout.seller_id = :sellerId", { sellerId: params.seller_id });
        }

        const [payouts, total] = await queryBuilder
            .orderBy("payout.created_at", "DESC")
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return {
            payouts: payouts.map(p => this.toPayoutRequestResponse(p)),
            total,
            page,
            limit
        };
    }

    async processPayoutRequest(
        adminId: number,
        payoutId: number,
        data: ProcessPayoutRequest
    ): Promise<PayoutRequestResponse> {
        const payout = await this.payoutRepository.findOne({
            where: { id: payoutId },
            relations: ["seller_profile", "seller_profile.user", "seller_profile.bankKyc", "store"]
        });

        if (!payout) {
            throw new NotFoundError("Payout request not found");
        }

        if (payout.status !== "pending" && payout.status !== "requested") {
            throw new ValidationError("Payout has already been processed");
        }

        if (data.status === "approved") {
            payout.status = "processing";
            payout.admin_notes = data.admin_notes || "";
            payout.processed_by = adminId;
            payout.processed_at = new Date();

            // Mark as completed (in production, this would be after actual payment)
            payout.status = "completed";
            if (data.transaction_id) {
                payout.transaction_id = data.transaction_id;
            }

            // Update ALL orders payout status
            if (payout.order_ids && payout.order_ids.length > 0) {
                for (const orderId of payout.order_ids) {
                    await this.orderRepository.update(
                        { id: orderId },
                        { payout_status: "completed", payout_id: payout.id }
                    );
                }
            }
        } else if (data.status === "rejected") {
            payout.status = "rejected";
            payout.admin_notes = data.admin_notes || "";
            payout.processed_by = adminId;
            payout.processed_at = new Date();
        }

        await this.payoutRepository.save(payout);

        return this.toPayoutRequestResponse(payout);
    }

    private toPayoutRequestResponse(payout: Payout): PayoutRequestResponse {
        const bankKyc = payout.seller_profile?.bankKyc;

        return {
            id: payout.id,
            seller_id: payout.seller_id,
            store_id: payout.store_id ?? undefined,
            amount: payout.gross_amount,
            commission_amount: payout.commission_amount,
            net_amount: payout.amount,
            status: payout.status,
            request_notes: payout.request_notes ?? undefined,
            admin_notes: payout.admin_notes ?? undefined,
            processed_by: payout.processed_by ?? undefined,
            processed_at: payout.processed_at ?? undefined,
            created_at: payout.created_at,
            updated_at: payout.updated_at,
            seller_profile: {
                id: payout.seller_profile?.id ?? 0,
                user: {
                    id: payout.seller_profile?.user?.id ?? 0,
                    name: payout.seller_profile?.user?.name || "",
                    email: payout.seller_profile?.user?.email || "",
                    phone: payout.seller_profile?.user?.phone || ""
                },
                bank_details: bankKyc ? {
                    account_holder_name: bankKyc.account_holder_name,
                    account_number_masked: "****" + bankKyc.account_last4,
                    bank_name: "Bank",
                    ifsc_code: bankKyc.ifsc_code
                } : undefined
            }
        };
    }

    // ============== PROFIT & COMMISSION ==============

    async getTotalProfit(): Promise<AdminProfitResponse> {
        const commissionRate = await this.getCurrentCommissionRate();

        // Get order-level stats with commission
        const orderResult = await this.orderRepository
            .createQueryBuilder("order")
            .select("COUNT(order.id)", "total_orders")
            .addSelect("COALESCE(SUM(order.admin_commission), 0)", "total_profit")
            .where("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .getRawOne();

        // Get total products sold (commission is calculated per product)
        const productResult = await AppDataSource.getRepository("OrderItem")
            .createQueryBuilder("item")
            .leftJoin("item.order", "order")
            .select("COUNT(item.id)", "total_products")
            .addSelect("COALESCE(SUM(item.quantity), 0)", "total_quantity")
            .where("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .getRawOne();

        const totalOrders = parseInt(orderResult?.total_orders) || 0;
        const totalProfit = parseFloat(orderResult?.total_profit) || 0;
        const totalProducts = parseInt(productResult?.total_quantity) || 0;
        const avgCommissionPerProduct = totalProducts > 0 ? totalProfit / totalProducts : 0;

        return {
            total_profit: totalProfit,
            total_orders: totalOrders,
            total_products_sold: totalProducts,
            average_commission_per_product: avgCommissionPerProduct,
            commission_rate: commissionRate
        };
    }

    async getProfitByStore(): Promise<StoreProfitResponse[]> {
        const commissionRate = await this.getCurrentCommissionRate();

        const results = await this.orderRepository
            .createQueryBuilder("order")
            .leftJoin("order.store", "store")
            .leftJoin("order.items", "items")
            .select("order.store_id", "store_id")
            .addSelect("store.name", "store_name")
            .addSelect("COUNT(DISTINCT order.id)", "total_orders")
            .addSelect("COALESCE(SUM(items.quantity), 0)", "total_products")
            .addSelect("COALESCE(SUM(order.total_amount), 0)", "total_revenue")
            .addSelect("COALESCE(SUM(order.admin_commission), 0)", "profit")
            .where("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .groupBy("order.store_id")
            .addGroupBy("store.name")
            .orderBy("profit", "DESC")
            .getRawMany();

        return results.map(row => ({
            store_id: row.store_id,
            store_name: row.store_name || "Unknown Store",
            total_orders: parseInt(row.total_orders) || 0,
            total_products_sold: parseInt(row.total_products) || 0,
            total_revenue: parseFloat(row.total_revenue) || 0,
            profit: parseFloat(row.profit) || 0,
            commission_rate: commissionRate
        }));
    }

    async getCommissionSettings(): Promise<CommissionSettingsResponse> {
        let settings = await this.commissionSettingsRepository.findOne({ where: { id: 1 } });

        if (!settings) {
            // Create default settings
            settings = this.commissionSettingsRepository.create({
                commission_rate: 0.05 // Default 5%
            });
            await this.commissionSettingsRepository.save(settings);
        }

        return {
            id: settings.id,
            commission_rate: Number(settings.commission_rate),
            commission_percentage: Number(settings.commission_rate) * 100,
            updated_by: settings.updated_by,
            update_note: settings.update_note,
            updated_at: settings.updated_at
        };
    }

    async updateCommissionRate(adminId: number, data: UpdateCommissionRateRequest): Promise<CommissionSettingsResponse> {
        // Validate commission rate (0-100% as decimal 0-1)
        if (data.commission_rate < 0 || data.commission_rate > 1) {
            throw new ValidationError("Commission rate must be between 0 and 1 (0% to 100%)");
        }

        let settings = await this.commissionSettingsRepository.findOne({ where: { id: 1 } });

        if (!settings) {
            settings = this.commissionSettingsRepository.create({});
        }

        settings.commission_rate = data.commission_rate;
        settings.updated_by = adminId;
        settings.update_note = data.update_note || undefined;

        await this.commissionSettingsRepository.save(settings);

        return {
            id: settings.id,
            commission_rate: Number(settings.commission_rate),
            commission_percentage: Number(settings.commission_rate) * 100,
            updated_by: settings.updated_by,
            update_note: settings.update_note,
            updated_at: settings.updated_at
        };
    }

    async getCurrentCommissionRate(): Promise<number> {
        const settings = await this.commissionSettingsRepository.findOne({ where: { id: 1 } });
        return settings ? Number(settings.commission_rate) : 0.05; // Default 5%
    }

    // ============== ADMIN WALLET MANAGEMENT ==============


    async getAdminWallet(): Promise<AdminWallet> {
        let wallet = await this.adminWalletRepository.findOne({ where: { id: 1 } });

        if (!wallet) {
            wallet = this.adminWalletRepository.create({
                total_balance: 0,
                available_balance: 0,
                pending_payouts: 0,
                total_commission_earned: 0,
                total_payouts_processed: 0
            });
            await this.adminWalletRepository.save(wallet);
        }

        return wallet;
    }

    async updateWalletOnPayment(amount: number, commission: number): Promise<void> {
        const wallet = await this.getAdminWallet();

        wallet.total_balance = Number(wallet.total_balance) + amount;
        wallet.available_balance = Number(wallet.available_balance) + amount;
        wallet.total_commission_earned = Number(wallet.total_commission_earned) + commission;

        await this.adminWalletRepository.save(wallet);
    }

    async updateWalletOnPayout(payoutAmount: number): Promise<void> {
        const wallet = await this.getAdminWallet();

        wallet.available_balance = Number(wallet.available_balance) - payoutAmount;
        wallet.total_payouts_processed = Number(wallet.total_payouts_processed) + payoutAmount;

        await this.adminWalletRepository.save(wallet);
    }
}

// Export singleton instance
export const adminService = new AdminService();
