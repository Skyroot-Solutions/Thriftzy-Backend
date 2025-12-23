import { Repository } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import { Payout } from "./payout.entity";
import { Order } from "../orders/order.entity";
import { Store } from "../stores/store.entity";
import { SellerProfile } from "../seller/sellerProfile.entity";
import {
    CreatePayoutRequestDto,
    SellerPayoutResponse,
    SellerEarningsResponse,
    PayoutSummaryByStore
} from "./payout.types";
import { NotFoundError, ValidationError } from "../auth/auth.types";

const COMMISSION_RATE = 0.05; // 5% admin commission

export class PayoutService {
    private payoutRepository: Repository<Payout>;
    private orderRepository: Repository<Order>;
    private storeRepository: Repository<Store>;
    private sellerProfileRepository: Repository<SellerProfile>;

    constructor() {
        this.payoutRepository = AppDataSource.getRepository(Payout);
        this.orderRepository = AppDataSource.getRepository(Order);
        this.storeRepository = AppDataSource.getRepository(Store);
        this.sellerProfileRepository = AppDataSource.getRepository(SellerProfile);
    }

    // ============== SELLER EARNINGS ==============

    async getSellerEarnings(sellerId: number): Promise<SellerEarningsResponse> {
        // Get seller's stores
        const sellerProfile = await this.sellerProfileRepository.findOne({
            where: { user_id: sellerId },
            relations: ["stores"]
        });

        if (!sellerProfile) {
            throw new NotFoundError("Seller profile not found");
        }

        const storeIds = sellerProfile.stores?.map(s => s.id) || [];

        if (storeIds.length === 0) {
            return {
                total_orders: 0,
                total_revenue: 0,
                total_commission: 0,
                net_earnings: 0,
                pending_payout: 0,
                completed_payouts: 0,
                available_for_payout: 0
            };
        }

        // Get order stats for seller's stores
        const orderStats = await this.orderRepository
            .createQueryBuilder("order")
            .select("COUNT(order.id)", "total_orders")
            .addSelect("COALESCE(SUM(order.total_amount), 0)", "total_revenue")
            .addSelect("COALESCE(SUM(order.admin_commission), 0)", "total_commission")
            .addSelect("COALESCE(SUM(order.seller_amount), 0)", "net_earnings")
            .where("order.store_id IN (:...storeIds)", { storeIds })
            .andWhere("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .getRawOne();

        // 1. Available for payout: Orders not yet requested (status = pending)
        const availablePayoutResult = await this.orderRepository
            .createQueryBuilder("order")
            .select("COALESCE(SUM(order.seller_amount), 0)", "available")
            .where("order.store_id IN (:...storeIds)", { storeIds })
            .andWhere("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .andWhere("order.payout_status = :payoutStatus", { payoutStatus: "pending" })
            .getRawOne();

        // 2. Pending payout: Payout requests that are processing/requested/approved (not completed or rejected)
        const pendingPayoutResult = await this.payoutRepository
            .createQueryBuilder("payout")
            .select("COALESCE(SUM(payout.amount), 0)", "pending")
            .where("payout.seller_id = :sellerId", { sellerId: sellerProfile.id })
            .andWhere("payout.status IN (:...statuses)", { statuses: ["requested", "approved", "processing"] })
            .getRawOne();

        // 3. Completed payouts: Payouts that are fully completed
        const completedPayoutsResult = await this.payoutRepository
            .createQueryBuilder("payout")
            .select("COALESCE(SUM(payout.amount), 0)", "completed")
            .where("payout.seller_id = :sellerId", { sellerId: sellerProfile.id })
            .andWhere("payout.status = :status", { status: "completed" })
            .getRawOne();

        const available = parseFloat(availablePayoutResult?.available) || 0;
        const pending = parseFloat(pendingPayoutResult?.pending) || 0;
        const completed = parseFloat(completedPayoutsResult?.completed) || 0;

        return {
            total_orders: parseInt(orderStats?.total_orders) || 0,
            total_revenue: parseFloat(orderStats?.total_revenue) || 0,
            total_commission: parseFloat(orderStats?.total_commission) || 0,
            net_earnings: parseFloat(orderStats?.net_earnings) || 0,
            pending_payout: pending,
            completed_payouts: completed,
            available_for_payout: available
        };
    }

    async getEarningsByStore(sellerId: number): Promise<PayoutSummaryByStore[]> {
        const sellerProfile = await this.sellerProfileRepository.findOne({
            where: { user_id: sellerId },
            relations: ["stores"]
        });

        if (!sellerProfile) {
            throw new NotFoundError("Seller profile not found");
        }

        const stores = sellerProfile.stores || [];
        const results: PayoutSummaryByStore[] = [];

        for (const store of stores) {
            const orderStats = await this.orderRepository
                .createQueryBuilder("order")
                .select("COUNT(order.id)", "total_orders")
                .addSelect("COALESCE(SUM(order.total_amount), 0)", "total_revenue")
                .addSelect("COALESCE(SUM(order.admin_commission), 0)", "total_commission")
                .addSelect("COALESCE(SUM(order.seller_amount), 0)", "net_earnings")
                .where("order.store_id = :storeId", { storeId: store.id })
                .andWhere("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
                .getRawOne();

            // 1. Available for payout (orders pending payout)
            const availableResult = await this.orderRepository
                .createQueryBuilder("order")
                .select("COALESCE(SUM(order.seller_amount), 0)", "available")
                .where("order.store_id = :storeId", { storeId: store.id })
                .andWhere("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
                .andWhere("order.payout_status = :payoutStatus", { payoutStatus: "pending" })
                .getRawOne();

            // 2. Pending payout (from Payout requests)
            const pendingResult = await this.payoutRepository
                .createQueryBuilder("payout")
                .select("COALESCE(SUM(payout.amount), 0)", "pending")
                .where("payout.store_id = :storeId", { storeId: store.id })
                .andWhere("payout.status IN (:...statuses)", { statuses: ["requested", "approved", "processing"] })
                .getRawOne();

            results.push({
                store_id: store.id,
                store_name: store.name,
                total_orders: parseInt(orderStats?.total_orders) || 0,
                total_revenue: parseFloat(orderStats?.total_revenue) || 0,
                total_commission: parseFloat(orderStats?.total_commission) || 0,
                net_earnings: parseFloat(orderStats?.net_earnings) || 0,
                pending_payout: parseFloat(pendingResult?.pending) || 0,
                available_for_payout: parseFloat(availableResult?.available) || 0
            });
        }

        return results;
    }

    // ============== PAYOUT REQUESTS ==============

    async createPayoutRequest(sellerId: number, data: CreatePayoutRequestDto): Promise<SellerPayoutResponse> {
        const sellerProfile = await this.sellerProfileRepository.findOne({
            where: { user_id: sellerId },
            relations: ["stores", "bankKyc"]
        });

        if (!sellerProfile) {
            throw new NotFoundError("Seller profile not found");
        }

        // Verify KYC is complete
        if (!sellerProfile.kyc_verified) {
            throw new ValidationError("KYC verification is required before requesting payouts");
        }

        // Get orders eligible for payout
        let orderQuery = this.orderRepository
            .createQueryBuilder("order")
            .where("order.status IN (:...statuses)", { statuses: ["paid", "shipped", "delivered"] })
            .andWhere("order.payout_status = :payoutStatus", { payoutStatus: "pending" });

        if (data.store_id) {
            // Verify store belongs to seller
            const store = sellerProfile.stores?.find(s => s.id === data.store_id);
            if (!store) {
                throw new ValidationError("Store not found or doesn't belong to you");
            }
            orderQuery = orderQuery.andWhere("order.store_id = :storeId", { storeId: data.store_id });
        } else {
            const storeIds = sellerProfile.stores?.map(s => s.id) || [];
            if (storeIds.length === 0) {
                throw new ValidationError("No stores found");
            }
            orderQuery = orderQuery.andWhere("order.store_id IN (:...storeIds)", { storeIds });
        }

        if (data.order_ids && data.order_ids.length > 0) {
            orderQuery = orderQuery.andWhere("order.id IN (:...orderIds)", { orderIds: data.order_ids });
        }

        const orders = await orderQuery.getMany();

        if (orders.length === 0) {
            throw new ValidationError("No orders available for payout");
        }

        // Calculate totals
        const grossAmount = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
        const commissionAmount = orders.reduce((sum, o) => sum + Number(o.admin_commission), 0);
        const netAmount = orders.reduce((sum, o) => sum + Number(o.seller_amount), 0);
        const orderIds = orders.map(o => o.id);

        // Create payout request
        const payout = this.payoutRepository.create({
            seller_id: sellerProfile.id,
            store_id: data.store_id,
            gross_amount: grossAmount,
            commission_amount: commissionAmount,
            amount: netAmount,
            status: "requested",
            request_notes: data.request_notes,
            order_ids: orderIds
        });

        await this.payoutRepository.save(payout);

        // Update all orders payout status
        for (const orderId of orderIds) {
            await this.orderRepository.update(
                { id: orderId },
                { payout_status: "requested" }
            );
        }

        return this.toSellerPayoutResponse(payout);
    }

    async getSellerPayouts(sellerId: number, status?: string, storeId?: number): Promise<SellerPayoutResponse[]> {
        const sellerProfile = await this.sellerProfileRepository.findOne({
            where: { user_id: sellerId }
        });

        if (!sellerProfile) {
            throw new NotFoundError("Seller profile not found");
        }

        const queryBuilder = this.payoutRepository
            .createQueryBuilder("payout")
            .leftJoinAndSelect("payout.store", "store")
            .where("payout.seller_id = :sellerId", { sellerId: sellerProfile.id });

        if (status) {
            queryBuilder.andWhere("payout.status = :status", { status });
        }

        if (storeId) {
            queryBuilder.andWhere("payout.store_id = :storeId", { storeId });
        }

        const payouts = await queryBuilder
            .orderBy("payout.created_at", "DESC")
            .getMany();

        return payouts.map(p => this.toSellerPayoutResponse(p));
    }

    async getPayoutById(sellerId: number, payoutId: number): Promise<SellerPayoutResponse> {
        const sellerProfile = await this.sellerProfileRepository.findOne({
            where: { user_id: sellerId }
        });

        if (!sellerProfile) {
            throw new NotFoundError("Seller profile not found");
        }

        const payout = await this.payoutRepository.findOne({
            where: { id: payoutId, seller_id: sellerProfile.id },
            relations: ["store"]
        });

        if (!payout) {
            throw new NotFoundError("Payout not found");
        }

        return this.toSellerPayoutResponse(payout);
    }

    // ============== HELPER ==============

    private toSellerPayoutResponse(payout: Payout): SellerPayoutResponse {
        return {
            id: payout.id,
            store_id: payout.store_id,
            gross_amount: payout.gross_amount,
            commission_amount: payout.commission_amount,
            net_amount: payout.amount,
            status: payout.status,
            request_notes: payout.request_notes,
            admin_notes: payout.admin_notes,
            transaction_id: payout.transaction_id,
            processed_at: payout.processed_at,
            created_at: payout.created_at,
            updated_at: payout.updated_at,
            store: payout.store ? {
                id: payout.store.id,
                name: payout.store.name
            } : undefined
        };
    }
}

// Export singleton instance
export const payoutService = new PayoutService();
