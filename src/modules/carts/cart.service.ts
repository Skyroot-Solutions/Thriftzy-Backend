import { Repository } from "typeorm";
import { Cart } from "./cart.entity";
import { CartItem } from "./cartItems.entity";
import { Product } from "../products/product.entity";
import { AppDataSource } from "../../db/data-source";
import {
    AddToCartRequest,
    CartResponse,
    CartItemResponse,
    CartSummary,
    CartProductInfo
} from "./cart.types";
import { NotFoundError, ValidationError } from "../auth/auth.types";

export class CartService {
    private cartRepository: Repository<Cart>;
    private cartItemRepository: Repository<CartItem>;
    private productRepository: Repository<Product>;

    constructor() {
        this.cartRepository = AppDataSource.getRepository(Cart);
        this.cartItemRepository = AppDataSource.getRepository(CartItem);
        this.productRepository = AppDataSource.getRepository(Product);
    }

    // ============== GET CART ==============

    async getCart(userId: number): Promise<CartResponse> {
        let cart = await this.getOrCreateCart(userId);

        // Reload with full relations
        cart = await this.cartRepository.findOne({
            where: { id: cart.id },
            relations: ["items", "items.product", "items.product.store", "items.product.images"]
        }) as Cart;

        return this.toCartResponse(cart);
    }

    // ============== GET CART COUNT ==============

    async getCartCount(userId: number): Promise<number> {
        const cart = await this.cartRepository.findOne({
            where: { user_id: userId },
            relations: ["items"]
        });

        if (!cart) return 0;

        return cart.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    }

    // ============== ADD TO CART ==============

    async addToCart(userId: number, data: AddToCartRequest): Promise<{ cart_item_id: number; quantity: number }> {
        // Validate quantity
        if (data.quantity < 1) {
            throw new ValidationError("Quantity must be at least 1");
        }

        // Check product exists and is available
        const product = await this.productRepository.findOne({
            where: { id: data.product_id },
            relations: ["store"]
        });

        if (!product) {
            throw new NotFoundError("Product not found");
        }

        if (!product.store?.is_active) {
            throw new ValidationError("This product is not available");
        }

        if (product.quantity < 1) {
            throw new ValidationError("Product is out of stock");
        }

        if (data.quantity > product.quantity) {
            throw new ValidationError(`Only ${product.quantity} items available`);
        }

        // Get or create cart
        const cart = await this.getOrCreateCart(userId);

        // Check if product already in cart
        let cartItem = await this.cartItemRepository.findOne({
            where: { cart_id: cart.id, product_id: data.product_id }
        });

        if (cartItem) {
            // Update quantity
            const newQuantity = cartItem.quantity + data.quantity;

            if (newQuantity > product.quantity) {
                throw new ValidationError(`Cannot add more. Only ${product.quantity} items available`);
            }

            cartItem.quantity = newQuantity;
            await this.cartItemRepository.save(cartItem);
        } else {
            // Create new cart item
            cartItem = this.cartItemRepository.create({
                cart_id: cart.id,
                product_id: data.product_id,
                quantity: data.quantity
            });
            await this.cartItemRepository.save(cartItem);
        }

        return {
            cart_item_id: cartItem.id,
            quantity: cartItem.quantity
        };
    }

    // ============== UPDATE CART ITEM ==============

    async updateCartItem(userId: number, itemId: number, quantity: number): Promise<CartItemResponse> {
        const cart = await this.cartRepository.findOne({
            where: { user_id: userId }
        });

        if (!cart) {
            throw new NotFoundError("Cart not found");
        }

        const cartItem = await this.cartItemRepository.findOne({
            where: { id: itemId, cart_id: cart.id },
            relations: ["product", "product.store", "product.images"]
        });

        if (!cartItem) {
            throw new NotFoundError("Cart item not found");
        }

        if (quantity < 1) {
            throw new ValidationError("Quantity must be at least 1");
        }

        if (quantity > cartItem.product.quantity) {
            throw new ValidationError(`Only ${cartItem.product.quantity} items available`);
        }

        cartItem.quantity = quantity;
        await this.cartItemRepository.save(cartItem);

        return this.toCartItemResponse(cartItem);
    }

    // ============== REMOVE FROM CART ==============

    async removeFromCart(userId: number, itemId: number): Promise<void> {
        const cart = await this.cartRepository.findOne({
            where: { user_id: userId }
        });

        if (!cart) {
            throw new NotFoundError("Cart not found");
        }

        const cartItem = await this.cartItemRepository.findOne({
            where: { id: itemId, cart_id: cart.id }
        });

        if (!cartItem) {
            throw new NotFoundError("Cart item not found");
        }

        await this.cartItemRepository.remove(cartItem);
    }

    // ============== REMOVE PRODUCT FROM CART ==============

