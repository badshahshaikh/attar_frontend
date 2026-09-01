/**
 * seed.js — Import mockProducts.js data into SQLite database
 *
 * Usage: node seed.js
 * This script safely imports products from the frontend mockProducts file
 * into the backend SQLite database, avoiding duplicates.
 */

const { getDb } = require('./src/db');

// Import mockProducts from frontend
const mockProducts = require('../src/data/mockProducts.js').mockProducts;

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seed...');
        const db = await getDb();

        let inserted = 0;
        let skipped = 0;

        for (const product of mockProducts) {
            // Check if product already exists by name
            const existing = await db.get(
                'SELECT id FROM products WHERE name = ?',
                product.name
            );

            if (existing) {
                console.log(`⏭️  Skipped: "${product.name}" (already exists)`);
                skipped++;
                continue;
            }

            // Insert product
            await db.run(`
                INSERT INTO products
                  (name, category, fragrance_type, description, full_description,
                   rating, reviews, price, original_price, size_pricing, sizes,
                   top_notes, heart_notes, base_notes, longevity,
                   in_stock, is_new, brand, is_best_seller, is_exclusive, image_url)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `, [
                product.name,
                product.category || 'Attar',
                product.fragranceType || null,
                product.description || null,
                product.fullDescription || null,
                product.rating || 0,
                product.reviews || 0,
                product.price,
                product.originalPrice || null,
                JSON.stringify(product.sizePricing || {}),
                JSON.stringify(product.sizes || []),
                JSON.stringify(product.topNotes || []),
                JSON.stringify(product.heartNotes || []),
                JSON.stringify(product.baseNotes || []),
                product.longevity || null,
                product.inStock !== undefined ? (product.inStock ? 1 : 0) : 1,
                product.isNew !== undefined ? (product.isNew ? 1 : 0) : 0,
                product.brand || null,
                product.isBestSeller !== undefined ? (product.isBestSeller ? 1 : 0) : 0,
                product.isExclusive !== undefined ? (product.isExclusive ? 1 : 0) : 0,
                product.imageUrl || null,
            ]);

            console.log(`✅ Inserted: "${product.name}"`);
            inserted++;
        }

        console.log('\n📊 Seed Summary:');
        console.log(`   ✅ Inserted: ${inserted} products`);
        console.log(`   ⏭️  Skipped: ${skipped} products`);
        console.log(`   📦 Total: ${mockProducts.length} products`);
        console.log('\n✨ Database seed complete!');

    } catch (err) {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    }
}

seedDatabase();
