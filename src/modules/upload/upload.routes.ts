import { Router } from "express";
import multer from "multer";
import { uploadController } from "./upload.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();

// Configure multer for memory storage (files stored in buffer)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit per file
        files: 5, // Max 5 files at once
    },
    fileFilter: (req, file, cb) => {
        // Accept only images
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    },
});

// POST /upload - Single file upload (requires auth)
router.post("/", authenticate, upload.single("file"), (req, res) => {
    uploadController.uploadSingle(req, res);
});

// POST /upload/multiple - Multiple files upload (requires auth)
router.post("/multiple", authenticate, upload.array("files", 5), (req, res) => {
    uploadController.uploadMultiple(req, res);
});

export default router;
