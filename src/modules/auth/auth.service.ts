import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Repository } from "typeorm";
import { User } from "../users/user.entity";
import { RefreshToken } from "./refreshToken.entity";
import { SellerProfile } from "../seller/sellerProfile.entity";
import { AppDataSource } from "../../db/data-source";
import {
    RegisterRequest,
    LoginRequest,
    GoogleOAuthRequest,
    ChangePasswordRequest,
    RefreshTokenRequest,
    AuthResponse,
    TokenPair,
    UserResponse,
    JwtPayload,
    GoogleUserInfo,
    UnauthorizedError,
    NotFoundError,
    ConflictError
} from "./auth.types";
import { validateRegistration, validatePassword } from "../../utils/validator";

export class AuthService {
    private userRepository: Repository<User>;
    private refreshTokenRepository: Repository<RefreshToken>;
    private sellerProfileRepository: Repository<SellerProfile>;

    private readonly JWT_SECRET: string;
    private readonly JWT_REFRESH_SECRET: string;
    private readonly ACCESS_TOKEN_EXPIRY: number; // in seconds
    private readonly REFRESH_TOKEN_EXPIRY: number; // in seconds
    private readonly SALT_ROUNDS: number;

    constructor() {
        this.userRepository = AppDataSource.getRepository(User);
        this.refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
        this.sellerProfileRepository = AppDataSource.getRepository(SellerProfile);

        this.JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";
        this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-super-secret-refresh-key";
        this.ACCESS_TOKEN_EXPIRY = parseInt(process.env.ACCESS_TOKEN_EXPIRY || "900", 10); // 15 minutes
        this.REFRESH_TOKEN_EXPIRY = parseInt(process.env.REFRESH_TOKEN_EXPIRY || "604800", 10); // 7 days
        this.SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
    }

    // ============== REGISTRATION ==============

