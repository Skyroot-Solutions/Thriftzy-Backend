import { CLOUDINARY_CONFIG } from "./cloudinary.config";
import FormData from "form-data";
import axios from "axios";

export interface UploadResult {
    secure_url: string;
    public_id: string;
    format: string;
    width: number;
    height: number;
}

interface CloudinaryResponse {
    secure_url: string;
    public_id: string;
    format: string;
    width: number;
    height: number;
}

export class UploadService {
    /**
     * Upload a file buffer to Cloudinary using unsigned upload
     * @param fileBuffer - The file buffer from multer
     * @param originalName - Original filename
     * @param folder - Optional folder name in Cloudinary
     * @returns Promise with upload result
     */
    async uploadImage(fileBuffer: Buffer, originalName: string, folder: string = "thriftzy"): Promise<UploadResult> {
        const uploadPreset = CLOUDINARY_CONFIG.UPLOAD_PRESET;
        const cloudName = CLOUDINARY_CONFIG.CLOUD_NAME;

        console.log("[Cloudinary] Uploading with preset:", uploadPreset, "cloud:", cloudName);

        const formData = new FormData();
        formData.append("file", fileBuffer, { filename: originalName });
        formData.append("upload_preset", uploadPreset);
        formData.append("folder", folder);

        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

        try {
            const response = await axios.post<CloudinaryResponse>(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
            });

            const result = response.data;

            return {
                secure_url: result.secure_url,
                public_id: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
            };
        } catch (error: any) {
            console.error("[Cloudinary] Upload error:", error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || error.message || "Upload failed");
        }
    }

    /**
     * Upload multiple files to Cloudinary
     * @param files - Array of file objects with buffer and originalname
     * @param folder - Optional folder name
     * @returns Promise with array of upload results
     */
    async uploadMultipleImages(
        files: { buffer: Buffer; originalname: string }[],
        folder: string = "thriftzy"
    ): Promise<UploadResult[]> {
        const uploadPromises = files.map(file =>
            this.uploadImage(file.buffer, file.originalname, folder)
        );
        return Promise.all(uploadPromises);
    }
}

export const uploadService = new UploadService();
