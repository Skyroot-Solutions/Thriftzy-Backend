import * as admin from "firebase-admin";

/**
 * Firebase Admin SDK Service
 * Used for verifying Firebase ID tokens from the frontend
 */

let firebaseAdmin: admin.app.App | null = null;

export const initializeFirebaseAdmin = (): void => {
    if (firebaseAdmin) {
        return; // Already initialized
    }

    try {
        const projectId = process.env.FIREBASE_PROJECT_ID || "fynde-a0a77";
        firebaseAdmin = admin.initializeApp({
            projectId: projectId,
        });

        console.log("Firebase Admin initialized successfully");
    } catch (error) {
        console.error("Firebase Admin initialization error:", error);
        // Don't throw - allow app to continue, just log the error
    }
};

export const verifyFirebaseToken = async (idToken: string): Promise<admin.auth.DecodedIdToken> => {
    if (!firebaseAdmin) {
        initializeFirebaseAdmin();
    }

    if (!firebaseAdmin) {
        throw new Error("Firebase Admin is not initialized");
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        console.error("Firebase token verification error:", error);
        throw new Error("Invalid Firebase token");
    }
};

export const getFirebaseAdmin = (): admin.app.App | null => {
    return firebaseAdmin;
};
