import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from src directory
dotenv.config({ path: path.join(__dirname, ".env") });

import { AppDataSource } from "./db/data-source";
import app from "./app";
import { initializeFirebaseAdmin } from "./modules/auth/firebase-admin.service";

const PORT = parseInt(process.env.PORT || "8000", 10);

/**
 * Retry database connection with exponential backoff
 */
async function connectWithRetry(
    dataSource: typeof AppDataSource,
    maxRetries: number = 5,
    initialDelay: number = 2000
): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting to connect to database (attempt ${attempt}/${maxRetries})...`);
            console.log(`Host: ${process.env.POSTGRES_HOST || "localhost"}`);
            console.log(`Port: ${process.env.POSTGRES_PORT || "5432"}`);
            console.log(`Database: ${process.env.POSTGRES_DB || "thriftzy-dev"}`);
            console.log(`User: ${process.env.POSTGRES_USER || "postgres"}`);

            await dataSource.initialize();
            console.log("✅ Database connected successfully!");
            return;
        } catch (error) {
            lastError = error as Error;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            console.error(`❌ Database connection attempt ${attempt} failed:`, errorMessage);

            if (attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error("\n❌ All database connection attempts failed!");
                console.error("\nConnection Details:");
                console.error(`  Host: ${process.env.POSTGRES_HOST || "localhost"}`);
                console.error(`  Port: ${process.env.POSTGRES_PORT || "5432"}`);
                console.error(`  Database: ${process.env.POSTGRES_DB || "thriftzy-dev"}`);
                console.error(`  User: ${process.env.POSTGRES_USER || "postgres"}`);
                console.error(`  SSL: ${process.env.POSTGRES_HOST?.includes("supabase") ? "Enabled" : "Disabled"}`);
                
                if (errorMessage.includes("timeout")) {
                    console.error("\n💡 Troubleshooting tips:");
                    console.error("  - Check if your Supabase project is active (not paused)");
                    console.error("  - Verify your network connection");
                    console.error("  - Check firewall settings");
                    console.error("  - Verify database credentials in .env file");
                    console.error("  - Try increasing connectionTimeoutMillis in data-source.ts");
                } else if (errorMessage.includes("password") || errorMessage.includes("authentication")) {
                    console.error("\n💡 Troubleshooting tips:");
                    console.error("  - Verify POSTGRES_PASSWORD in .env file");
                    console.error("  - Check if the database user has correct permissions");
                } else if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
                    console.error("\n💡 Troubleshooting tips:");
                    console.error("  - Verify POSTGRES_HOST is correct");
                    console.error("  - Check your internet connection");
                    console.error("  - Verify DNS resolution");
                }
            }
        }
    }

    throw lastError || new Error("Database connection failed after all retries");
}

(async () => {
    try {
        // Connect to database with retry logic
        await connectWithRetry(AppDataSource);

        // Initialize Firebase Admin
        initializeFirebaseAdmin();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("\n💥 Failed to start server:", error);
        process.exit(1);
    }
})();