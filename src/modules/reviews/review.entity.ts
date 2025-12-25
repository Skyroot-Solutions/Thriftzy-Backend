import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn
} from "typeorm";
import { Product } from "../products/product.entity";
import { User } from "../users/user.entity";
import { Store } from "../stores/store.entity";

@Entity("reviews")
export class Review {
    @PrimaryGeneratedColumn("increment")
    id: number;

    @Column({ nullable: true })
    product_id: number;

    @Column()
    user_id: number;

    @Column({ nullable: true })
    store_id: number;

    @Column()
    rating: number;

    @Column({ length: 1000, nullable: true, default: "" })
    description: string;

    // Optional images - stored as JSON array of URLs
    @Column({ type: "simple-array", nullable: true })
    images: string[];

    // Seller's single reply to this review
    @Column({ length: 500, nullable: true })
    seller_reply: string;

    @Column({ nullable: true })
    seller_reply_at: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @ManyToOne(() => Product, (product) => product.reviews)
    @JoinColumn({ name: "product_id" })
    product: Product;

    @ManyToOne(() => User, (user) => user.reviews)
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Store, (store) => store.reviews)
    @JoinColumn({ name: "store_id" })
    store: Store;
}