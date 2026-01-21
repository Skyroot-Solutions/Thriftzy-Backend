// ============== Request DTOs ==============

export interface AddToCartRequest {
    product_id: number;
    quantity: number;
}

export interface UpdateCartItemRequest {
    quantity: number;
}

// ============== Response DTOs ==============

export interface CartResponse {
    id: number;
    items: CartItemResponse[];
    summary: CartSummary;
    updated_at: Date;
}

export interface CartItemResponse {
    id: number;
    product_id: number;
    quantity: number;
    product: CartProductInfo;
    item_total: number;
    is_available: boolean;
    availability_message: string | null;
}

export interface CartProductInfo {
    id: number;
    title: string;
    price: number;
    quantity: number; // Available stock
    condition: "new" | "good" | "fair";
    thumbnail: string | null;
    store: {
        id: number;
        name: string;
        slug: string;
        return_policy: string | null;
        shipping_policy: string | null;
    };
}

export interface CartSummary {
    total_items: number;
    total_quantity: number;
    subtotal: number;
    discount: number;
    total: number;
}

export interface CartCountResponse {
    success: boolean;
    data: {
        count: number;
    };
}

export interface AddToCartResponse {
    success: boolean;
    message: string;
    data: {
        cart_item_id: number;
        quantity: number;
    };
}

export interface MessageResponse {
    success: boolean;
    message: string;
}
