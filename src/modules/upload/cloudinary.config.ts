// Cloudinary Configuration - Using unsigned uploads (no API keys required)

export const CLOUDINARY_CONFIG = {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "dopxmg0za",
    UPLOAD_PRESET: process.env.CLOUDINARY_UPLOAD_PRESET || "thrift",
};

// Cloudinary upload URL for unsigned uploads
export const getCloudinaryUploadUrl = () => {
    return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`;
};
