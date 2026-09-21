/**
 * seed.js — Import mockProducts.js data into SQLite database
 *
 * Usage: node seed.js
 * This script safely imports products from the frontend mockProducts file
 * into the backend SQLite database, avoiding duplicates.
 */

import { getDb } from './src/db.js';

// Import mockProducts from frontend
import mockProducts from '../src/data/mockProducts.js';.mockProducts;

const navigationProducts = [
    ['Royal Oud Reserve', 'Surrati', 'Oud', 899, ['Saffron', 'Bergamot'], ['Oud', 'Rose'], ['Amber', 'Leather']],
    ['Oud Al Zahra', 'Al Haramain', 'Oud', 1299, ['Cardamom', 'Plum'], ['Cambodian Oud', 'Jasmine'], ['Patchouli', 'Amber']],
    ['Musk Tahara', 'Nemat', 'Musk', 549, ['Cotton', 'White Flowers'], ['Clean Musk', 'Iris'], ['Vanilla', 'Soft Woods']],
    ['Musk Al Noor', 'Swiss Arabian', 'Musk', 749, ['Pear', 'Bergamot'], ['Rose', 'Musk'], ['Sandalwood', 'Tonka']],
    ['Golden Amber', 'Anfar', 'Amber', 699, ['Orange', 'Cinnamon'], ['Amber', 'Honey'], ['Benzoin', 'Vanilla']],
    ['Amber Saffron', 'Inspire Fragrances', 'Amber', 999, ['Saffron', 'Pepper'], ['Amberwood', 'Rose'], ['Musk', 'Cedar']],
    ['Shamama Heritage', 'SMD Ayyub MD Yaqub', 'Shamama', 799, ['Herbs', 'Green Tea'], ['Rose', 'Spices'], ['Sandalwood', 'Musk']],
    ['Shamama Royale', 'SH Kelkar', 'Shamama', 1099, ['Clove', 'Cypress'], ['Floral Spices', 'Leather'], ['Amber', 'Oud']],
    ['Gulab Noor', 'MS Fragrance Exclusive', 'Floral', 649, ['Damask Rose', 'Lemon'], ['Rose', 'Peony'], ['Musk', 'Sandalwood']],
    ['Jasmine Royale', 'Surrati', 'Floral', 599, ['Green Leaves', 'Neroli'], ['Jasmine', 'Tuberose'], ['Musk', 'Cedar']],
    ['French Lavender', 'Inspire Fragrances', 'French', 749, ['Lavender', 'Bergamot'], ['Violet', 'Clary Sage'], ['Musk', 'Amber']],
    ['French Oud Noir', 'Al Haramain', 'French', 1199, ['Mandarin', 'Pepper'], ['Oud', 'Rose'], ['Vanilla', 'Patchouli']],
    ['Khas Green', 'Anfar', 'Khas', 499, ['Vetiver', 'Mint'], ['Khus', 'Green Notes'], ['Earth', 'Musk']],
    ['Khas Sultan', 'Nemat', 'Khas', 799, ['Lemon', 'Herbs'], ['Vetiver', 'Sandalwood'], ['Amber', 'Musk']],
    ['Dehn Al Oud Maliki', 'Swiss Arabian', 'Dehn Al Oud', 1499, ['Agarwood', 'Saffron'], ['Oud', 'Rose'], ['Amber', 'Leather']],
    ['Dehn Al Oud Safi', 'MS Fragrance Exclusive', 'Dehn Al Oud', 1799, ['Raspberry', 'Oud'], ['Oud', 'Jasmine'], ['Sandalwood', 'Musk']],
];

const additionalProducts = navigationProducts.map(([name, brand, fragranceType, price, topNotes, heartNotes, baseNotes], index) => ({
    name, brand, fragranceType, category: 'Attar', price,
    originalPrice: price + 150,
    description: `${name} is a thoughtfully blended ${fragranceType.toLowerCase()} attar with a distinctive, lasting character.`,
    fullDescription: `A considered blend of ${topNotes.join(', ')}, ${heartNotes.join(', ')} and ${baseNotes.join(', ')} for a polished fragrance experience.`,
    rating: 4.3 + (index % 6) / 10, reviews: 32 + index * 9,
    sizes: ['3ml', '6ml', '12ml'], sizePricing: { '3ml': price, '6ml': price + 180, '12ml': price + 500 },
    topNotes, heartNotes, baseNotes, longevity: '7-9 Hours', inStock: true,
    isNew: index % 4 === 0, isBestSeller: index % 3 === 0,
    isExclusive: brand === 'MS Fragrance Exclusive', featured: index < 4,
    imageUrl: `https://images.unsplash.com/photo-${['1594035910387-fea47794261f', '1588405748880-12d1d2a59f75', '1629198688000-71f23e745b6e'][index % 3]}?q=80&w=800&auto=format&fit=crop`,
}));

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seed...');
        const db = await getDb();

        let inserted = 0;
        let skipped = 0;

        for (const product of [...mockProducts, ...additionalProducts]) {
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
                         in_stock, is_new, brand, is_best_seller, is_exclusive, featured, stock_quantity, slug, image_url)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
                product.featured !== undefined ? (product.featured ? 1 : 0) : 0,
                product.stockQuantity || 10,
                product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
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
