import { Repository } from "typeorm";
import { User } from "../users/user.entity";
import { SellerProfile } from "./sellerProfile.entity";
import { Store } from "../stores/store.entity";
import { Product } from "../products/product.entity";
import { ProductImage } from "../products/productImage.entity";
import { ProductAttribute } from "../products/product.attribute";
import { Order } from "../orders/order.entity";
import { Payout } from "../payouts/payout.entity";
import { AppDataSource } from "../../db/data-source";
import {
    CreateStoreRequest,
    UpdateStoreRequest,
    CreateProductRequest,
    UpdateProductRequest,
    UpdateOrderStatusRequest,
    SellerProfileData,
    SellerStats,
    StoreResponse,
    ProductResponse,
    SellerOrderResponse,
    PayoutResponse,
    ProductFilters,
    OrderFilters,
    PayoutFilters
} from "./seller.types";
import { NotFoundError, ValidationError } from "../auth/auth.types";
import { validateName, validateLength } from "../../utils/validator";

export class SellerService {
    private userRepository: Repository<User>;
    private sellerProfileRepository: Repository<SellerProfile>;
    private storeRepository: Repository<Store>;
    private productRepository: Repository<Product>;
    private productImageRepository: Repository<ProductImage>;
    private productAttributeRepository: Repository<ProductAttribute>;
    private orderRepository: Repository<Order>;
    private payoutRepository: Repository<Payout>;

    constructor() {
        this.userRepository = AppDataSource.getRepository(User);
        this.sellerProfileRepository = AppDataSource.getRepository(SellerProfile);
        this.storeRepository = AppDataSource.getRepository(Store);
        this.productRepository = AppDataSource.getRepository(Product);
        this.productImageRepository = AppDataSource.getRepository(ProductImage);
        this.productAttributeRepository = AppDataSource.getRepository(ProductAttribute);
        this.orderRepository = AppDataSource.getRepository(Order);
        this.payoutRepository = AppDataSource.getRepository(Payout);
    }

    // ============== SELLER PROFILE ==============

    async getSellerProfile(userId: number): Promise<SellerProfileData> {
        const profile = await this.sellerProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) {
            throw new NotFoundError("Seller profile not found");
        }

