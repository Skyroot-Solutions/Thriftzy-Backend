import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from src directory
dotenv.config({ path: path.join(__dirname, ".env") });

import { AppDataSource } from "./db/data-source";
import app from "./app";
import { initializeFirebaseAdmin } from "./modules/auth/firebase-admin.service";

const PORT = parseInt(process.env.PORT || "8000", 10);

(async () => {
    try {
        await AppDataSource.initialize();
        console.log("Database connected");

        // Initialize Firebase Admin
        initializeFirebaseAdmin();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.log(process.env.POSTGRES_PORT)
        console.log(process.env.POSTGRES_USER)
        console.log(process.env.POSTGRES_PASSWORD)
        console.log(process.env.POSTGRES_DB)
        console.log(process.env.POSTGRES_HOST)
        console.error("Failed to start server:", error);
        process.exit(1);
    }
})();