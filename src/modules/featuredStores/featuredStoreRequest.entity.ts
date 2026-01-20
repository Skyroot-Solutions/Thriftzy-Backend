import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn
} from "typeorm";
import { Store } from "../stores/store.entity";

export type FeaturedRequestStatus = "pending" | "approved" | "rejected" | "expired";

@Entity("featured_store_requests")
export class FeaturedStoreRequest {
    @PrimaryGeneratedColumn("increment")
    id: number;

    @Column()
    store_id: number;

    @ManyToOne(() => Store)
    @JoinColumn({ name: "store_id" })
    store: Store;

    @Column({ type: "text", nullable: true })
    message: string;

    @Column({
        type: "enum",
        enum: ["pending", "approved", "rejected", "expired"],
        default: "pending"
    })
    status: FeaturedRequestStatus;

    @Column({ type: "int", default: 7 })
    requested_days: number;

    @Column({ type: "date", nullable: true })
    featured_start_date: Date;

    @Column({ type: "date", nullable: true })
    featured_end_date: Date;

    @Column({ type: "text", nullable: true })
    admin_notes: string;

    @Column({ nullable: true })
    approved_by: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
