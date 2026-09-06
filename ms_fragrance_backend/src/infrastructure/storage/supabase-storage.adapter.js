const { createClient } = require('@supabase/supabase-js');
const { config } = require('../../config/env');

const { bucket, url, serviceRoleKey } = config.storage;
let client;

function getSupabase() {
    if (client) return client;
    if (!url || !serviceRoleKey) throw new Error('Supabase Storage is not configured');
    client = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return client;
}

function getPublicImageUrl(objectPath) {
    return getSupabase().storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

function getStoragePath(imageUrl) {
    if (!imageUrl || !url) return null;
    try {
        const image = new URL(imageUrl);
        const prefix = `/storage/v1/object/public/${bucket}/`;
        if (!image.pathname.startsWith(prefix)) return null;
        return decodeURIComponent(image.pathname.slice(prefix.length));
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
