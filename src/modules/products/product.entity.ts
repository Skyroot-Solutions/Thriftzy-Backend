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
import { Store } from "../stores/store.entity";
import { ProductImage } from "./productImage.entity";
import { ProductAttribute } from "./product.attribute";
import { CartItem } from "../carts/cartItems.entity";
import { OrderItem } from "../orders/orderItem.entity";
import { Review } from "../reviews/review.entity";
import { Wishlist } from "../wishlist/wishlist.entity";

/*
   This is the product entity and it has relationship with store 
   entity and product image entity
 */


@Entity("products")
export class Product {

    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    store_id: number

    @Column({ length: 120 })
    title: string

    @Column({ length: 300 })
    description: string

    @Column({ length: 120 })
    category: string

    @Column()
    condition: "new" | "good" | "fair"

    @Column({ type: "decimal", precision: 10, scale: 2 })
    price: number

    @Column()
    quantity: number

    @CreateDateColumn()
    created_at: Date

    @UpdateDateColumn()
    updated_at: Date

    @ManyToOne(() => Store, (store) => store.products)
    @JoinColumn({ name: "store_id" })
    store: Store;

    @OneToMany(() => ProductImage, (productImage) => productImage.product, { cascade: true, onDelete: 'CASCADE' })
    images: ProductImage[];

    @OneToMany(() => ProductAttribute, (productAttribute) => productAttribute.product, { cascade: true, onDelete: 'CASCADE' })
    attributes: ProductAttribute[];

    @OneToMany(() => CartItem, (cartItem) => cartItem.product)
    cart_items: CartItem[];

    @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
    order_items: OrderItem[];

    @OneToMany(() => Review, (review) => review.product)
    reviews: Review[];

    @OneToMany(() => Wishlist, (wishlist) => wishlist.product)
    wishlist: Wishlist[];
}
