// ============================================
// IMAGE COMPRESSION UTILITY
// Compress and optimize photos for mobile upload
// ============================================

export interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    outputFormat?: 'jpeg' | 'png' | 'webp';
}

const DEFAULT_OPTIONS: CompressionOptions = {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8,
    outputFormat: 'jpeg'
};

/**
 * Compress an image file
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;

                    // Calculate new dimensions
                    if (width > (opts.maxWidth || 800) || height > (opts.maxHeight || 800)) {
                        const ratio = Math.min(
                            (opts.maxWidth || 800) / width,
                            (opts.maxHeight || 800) / height
                        );
                        width = width * ratio;
                        height = height * ratio;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    // Draw image on canvas
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to base64
                    const mimeType = `image/${opts.outputFormat}`;
                    const base64 = canvas.toDataURL(mimeType, opts.quality);

                    resolve(base64);
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = e.target?.result as string;
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Compress multiple images
 */
export async function compressImages(
    files: File[],
    options: CompressionOptions = {}
): Promise<string[]> {
    const promises = files.map(file => compressImage(file, options));
    return Promise.all(promises);
}

/**
 * Get image size from base64
 */
export function getImageSize(base64: string): number {
    // Remove data URL prefix
    const base64String = base64.split(',')[1] || base64;

    // Calculate size in bytes
    const padding = base64String.endsWith('==') ? 2 : base64String.endsWith('=') ? 1 : 0;
    return (base64String.length * 3) / 4 - padding;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Capture photo from camera
 */
export async function capturePhoto(options: CompressionOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Use rear camera on mobile

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) {
                reject(new Error('No file selected'));
                return;
            }

            try {
                const compressed = await compressImage(file, options);
                resolve(compressed);
            } catch (error) {
                reject(error);
            }
        };

        input.click();
    });
}

/**
 * Create thumbnail from base64 image
 */
export async function createThumbnail(base64: string, size: number = 150): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // Calculate crop dimensions to maintain aspect ratio
            const scale = Math.max(size / img.width, size / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (size - scaledWidth) / 2;
            const y = (size - scaledHeight) / 2;

            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

            const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
            resolve(thumbnail);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = base64;
    });
}

export default {
    compressImage,
    compressImages,
    getImageSize,
    formatFileSize,
    capturePhoto,
    createThumbnail
};
