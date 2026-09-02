require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, closeDb } = require('./src/db');
const { uploadProductImage, getStoragePath } = require('./src/config/supabase');

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'));
const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function localFileForUrl(imageUrl) {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) return null;
    const relativePath = imageUrl.replace(/^\/uploads\//, '');
    const filePath = path.resolve(uploadRoot, relativePath);
    return filePath.startsWith(uploadRoot) ? filePath : null;
}

async function migrateImages() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase Storage is not configured');
    const result = await query('SELECT id, image_url FROM products ORDER BY id ASC');
    const summary = { uploaded: 0, skipped: 0, missing: 0, failed: 0 };

    for (const product of result.rows) {
        if (getStoragePath(product.image_url)) { summary.skipped++; continue; }
        const filePath = localFileForUrl(product.image_url);
        if (!filePath) { summary.skipped++; continue; }
        if (!fs.existsSync(filePath)) { summary.missing++; continue; }
        try {
            const extension = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[extension];
            if (!contentType) { summary.skipped++; continue; }
            const file = { buffer: fs.readFileSync(filePath), mimetype: contentType };
            const uploaded = await uploadProductImage(file, `products/product-${product.id}/image-${Date.now()}${extension}`);
            await query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [uploaded.url, product.id]);
            summary.uploaded++;
        } catch (error) {
            summary.failed++;
            console.error(`Image migration failed for product ${product.id}`);
        }
    }

    console.log(JSON.stringify(summary, null, 2));
    console.log('Original local files were not deleted.');
    await closeDb();
}

migrateImages().catch(async error => {
    console.error(`Image migration failed: ${error.message}`);
    try { await closeDb(); } catch {}
    process.exitCode = 1;
});