    async register(data: RegisterRequest): Promise<AuthResponse> {
        // Validate input using external validator
        validateRegistration(data);

        // Check if user already exists
        const existingUser = await this.userRepository.findOne({
            where: [{ email: data.email }, { phone: data.phone }]
        });

        if (existingUser) {
            if (existingUser.email === data.email) {
                throw new ConflictError("Email already registered");
            }
            throw new ConflictError("Phone number already registered");
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(data.password, this.SALT_ROUNDS);

        // Create user
        const user = this.userRepository.create({
            name: data.name,
            email: data.email.toLowerCase(),
            phone: data.phone,
            password_hash: hashedPassword,
            role: data.role || "buyer"
        });

        await this.userRepository.save(user);

        // If user is a seller, create SellerProfile
        if (user.role === "seller") {
            await this.createSellerProfile(user.id);
        }

        // Generate tokens
        const tokens = await this.generateTokenPair(user);

        return {
            success: true,
            message: "Registration successful",
            data: {
                user: this.sanitizeUser(user),
                tokens
            }
        };
    }

    // ============== CREATE SELLER PROFILE ==============

    private async createSellerProfile(userId: number): Promise<SellerProfile> {
        const sellerProfile = this.sellerProfileRepository.create({
            user_id: userId,
            kyc_verified: false,
            seller_status: "pending"
        });

        await this.sellerProfileRepository.save(sellerProfile);
        return sellerProfile;
    }

    // ============== EMAIL/PHONE + PASSWORD LOGIN ==============

    async login(data: LoginRequest, deviceInfo?: string, ipAddress?: string): Promise<AuthResponse> {

        const password = data.password;
        const rawIdentifier = data.emailOrPhone ?? data.email ?? data.phone;

        if (!rawIdentifier) {
            throw new UnauthorizedError("Invalid credentials");
        }

        const isEmailLike = typeof rawIdentifier === "string" && rawIdentifier.includes("@");
        const emailSearch = isEmailLike ? (rawIdentifier as string).toLowerCase() : undefined;
        const phoneSearch = !isEmailLike ? (rawIdentifier as string) : undefined;

        // Build where clauses dynamically and with proper typing
        const whereClauses: Array<Record<string, unknown>> = [];
        if (emailSearch) whereClauses.push({ email: emailSearch });
        if (phoneSearch) whereClauses.push({ phone: phoneSearch });

        // Find user by email or phone
        const user = await this.userRepository.findOne({
            where: whereClauses
        });

        if (!user) {
            throw new UnauthorizedError("Invalid credentials");
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedError("Invalid credentials");
        }

        // Generate tokens
        const tokens = await this.generateTokenPair(user, deviceInfo, ipAddress);

        return {
            success: true,
            message: "Login successful",
            data: {
                user: this.sanitizeUser(user),
                tokens
            }
        };
    }

    // ============== GOOGLE OAUTH ==============

    async googleOAuth(data: GoogleOAuthRequest, deviceInfo?: string, ipAddress?: string): Promise<AuthResponse> {
        const { idToken } = data;

        // Verify Google token
        const googleUser = await this.verifyGoogleToken(idToken);

        if (!googleUser) {
            throw new UnauthorizedError("Invalid Google token");
        }

        // Find or create user
        let user = await this.userRepository.findOne({
            where: { email: googleUser.email.toLowerCase() }
        });

        if (!user) {
            // Create new user from Google data
            user = this.userRepository.create({
                name: googleUser.name,
                email: googleUser.email.toLowerCase(),
                phone: "", // Google doesn't provide phone, user can update later
                password_hash: "", // No password for OAuth users
                role: "buyer"
            });
            await this.userRepository.save(user);
        }

        // Generate tokens
        const tokens = await this.generateTokenPair(user, deviceInfo, ipAddress);

        return {
            success: true,
            message: "Google authentication successful",
            data: {
                user: this.sanitizeUser(user),
                tokens
            }
        };
    }

    // ============== CHANGE PASSWORD ==============

    async changePassword(userId: number, data: ChangePasswordRequest): Promise<{ success: boolean; message: string }> {
        const { currentPassword, newPassword } = data;

        // Validate new password using external validator
        validatePassword(newPassword);

        // Find user
        const user = await this.userRepository.findOne({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isCurrentPasswordValid) {
            throw new UnauthorizedError("Current password is incorrect");
        }

        // Update password
        user.password_hash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
        await this.userRepository.save(user);

        return {
            success: true,
            message: "Password changed successfully"
        };
    }

    // ============== REFRESH TOKEN ==============

    async refreshTokens(data: RefreshTokenRequest, deviceInfo?: string, ipAddress?: string): Promise<AuthResponse> {
        const { refreshToken } = data;

        // Verify refresh token
        let payload: JwtPayload;
        try {
            payload = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as JwtPayload;
        } catch (error) {
            throw new UnauthorizedError("Invalid refresh token");
        }

        if (payload.type !== "refresh") {
            throw new UnauthorizedError("Invalid token type");
        }

        // Check if token exists and is not revoked
        const tokenRecord = await this.refreshTokenRepository.findOne({
            where: {
                token: refreshToken,
                is_revoked: false
            }
        });

        if (!tokenRecord) {
            throw new UnauthorizedError("Refresh token has been revoked or expired");
        }

        // Check if token is expired
        if (new Date() > tokenRecord.expires_at) {
            throw new UnauthorizedError("Refresh token has expired");
        }

        // Find user
        const user = await this.userRepository.findOne({
            where: { id: payload.userId }
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Revoke old refresh token
        tokenRecord.is_revoked = true;
        await this.refreshTokenRepository.save(tokenRecord);

        // Generate new token pair
        const tokens = await this.generateTokenPair(user, deviceInfo, ipAddress);

        return {
            success: true,
            message: "Tokens refreshed successfully",
            data: {
                user: this.sanitizeUser(user),
                tokens
            }
        };
    }

    // ============== LOGOUT ==============

    async logout(refreshToken: string): Promise<{ success: boolean; message: string }> {
        // Revoke the refresh token
        await this.refreshTokenRepository.update(
            { token: refreshToken },
            { is_revoked: true }
        );

        return {
            success: true,
            message: "Logged out successfully"
        };
    }

    // ============== LOGOUT ALL DEVICES ==============

    async logoutAllDevices(userId: number): Promise<{ success: boolean; message: string }> {
        // Revoke all refresh tokens for the user
        await this.refreshTokenRepository.update(
            { user_id: userId, is_revoked: false },
            { is_revoked: true }
        );

        return {
            success: true,
            message: "Logged out from all devices successfully"
        };
    }

    // ============== GET CURRENT USER ==============

    async getCurrentUser(userId: number): Promise<UserResponse> {
        const user = await this.userRepository.findOne({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        return this.sanitizeUser(user);
    }

    // ============== VERIFY ACCESS TOKEN ==============

    verifyAccessToken(token: string): JwtPayload {
        try {
            const payload = jwt.verify(token, this.JWT_SECRET) as JwtPayload;
            if (payload.type !== "access") {
                throw new UnauthorizedError("Invalid token type");
            }
            return payload;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new UnauthorizedError("Access token has expired");
            }
            throw new UnauthorizedError("Invalid access token");
        }
    }

    // ============== PRIVATE HELPER METHODS ==============

    private async generateTokenPair(user: User, deviceInfo?: string, ipAddress?: string): Promise<TokenPair> {
        // Sellers get 30-day access tokens with no refresh token logic
        const SELLER_ACCESS_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds
        const isSeller = user.role === "seller";

        const accessTokenExpiry = isSeller ? SELLER_ACCESS_TOKEN_EXPIRY : this.ACCESS_TOKEN_EXPIRY;

        const accessTokenPayload: JwtPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            type: "access"
        };

        const refreshTokenPayload: JwtPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            type: "refresh"
        };

        const accessToken = jwt.sign(accessTokenPayload, this.JWT_SECRET, {
            expiresIn: accessTokenExpiry
        });

        // For sellers, still generate a refresh token (for API compatibility) but don't store it
        // For buyers, store refresh token as usual
        const refreshToken = jwt.sign(refreshTokenPayload, this.JWT_REFRESH_SECRET, {
            expiresIn: this.REFRESH_TOKEN_EXPIRY
        });

        // Only save refresh token to database for non-sellers (buyers)
        if (!isSeller) {
            const refreshExpiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY * 1000);
            const refreshTokenRecord = this.refreshTokenRepository.create({
                user_id: user.id,
                token: refreshToken,
                expires_at: refreshExpiresAt,
                is_revoked: false,
                device_info: deviceInfo,
                ip_address: ipAddress
            });
            await this.refreshTokenRepository.save(refreshTokenRecord);
        }

        return {
            accessToken,
            refreshToken,
            expiresIn: accessTokenExpiry
        };
    }

    private async verifyGoogleToken(idToken: string): Promise<GoogleUserInfo | null> {
        try {
            // Use Firebase Admin to verify the token
            const { verifyFirebaseToken } = await import("./firebase-admin.service");
            const decodedToken = await verifyFirebaseToken(idToken);

            if (!decodedToken) return null;

            return {
                sub: decodedToken.uid,
                email: decodedToken.email || "",
                email_verified: decodedToken.email_verified || false,
                name: decodedToken.name || "",
                given_name: decodedToken.name?.split(" ")[0],
                family_name: decodedToken.name?.split(" ").slice(1).join(" "),
                picture: decodedToken.picture
            };
        } catch (error) {
            console.error("Firebase token verification failed:", error);
            return null;
        }
    }

    private sanitizeUser(user: User): UserResponse {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            created_at: user.created_at
        };
    }
}

// Export singleton instance
export const authService = new AuthService();
