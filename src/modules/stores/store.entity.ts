import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn
} from "typeorm";
import { Product } from "../products/product.entity";
import { Review } from "../reviews/review.entity";
import { SellerProfile } from "../seller/sellerProfile.entity";
import { Order } from "../orders/order.entity";

/*
    This is the store entity and it has relationship with product entity
*/

@Entity("stores")
export class Store {
    @PrimaryGeneratedColumn("increment")
    id: number;

    @Column()
    seller_id: number;

    @Column({ length: 120 })
    name: string;

    @Column({ length: 120 })
    slug: string;

    @Column({ length: 120 })
    description: string;

    @Column({ length: 120 })
    logo_url: string;

    @Column({ type: "decimal", precision: 3, scale: 2, default: 0 })
    rating_avg: number;

    @Column({ default: 0 })
    rating_count: number;

    @Column({ default: true })
    is_active: boolean;

    @Column({ default: false })
    is_verified: boolean;

    // Store Address
    @Column({ nullable: true })
    address_line1: string;

    @Column({ nullable: true })
    address_line2: string;

    @Column({ nullable: true })
    city: string;

    @Column({ nullable: true })
    state: string;

    @Column({ nullable: true })
    country: string;

    @Column({ nullable: true })
    pincode: string;

    @Column({ nullable: true })
    address_phone: string;

    // Store Policies
    @Column({ type: "text", nullable: true })
    shipping_policy: string;

    @Column({ type: "text", nullable: true })
    return_policy: string;

    @Column({ nullable: true })
    support_contact: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @ManyToOne(() => SellerProfile, (sellerProfile) => sellerProfile.stores)
    @JoinColumn({ name: "seller_id" })
    seller_profile: SellerProfile;

    @OneToMany(() => Product, (product) => product.store)
    products: Product[];

    @OneToMany(() => Order, (order) => order.store)
    orders: Order[];

    @OneToMany(() => Review, (review) => review.store)
    reviews: Review[];
}
