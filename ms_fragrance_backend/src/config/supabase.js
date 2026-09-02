require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
let client;

function getSupabase() {
    if (client) return client;
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase Storage is not configured');
    }
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return client;
}

function getPublicImageUrl(objectPath) {
    const supabase = getSupabase();
    return supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

function getStoragePath(imageUrl) {
    if (!imageUrl || !process.env.SUPABASE_URL) return null;
    try {
        const url = new URL(imageUrl);
        const prefix = `/storage/v1/object/public/${bucket}/`;
        if (!url.pathname.startsWith(prefix)) return null;
        return decodeURIComponent(url.pathname.slice(prefix.length));
    } catch {
        return null;
    }
}

async function uploadProductImage(file, objectPath) {
    const { data, error } = await getSupabase().storage.from(bucket).upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '31536000',
        upsert: false,
    });
    if (error) throw new Error('Storage upload failed');
    return { path: data.path, url: getPublicImageUrl(data.path) };
}

async function removeProductImage(imageUrl) {
    const storagePath = getStoragePath(imageUrl);
    if (!storagePath) return false;
    const { error } = await getSupabase().storage.from(bucket).remove([storagePath]);
    if (error) throw new Error('Storage deletion failed');
    return true;
}

module.exports = { bucket, getSupabase, uploadProductImage, removeProductImage, getStoragePath };