    async removeProductFromCart(userId: number, productId: number): Promise<void> {
        const cart = await this.cartRepository.findOne({
            where: { user_id: userId }
        });

        if (!cart) {
            throw new NotFoundError("Cart not found");
        }

        const cartItem = await this.cartItemRepository.findOne({
            where: { cart_id: cart.id, product_id: productId }
        });

        if (!cartItem) {
            throw new NotFoundError("Product not in cart");
        }

        await this.cartItemRepository.remove(cartItem);
    }

    // ============== CLEAR CART ==============

    async clearCart(userId: number): Promise<void> {
        const cart = await this.cartRepository.findOne({
            where: { user_id: userId }
        });

        if (!cart) {
            return; // No cart to clear
        }

        await this.cartItemRepository.delete({ cart_id: cart.id });
    }

    // ============== VALIDATE CART ==============

    async validateCart(userId: number): Promise<{
        is_valid: boolean;
        invalid_items: { item_id: number; product_id: number; reason: string }[];
    }> {
        const cart = await this.cartRepository.findOne({
            where: { user_id: userId },
            relations: ["items", "items.product", "items.product.store"]
        });

        if (!cart || !cart.items?.length) {
            return { is_valid: true, invalid_items: [] };
        }

        const invalidItems: { item_id: number; product_id: number; reason: string }[] = [];

        for (const item of cart.items) {
            if (!item.product) {
                invalidItems.push({
                    item_id: item.id,
                    product_id: item.product_id,
                    reason: "Product no longer exists"
                });
                continue;
            }

            if (!item.product.store?.is_active) {
                invalidItems.push({
                    item_id: item.id,
                    product_id: item.product_id,
                    reason: "Store is no longer active"
                });
                continue;
            }

            if (item.product.quantity < 1) {
                invalidItems.push({
                    item_id: item.id,
                    product_id: item.product_id,
                    reason: "Product is out of stock"
                });
                continue;
            }

            if (item.quantity > item.product.quantity) {
                invalidItems.push({
                    item_id: item.id,
                    product_id: item.product_id,
                    reason: `Only ${item.product.quantity} items available`
                });
            }
        }

        return {
            is_valid: invalidItems.length === 0,
            invalid_items: invalidItems
        };
    }

    // ============== HELPER METHODS ==============

    private async getOrCreateCart(userId: number): Promise<Cart> {
        let cart = await this.cartRepository.findOne({
            where: { user_id: userId }
        });

        if (!cart) {
            cart = this.cartRepository.create({
                user_id: userId
            });
            await this.cartRepository.save(cart);
        }

        return cart;
    }

    private toCartResponse(cart: Cart): CartResponse {
        const items = (cart.items || []).map(item => this.toCartItemResponse(item));

        return {
            id: cart.id,
            items,
            summary: this.calculateSummary(items),
            updated_at: cart.updated_at
        };
    }

    private toCartItemResponse(item: CartItem): CartItemResponse {
        const product = item.product;
        const isAvailable = product && product.store?.is_active && product.quantity > 0;

        let availabilityMessage: string | null = null;
        if (!product) {
            availabilityMessage = "Product no longer exists";
        } else if (!product.store?.is_active) {
            availabilityMessage = "Store is not available";
        } else if (product.quantity < 1) {
            availabilityMessage = "Out of stock";
        } else if (item.quantity > product.quantity) {
            availabilityMessage = `Only ${product.quantity} available`;
        }

        // Get thumbnail
        const sortedImages = (product?.images || []).sort((a, b) => a.position - b.position);
        const thumbnail = sortedImages.length > 0 ? sortedImages[0].image_url : null;

        return {
            id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
            product: {
                id: product?.id || 0,
                title: product?.title || "Unknown Product",
                price: product?.price || 0,
                quantity: product?.quantity || 0,
                condition: product?.condition || "good",
                thumbnail,
                store: {
                    id: product?.store?.id || 0,
                    name: product?.store?.name || "Unknown Store",
                    slug: product?.store?.slug || "",
                    return_policy: product?.store?.return_policy || null,
                    shipping_policy: product?.store?.shipping_policy || null
                }
            },
            item_total: (product?.price || 0) * item.quantity,
            is_available: isAvailable,
            availability_message: availabilityMessage
        };
    }

    private calculateSummary(items: CartItemResponse[]): CartSummary {
        const availableItems = items.filter(i => i.is_available);

        const totalItems = availableItems.length;
        const totalQuantity = availableItems.reduce((sum, i) => sum + i.quantity, 0);
        const subtotal = availableItems.reduce((sum, i) => sum + i.item_total, 0);
        const discount = 0; // Can be calculated based on promotions
        const total = subtotal - discount;

        return {
            total_items: totalItems,
            total_quantity: totalQuantity,
            subtotal,
            discount,
            total
        };
    }
}

// Export singleton instance
export const cartService = new CartService();
