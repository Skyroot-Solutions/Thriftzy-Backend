import { Request, Response } from "express";
import { uploadService } from "./upload.service";

export class UploadController {
    /**
     * POST /upload
     * Upload a single image
     */
    async uploadSingle(req: Request, res: Response): Promise<void> {
        try {
            if (!req.file) {
                res.status(400).json({ success: false, message: "No file provided" });
                return;
            }

            const folder = (req.body.folder as string) || "thriftzy";
            const result = await uploadService.uploadImage(
                req.file.buffer,
                req.file.originalname,
                folder
            );

            res.status(200).json({
                success: true,
                message: "File uploaded successfully",
                data: result,
            });
        } catch (error) {
            console.error("Upload error:", error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : "Upload failed",
            });
        }
    }

    /**
     * POST /upload/multiple
     * Upload multiple images (up to 5)
     */
    async uploadMultiple(req: Request, res: Response): Promise<void> {
        try {
            const files = req.files as Express.Multer.File[];
            if (!files || files.length === 0) {
                res.status(400).json({ success: false, message: "No files provided" });
                return;
            }

            const folder = (req.body.folder as string) || "thriftzy";
            const fileData = files.map(file => ({
                buffer: file.buffer,
                originalname: file.originalname,
            }));
            const results = await uploadService.uploadMultipleImages(fileData, folder);

            res.status(200).json({
                success: true,
                message: `${results.length} files uploaded successfully`,
                data: results,
            });
        } catch (error) {
            console.error("Upload error:", error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : "Upload failed",
            });
        }
    }
}

export const uploadController = new UploadController();
