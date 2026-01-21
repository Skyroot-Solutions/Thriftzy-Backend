import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { SellerProfile } from "../seller/sellerProfile.entity";
import { Cart } from "../carts/cart.entity";
import { Order } from "../orders/order.entity";
import { Review } from "../reviews/review.entity";
import { Address } from "../addresses/addresses.entity";
import { Wishlist } from "../wishlist/wishlist.entity";
/*
    This is the user entity and it has relationship with seller profile entity
*/

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("increment")
    id: number;

    @Column({ length: 120 })
    name: string;

    @Column({ length: 120, unique: true })
    email: string;

    @Column({ length: 20, unique: true, nullable: false })
    phone: string;

    @Column()
    password_hash: string;

    @Column({ default: "buyer" })
    role: "buyer" | "seller";

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @OneToOne(() => SellerProfile, (sellerProfile) => sellerProfile.user)
    seller_profile: SellerProfile;

    @OneToMany(() => Address, (address) => address.user)
    addresses: Address[];

    @OneToOne(() => Cart, (cart) => cart.user)
    cart: Cart;

    @OneToMany(() => Order, (order) => order.user)
    orders: Order[];

    @OneToMany(() => Review, (review) => review.user)
    reviews: Review[];

    @OneToMany(() => Wishlist, (wishlist) => wishlist.user)
    wishlist: Wishlist[];
}