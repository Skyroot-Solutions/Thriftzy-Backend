import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { User } from "../users/user.entity";
import { Product } from "../products/product.entity";

@Entity("wishlist")
export class Wishlist {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    user_id: number;

    @Column()
    product_id: number;

    @CreateDateColumn()
    created_at: Date;

    @ManyToOne(() => User, (user) => user.wishlist)
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Product, (product) => product.wishlist)
    @JoinColumn({ name: "product_id" })
    product: Product;
}