        return this.toSellerProfileData(profile);
    }

    async getSellerDashboard(userId: number, storeId?: number): Promise<{ profile: SellerProfileData; stats: SellerStats }> {
        const profile = await this.sellerProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) {
            throw new NotFoundError("Seller profile not found");
        }

        // Get stores for this seller (filter by storeId if provided)
        let stores = await this.storeRepository.find({
            where: { seller_id: profile.id }
        });

        // If specific store requested, verify it belongs to seller and filter
        if (storeId) {
            const store = stores.find(s => s.id === storeId);
            if (!store) {
                throw new NotFoundError("Store not found or doesn't belong to you");
            }
            stores = [store];
        }

        const storeIds = stores.map(s => s.id);

        // Calculate stats for filtered stores
        const totalProducts = storeIds.length > 0
            ? await this.productRepository.count({ where: storeIds.map(id => ({ store_id: id })) })
            : 0;

        const ordersQuery = this.orderRepository.createQueryBuilder("order")
            .where("order.store_id IN (:...storeIds)", { storeIds: storeIds.length > 0 ? storeIds : [0] });

        const totalOrders = await ordersQuery.getCount();

        const pendingOrders = await ordersQuery
            .clone()
            .andWhere("order.status IN (:...statuses)", { statuses: ["pending", "paid"] })
            .getCount();

        const shippedOrders = await ordersQuery
            .clone()
            .andWhere("order.status = :status", { status: "shipped" })
            .getCount();

        const deliveredOrders = await ordersQuery
            .clone()
            .andWhere("order.status = :status", { status: "delivered" })
            .getCount();

        const cancelledOrders = await ordersQuery
            .clone()
            .andWhere("order.status = :status", { status: "cancelled" })
            .getCount();

        const revenueResult = await ordersQuery
            .clone()
            .andWhere("order.status = :status", { status: "delivered" })
            .select("SUM(order.total_amount)", "total")
            .getRawOne();

        // Get month revenue (current month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthRevenueResult = await ordersQuery
            .clone()
            .andWhere("order.status = :status", { status: "delivered" })
            .andWhere("order.created_at >= :startOfMonth", { startOfMonth })
            .select("SUM(order.total_amount)", "total")
            .getRawOne();

        // Low stock products (quantity <= 5)
        const lowStockProducts = storeIds.length > 0
            ? await this.productRepository
                .createQueryBuilder("product")
                .where("product.store_id IN (:...storeIds)", { storeIds })
                .andWhere("product.quantity <= :threshold AND product.quantity > 0", { threshold: 5 })
                .getCount()
            : 0;

        // Out of stock products
        const outOfStockProducts = storeIds.length > 0
            ? await this.productRepository
                .createQueryBuilder("product")
                .where("product.store_id IN (:...storeIds)", { storeIds })
                .andWhere("product.quantity = 0")
                .getCount()
            : 0;

        // Recent orders (last 5)
        const recentOrders = storeIds.length > 0
            ? await this.orderRepository
                .createQueryBuilder("order")
                .leftJoinAndSelect("order.user", "user")
                .where("order.store_id IN (:...storeIds)", { storeIds })
                .orderBy("order.created_at", "DESC")
                .take(5)
                .getMany()
            : [];

        // Top products (by order count or quantity sold)
        const topProducts = storeIds.length > 0
            ? await this.productRepository
                .createQueryBuilder("product")
                .leftJoinAndSelect("product.images", "images")
                .where("product.store_id IN (:...storeIds)", { storeIds })
                .orderBy("product.quantity", "DESC")
                .take(5)
                .getMany()
            : [];

        const pendingPayouts = await this.payoutRepository.count({
            where: { seller_id: profile.id, status: "pending" }
        });

        return {
            profile: this.toSellerProfileData(profile),
            stats: {
                total_stores: stores.length,
                total_products: totalProducts,
                total_orders: totalOrders,
                pending_orders: pendingOrders,
                shipped_orders: shippedOrders,
                delivered_orders: deliveredOrders,
                cancelled_orders: cancelledOrders,
                total_revenue: parseFloat(revenueResult?.total || "0"),
                month_revenue: parseFloat(monthRevenueResult?.total || "0"),
                pending_payouts: pendingPayouts,
                low_stock_products: lowStockProducts,
                out_of_stock_products: outOfStockProducts,
                recent_orders: recentOrders.map(o => ({
                    id: o.id,
                    customer_name: o.user?.name || "Unknown",
                    status: o.status,
                    total_amount: o.total_amount,
                    created_at: o.created_at
                })),
                top_products: topProducts.map(p => ({
                    id: p.id,
                    title: p.title,
                    price: p.price,
                    quantity: p.quantity,
                    image_url: p.images?.[0]?.image_url || null
                }))
            }
        };
    }

    // ============== STORE MANAGEMENT ==============

    async getStores(userId: number): Promise<StoreResponse[]> {
        const profile = await this.getSellerProfileEntity(userId);

        const stores = await this.storeRepository.find({
            where: { seller_id: profile.id },
            relations: ["products"]
        });

        return stores.map(store => this.toStoreResponse(store));
    }

    async getStoreById(userId: number, storeId: number): Promise<StoreResponse> {
        const profile = await this.getSellerProfileEntity(userId);

        const store = await this.storeRepository.findOne({
            where: { id: storeId, seller_id: profile.id },
            relations: ["products"]
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        return this.toStoreResponse(store);
    }

    async createStore(userId: number, data: CreateStoreRequest): Promise<StoreResponse> {
        const profile = await this.getSellerProfileEntity(userId);

        // Validate
        validateName(data.name, 3);
        validateLength(data.description, "Description", 10, 500);

        // Generate slug if not provided
        const slug = data.slug || this.generateSlug(data.name);

        // Check if slug is unique
        const existingStore = await this.storeRepository.findOne({ where: { slug } });
        if (existingStore) {
            throw new ValidationError("Store URL is already taken");
        }

        const store = this.storeRepository.create({
            seller_id: profile.id,
            name: data.name,
            slug,
            description: data.description,
            logo_url: data.logo_url || "",
            rating_avg: 0,
            rating_count: 0,
            is_active: true,
            is_verified: false
        });

        await this.storeRepository.save(store);

        return this.toStoreResponse(store);
    }

    async updateStore(userId: number, storeId: number, data: UpdateStoreRequest): Promise<StoreResponse> {
        const profile = await this.getSellerProfileEntity(userId);

        const store = await this.storeRepository.findOne({
            where: { id: storeId, seller_id: profile.id }
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        if (data.name !== undefined) {
            validateName(data.name, 3);
            store.name = data.name;
        }
        if (data.description !== undefined) {
            validateLength(data.description, "Description", 10, 500);
            store.description = data.description;
        }
        if (data.logo_url !== undefined) {
            store.logo_url = data.logo_url;
        }
        if (data.is_active !== undefined) {
            store.is_active = data.is_active;
        }
        // Address fields
        if (data.address_line1 !== undefined) store.address_line1 = data.address_line1;
        if (data.address_line2 !== undefined) store.address_line2 = data.address_line2;
        if (data.city !== undefined) store.city = data.city;
        if (data.state !== undefined) store.state = data.state;
        if (data.country !== undefined) store.country = data.country;
        if (data.pincode !== undefined) store.pincode = data.pincode;
        if (data.address_phone !== undefined) store.address_phone = data.address_phone;
        // Policy fields
        if (data.shipping_policy !== undefined) store.shipping_policy = data.shipping_policy;
        if (data.return_policy !== undefined) store.return_policy = data.return_policy;
        if (data.support_contact !== undefined) store.support_contact = data.support_contact;

        await this.storeRepository.save(store);

        return this.toStoreResponse(store);
    }

    async deleteStore(userId: number, storeId: number): Promise<void> {
        const profile = await this.getSellerProfileEntity(userId);

        const store = await this.storeRepository.findOne({
            where: { id: storeId, seller_id: profile.id },
            relations: ["products"]
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        // Check if store has active orders
        const activeOrders = await this.orderRepository.count({
            where: { store_id: storeId, status: "pending" }
        });

        if (activeOrders > 0) {
            throw new ValidationError("Cannot delete store with pending orders");
        }

        await this.storeRepository.remove(store);
    }

    // ============== PRODUCT MANAGEMENT ==============

    async getProducts(userId: number, filters: ProductFilters = {}): Promise<{
        products: ProductResponse[];
        total: number;
        page: number;
        limit: number;
    }> {
        const profile = await this.getSellerProfileEntity(userId);
        const stores = await this.storeRepository.find({ where: { seller_id: profile.id } });
        const storeIds = stores.map(s => s.id);

        if (storeIds.length === 0) {
            return { products: [], total: 0, page: 1, limit: 10 };
        }

        const page = filters.page || 1;
        const limit = filters.limit || 10;
        const skip = (page - 1) * limit;

        const queryBuilder = this.productRepository
            .createQueryBuilder("product")
            .leftJoinAndSelect("product.images", "images")
            .leftJoinAndSelect("product.attributes", "attributes")
            .where("product.store_id IN (:...storeIds)", { storeIds });

        if (filters.store_id) {
            queryBuilder.andWhere("product.store_id = :storeId", { storeId: filters.store_id });
        }
        if (filters.category) {
            queryBuilder.andWhere("product.category = :category", { category: filters.category });
        }
        if (filters.condition) {
            queryBuilder.andWhere("product.condition = :condition", { condition: filters.condition });
        }

        const total = await queryBuilder.getCount();

        const products = await queryBuilder
            .orderBy("product.created_at", "DESC")
            .skip(skip)
            .take(limit)
            .getMany();

        return {
            products: products.map(p => this.toProductResponse(p)),
            total,
            page,
            limit
        };
    }

    async getProductById(userId: number, productId: number): Promise<ProductResponse> {
        const profile = await this.getSellerProfileEntity(userId);
        const stores = await this.storeRepository.find({ where: { seller_id: profile.id } });
        const storeIds = stores.map(s => s.id);

        const product = await this.productRepository.findOne({
            where: { id: productId },
            relations: ["images", "attributes"]
        });

        if (!product || !storeIds.includes(product.store_id)) {
            throw new NotFoundError("Product not found");
        }

        return this.toProductResponse(product);
    }

    async createProduct(userId: number, data: CreateProductRequest): Promise<ProductResponse> {
        const profile = await this.getSellerProfileEntity(userId);

        // Verify store belongs to seller
        const store = await this.storeRepository.findOne({
            where: { id: data.store_id, seller_id: profile.id }
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        // Validate
        validateLength(data.title, "Title", 3, 120);
        validateLength(data.description, "Description", 10, 300);

        // Create product
        const product = this.productRepository.create({
            store_id: data.store_id,
            title: data.title,
            description: data.description,
            category: data.category,
            condition: data.condition,
            price: data.price,
            quantity: data.quantity
        });

        await this.productRepository.save(product);

        // Add images
        if (data.images && data.images.length > 0) {
            for (let i = 0; i < data.images.length; i++) {
                const image = this.productImageRepository.create({
                    product_id: product.id,
                    image_url: data.images[i],
                    position: i
                });
                await this.productImageRepository.save(image);
            }
        }

        // Add attributes
        if (data.attributes && data.attributes.length > 0) {
            for (const attr of data.attributes) {
                // Validate attribute has required fields
                if (!attr || typeof attr !== 'object' || !attr.name || !attr.value) {
                    throw new ValidationError("Each attribute must have 'name' and 'value' properties");
                }

                const attribute = this.productAttributeRepository.create({
                    product_id: product.id,
                    name: String(attr.name).trim(),
                    value: String(attr.value).trim()
                });
                await this.productAttributeRepository.save(attribute);
            }
        }

        // Reload with relations
        const savedProduct = await this.productRepository.findOne({
            where: { id: product.id },
            relations: ["images", "attributes"]
        });

        return this.toProductResponse(savedProduct!);
    }

    async updateProduct(userId: number, productId: number, data: UpdateProductRequest): Promise<ProductResponse> {
        const profile = await this.getSellerProfileEntity(userId);
        const stores = await this.storeRepository.find({ where: { seller_id: profile.id } });
        const storeIds = stores.map(s => s.id);

        const product = await this.productRepository.findOne({
            where: { id: productId },
            relations: ["images", "attributes"]
        });

        if (!product || !storeIds.includes(product.store_id)) {
            throw new NotFoundError("Product not found");
        }

        if (data.title !== undefined) {
            validateLength(data.title, "Title", 3, 120);
            product.title = data.title;
        }
        if (data.description !== undefined) {
            validateLength(data.description, "Description", 10, 300);
            product.description = data.description;
        }
        if (data.category !== undefined) product.category = data.category;
        if (data.condition !== undefined) product.condition = data.condition;
        if (data.price !== undefined) product.price = data.price;
        if (data.quantity !== undefined) product.quantity = data.quantity;

        await this.productRepository.save(product);

        return this.toProductResponse(product);
    }

    async deleteProduct(userId: number, productId: number): Promise<void> {
        const profile = await this.getSellerProfileEntity(userId);
        const stores = await this.storeRepository.find({ where: { seller_id: profile.id } });
        const storeIds = stores.map(s => s.id);

        const product = await this.productRepository.findOne({
            where: { id: productId }
        });

        if (!product || !storeIds.includes(product.store_id)) {
            throw new NotFoundError("Product not found");
        }

        await this.productRepository.remove(product);
    }

    // ============== ORDER MANAGEMENT ==============

    async getOrders(userId: number, filters: OrderFilters = {}): Promise<{
        orders: SellerOrderResponse[];
        total: number;
        page: number;
        limit: number;
    }> {
        const profile = await this.getSellerProfileEntity(userId);
        const stores = await this.storeRepository.find({ where: { seller_id: profile.id } });
        const storeIds = stores.map(s => s.id);

        if (storeIds.length === 0) {
            return { orders: [], total: 0, page: 1, limit: 10 };
        }

        const page = filters.page || 1;
        const limit = filters.limit || 10;
        const skip = (page - 1) * limit;

        const queryBuilder = this.orderRepository
            .createQueryBuilder("order")
            .leftJoinAndSelect("order.items", "items")
            .leftJoinAndSelect("items.product", "product")
            .leftJoinAndSelect("product.images", "images")
            .leftJoinAndSelect("order.payment", "payment")
            .leftJoinAndSelect("order.user", "user")
            .leftJoinAndSelect("order.address", "address")
            .where("order.store_id IN (:...storeIds)", { storeIds });

        if (filters.store_id) {
            queryBuilder.andWhere("order.store_id = :storeId", { storeId: filters.store_id });
        }
        if (filters.status) {
            queryBuilder.andWhere("order.status = :status", { status: filters.status });
        }

        const total = await queryBuilder.getCount();

        const orders = await queryBuilder
            .orderBy("order.created_at", "DESC")
            .skip(skip)
            .take(limit)
            .getMany();

        return {
            orders: orders.map(o => this.toSellerOrderResponse(o)),
            total,
            page,
            limit
        };
    }

    async getOrderById(userId: number, orderId: number): Promise<SellerOrderResponse> {
        const profile = await this.getSellerProfileEntity(userId);
        const stores = await this.storeRepository.find({ where: { seller_id: profile.id } });
        const storeIds = stores.map(s => s.id);

        const order = await this.orderRepository.findOne({
            where: { id: orderId },
            relations: ["items", "items.product", "items.product.images", "payment", "user", "address"]
        });

        if (!order || !storeIds.includes(order.store_id)) {
            throw new NotFoundError("Order not found");
        }

        return this.toSellerOrderResponse(order);
    }

    async updateOrderStatus(userId: number, orderId: number, data: UpdateOrderStatusRequest): Promise<SellerOrderResponse> {
        const profile = await this.getSellerProfileEntity(userId);
        const stores = await this.storeRepository.find({ where: { seller_id: profile.id } });
        const storeIds = stores.map(s => s.id);

        const order = await this.orderRepository.findOne({
            where: { id: orderId },
            relations: ["items", "items.product", "items.product.images", "payment", "user", "address"]
        });

        if (!order || !storeIds.includes(order.store_id)) {
            throw new NotFoundError("Order not found");
        }

        // Validate status transition
        // pending = new order, can be: shipped (COD), paid, or cancelled
        // paid = payment received, can be: shipped or cancelled
        // shipped = in transit, can be: delivered
        const validTransitions: Record<string, string[]> = {
            "pending": ["paid", "shipped", "cancelled"],
            "paid": ["shipped", "cancelled"],
            "shipped": ["delivered"],
            "delivered": [],
            "cancelled": []
        };

        if (!validTransitions[order.status]?.includes(data.status)) {
            throw new ValidationError(`Cannot change status from ${order.status} to ${data.status}`);
        }

        order.status = data.status;
        await this.orderRepository.save(order);

        return this.toSellerOrderResponse(order);
    }

    // ============== PAYOUT MANAGEMENT ==============

    async getPayouts(userId: number, filters: PayoutFilters = {}): Promise<{
        payouts: PayoutResponse[];
        total: number;
        page: number;
        limit: number;
    }> {
        const profile = await this.getSellerProfileEntity(userId);

        const page = filters.page || 1;
        const limit = filters.limit || 10;
        const skip = (page - 1) * limit;

        const queryBuilder = this.payoutRepository
            .createQueryBuilder("payout")
            .where("payout.seller_id = :sellerId", { sellerId: profile.id });

        if (filters.status) {
            queryBuilder.andWhere("payout.status = :status", { status: filters.status });
        }

        const total = await queryBuilder.getCount();

        const payouts = await queryBuilder
            .orderBy("payout.created_at", "DESC")
            .skip(skip)
            .take(limit)
            .getMany();

        return {
            payouts: payouts.map(p => this.toPayoutResponse(p)),
            total,
            page,
            limit
        };
    }

    // ============== HELPER METHODS ==============

    private async getSellerProfileEntity(userId: number): Promise<SellerProfile> {
        const profile = await this.sellerProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) {
            throw new NotFoundError("Seller profile not found. Please complete seller registration.");
        }

        return profile;
    }

    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            + "-" + Date.now().toString(36);
    }

    private toSellerProfileData(profile: SellerProfile): SellerProfileData {
        return {
            id: profile.id,
            user_id: profile.user_id,
            kyc_verified: profile.kyc_verified,
            gst_number: profile.gst_number,
            seller_status: profile.seller_status,
            created_at: profile.created_at
        };
    }

    private toStoreResponse(store: Store): StoreResponse {
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
            products_count: store.products?.length,
            // Address
            address_line1: store.address_line1,
            address_line2: store.address_line2,
            city: store.city,
            state: store.state,
            country: store.country,
            pincode: store.pincode,
            address_phone: store.address_phone,
            // Policies
            shipping_policy: store.shipping_policy,
            return_policy: store.return_policy,
            support_contact: store.support_contact,
            created_at: store.created_at
        };
    }

    private toProductResponse(product: Product): ProductResponse {
        return {
            id: product.id,
            store_id: product.store_id,
            title: product.title,
            description: product.description,
            category: product.category,
            condition: product.condition,
            price: product.price,
            quantity: product.quantity,
            images: product.images?.map(img => ({
                id: img.id,
                image_url: img.image_url,
                position: img.position
            })) || [],
            attributes: product.attributes?.map(attr => ({
                id: attr.id,
                name: attr.name,
                value: attr.value
            })) || [],
            created_at: product.created_at,
            updated_at: product.updated_at
        };
    }

    private toSellerOrderResponse(order: Order): SellerOrderResponse {
        return {
            id: order.id,
            user_name: order.user?.name || "Unknown",
            user_email: order.user?.email || "",
            status: order.status,
            total_amount: order.total_amount,
            payment_method: order.payment?.payment_method || "cod",
            items: order.items?.map(item => {
                // Get the first image from product images
                const productImages = item.product?.images || [];
                const firstImage = productImages.sort((a, b) => a.position - b.position)[0];

                return {
                    id: item.id,
                    product_id: item.product_id,
                    product_title: item.product?.title || item.title,
                    product_image: firstImage?.image_url || null,
                    quantity: item.quantity,
                    price_at_purchase: item.price_at_purchase
                };
            }) || [],
            shipping_address: order.address ? {
                name: order.address.name,
                phone: order.address.phone,
                line1: order.address.line1,
                line2: order.address.line2,
                city: order.address.city,
                state: order.address.state,
                country: order.address.country,
                pincode: order.address.pincode
            } : null,
            created_at: order.created_at
        };
    }

    private toPayoutResponse(payout: Payout): PayoutResponse {
        return {
            id: payout.id,
            gross_amount: payout.gross_amount,
            commission_amount: payout.commission_amount,
            amount: payout.amount,
            status: payout.status,
            request_notes: payout.request_notes,
            admin_notes: payout.admin_notes,
            transaction_id: payout.transaction_id,
            processed_at: payout.processed_at,
            created_at: payout.created_at
        };
    }
}

// Export singleton instance
export const sellerService = new SellerService();
