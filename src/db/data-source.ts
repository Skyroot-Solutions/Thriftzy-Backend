import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();
import { DataSource } from "typeorm";
import { User } from "../modules/users/user.entity";
import { SellerProfile } from "../modules/seller/sellerProfile.entity";
import { SellerPanKyc } from "../modules/sellerDocuments/sellerPan.entity";
import { SellerAadhaarKyc } from "../modules/sellerDocuments/sellerAadhar.entity";
import { SellerBankKyc } from "../modules/sellerDocuments/sellerBank.entity";
import { Store } from "../modules/stores/store.entity";
import { Product } from "../modules/products/product.entity";
import { ProductImage } from "../modules/products/productImage.entity";
import { ProductAttribute } from "../modules/products/product.attribute";
import { Cart } from "../modules/carts/cart.entity";
import { CartItem } from "../modules/carts/cartItems.entity";
import { Order } from "../modules/orders/order.entity";
import { OrderItem } from "../modules/orders/orderItem.entity";
import { Payment } from "../modules/payments/payment.entity";
import { Review } from "../modules/reviews/review.entity";
import { Payout } from "../modules/payouts/payout.entity";
import { Address } from "../modules/addresses/addresses.entity";
// Auth entities
import { RefreshToken } from "../modules/auth/refreshToken.entity";
// Admin entities
import { Admin } from "../modules/admin/admin.entity";
import { AdminWallet } from "../modules/admin/adminWallet.entity";
import { CommissionSettings } from "../modules/admin/commissionSettings.entity";
// Support entities
import { SupportTicket } from "../modules/support/supportTicket.entity";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    username: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "ragul@2004",
    database: process.env.POSTGRES_DB || "thriftzy-dev",
    entities: [
        User,
        SellerProfile,
        // KYC Entities
        SellerPanKyc,
        SellerAadhaarKyc,
        SellerBankKyc,
        Store,
        Product,
        ProductImage,
        ProductAttribute,
        Cart,
        CartItem,
        Order,
        OrderItem,
        Payment,
        Address,
        Review,
        Payout,
        // Auth entities
        RefreshToken,
        // Admin entities
        Admin,
        AdminWallet,
        CommissionSettings,
        // Support entities
        SupportTicket
    ],
    migrations: [process.env.NODE_ENV === "production" ? "dist/migrations/*.js" : "src/migrations/*.ts"],
    subscribers: [process.env.NODE_ENV === "production" ? "dist/subscribers/*.js" : "src/subscribers/*.ts"],
    synchronize: process.env.TYPEORM_SYNCHRONIZE ? process.env.TYPEORM_SYNCHRONIZE === "true" : true,
    logging: process.env.TYPEORM_LOGGING === "true" ? true : false,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
    extra: {
        max: 20, // Connection pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    }
});

