import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toFile } from 'openai';

import AppError from '../../core/errors/AppError.js';
import { logger } from '../logging/logger.js';

// Master bottle reference image.
//
// Every AI-generated product image must reuse the same MS Fragrance bottle.
// This module loads that single master image from disk and hands it to the
// image API as a real reference input (see ProductAiService).
//
// Resolution order:
//   1. MASTER_PRODUCT_IMAGE_PATH env var (absolute, or relative to the module
//      dir when not absolute) — for deployments that store the asset elsewhere.
//   2. The bundled asset src/assets/ms-fragrance-master.png, resolved RELATIVE
//      TO THIS MODULE (never process.cwd()) so it works on Vercel serverless
//      functions where the bundle is included but the working directory is not.
//
// The filesystem path is internal only and is never returned to the client.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_IMAGE_FILENAME = 'ms-fragrance-master.png';

// src/shared/ai/  ->  ../../assets/  =  src/assets/
const DEFAULT_MASTER_IMAGE_PATH = path.join(__dirname, '../../assets', MASTER_IMAGE_FILENAME);

/**
 * Resolve the on-disk path of the master bottle image.
 * Honors the MASTER_PRODUCT_IMAGE_PATH override, otherwise the bundled asset.
 * @returns {string} absolute filesystem path
 */
function resolveMasterImagePath() {
    const configured = process.env.MASTER_PRODUCT_IMAGE_PATH;
    if (configured && configured.trim()) {
        const trimmed = configured.trim();
        return path.isAbsolute(trimmed) ? trimmed : path.resolve(__dirname, trimmed);
    }
    return DEFAULT_MASTER_IMAGE_PATH;
}

/**
 * Read the master bottle image and convert it into a File suitable for the
 * OpenAI SDK's image-edit API.
 *
 * @returns {Promise<{ file: File, buffer: Buffer }>} the reference File and its raw bytes
 * @throws {AppError} 503 MASTER_IMAGE_MISSING / MASTER_IMAGE_INVALID when the
 *   file is absent, empty or unreadable.
 */
async function loadMasterProductImage() {
    const imagePath = resolveMasterImagePath();

    let buffer;
    try {
        buffer = await fs.promises.readFile(imagePath);
    } catch (error) {
        // Log the cause without leaking the path or any secret values.
        logger.error('[MASTER_IMAGE_READ_ERROR]', { errorMessage: error.message });
        throw new AppError(
            'The master product image is unavailable. Please try again later.',
            503,
            'MASTER_IMAGE_MISSING'
        );
    }

    if (!buffer || buffer.length === 0) {
        throw new AppError(
            'The master product image is invalid. Please try again later.',
            503,
            'MASTER_IMAGE_INVALID'
        );
    }

    const file = await toFile(buffer, MASTER_IMAGE_FILENAME, { type: 'image/png' });
    return { file, buffer };
}

export {
    resolveMasterImagePath,
    loadMasterProductImage,
    DEFAULT_MASTER_IMAGE_PATH,
    MASTER_IMAGE_FILENAME,
};
