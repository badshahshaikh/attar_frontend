export const mockProducts = [
    {
        id: "p1",
        name: "Royal Oud",
        category: "Attar",
        fragranceType: "Woody & Earthy",
        description: "A rich, majestic blend of pure aged agarwood from Assam, exuding deep earthy and woody notes.",
        fullDescription: "Royal Oud is the epitome of luxury and tradition. Distilled using centuries-old techniques, this attar draws its essence from the finest matured agarwood found deep in the forests of Assam. Upon application, it unveils a complex symphony of earthy, woody, and slightly smoky notes that gradually mellow down to a comforting, warm base. Perfect for evening wear and special occasions, this fragrance commands respect and exudes an aura of noble elegance.",
        rating: 4.9,
        reviews: 128,
        price: 4500, // 3ml price
        sizePricing: {
            "3ml": 4500,
            "6ml": 8500,
            "12ml": 16000
        },
        sizes: ["3ml", "6ml", "12ml"],
        topNotes: ["Saffron", "Spicy Accords"],
        heartNotes: ["Rich Rose", "Smoked Wood"],
        baseNotes: ["Assam Agarwood", "Amber", "Musk"],
        longevity: "12+ Hours (Very Long Lasting)",
        inStock: true,
        isNew: false,
        imageUrl: "https://images.unsplash.com/photo-1594035910387-fea47794261f?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "p2",
        name: "Kashmiri Musk",
        category: "Attar",
        fragranceType: "Musk",
        description: "A soft, enchanting white musk intertwined with subtle floral undertones, representing purity and elegance.",
        fullDescription: "Kashmiri Musk captures the pristine beauty and crisp air of the northern valleys. It is a sublime, white musk fragrance that opens with fresh, airy notes and smoothly transitions into a delicate floral heart. The dry-down is exceptionally clean, soapy, and comforting, making it an ideal signature scent for daily wear. Its understated elegance ensures you leave a memorable, soothing trace wherever you go.",
        rating: 4.7,
        reviews: 85,
        price: 2200,
        sizePricing: {
            "3ml": 2200,
            "6ml": 4200,
            "12ml": 8000
        },
        sizes: ["3ml", "6ml", "12ml"],
        topNotes: ["Aldehydic Notes", "White Violet"],
        heartNotes: ["Jasmine", "Lily of the Valley"],
        baseNotes: ["White Musk", "Cedarwood", "Sandalwood Touch"],
        longevity: "8-10 Hours (Long Lasting)",
        inStock: true,
        isNew: true,
        imageUrl: "https://images.unsplash.com/photo-1590736704728-f4730bb30770?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "p3",
        name: "Rose Ruh",
        category: "Attar",
        fragranceType: "Floral",
        description: "Distilled from the finest Damask roses of Kannauj, offering an incredibly fresh and romantic floral profile.",
        fullDescription: "Rose Ruh, or 'Soul of the Rose', is an intensely pure extraction of freshly harvested Damask roses from Kannauj, India's perfume capital. The traditional hydro-distillation method captures the true, dewy essence of a rose garden at dawn. This single-note masterpiece is vibrant, romantic, and deeply soothing. It can be worn alone as a statement of pure elegance or layered with stronger woody or musky attars to soften them.",
        rating: 4.8,
        reviews: 210,
        price: 3200,
        originalPrice: 3800,
        sizePricing: {
            "3ml": 3200,
            "6ml": 6000
        },
        sizes: ["3ml", "6ml"],
        topNotes: ["Morning Dew", "Fresh Green Leaves"],
        heartNotes: ["Pure Damask Rose", "Geranium"],
        baseNotes: ["Subtle Honey", "Soft Woods"],
        longevity: "6-8 Hours (Moderate/Long Lasting)",
        inStock: true,
        isNew: false,
        imageUrl: "https://images.unsplash.com/photo-1629198688000-71f23e745b6e?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "p4",
        name: "Majestic Amber",
        category: "Attar",
        fragranceType: "Oriental",
        description: "A warm, resinous and slightly sweet amber attar that lingers delicately throughout the evening.",
        fullDescription: "Majestic Amber embodies the glowing warmth of liquid gold. This opulent fragrance is built around a heart of rich, fossilized amber resin, expertly blended with sweet vanilla and slightly smoky labdanum. It is decadently sweet yet perfectly balanced by earthy undertones. As it warms on your skin, it releases an irresistibly sensual aura, making it a spectacular choice for intimate evenings and colder weather.",
        rating: 4.6,
        reviews: 64,
        price: 1800,
        sizePricing: {
            "3ml": 1800,
            "12ml": 6800
        },
        sizes: ["3ml", "12ml"],
        topNotes: ["Bergamot", "Cinnamon Spice"],
        heartNotes: ["Labdanum", "Patchouli"],
        baseNotes: ["Rich Amber", "Madagascar Vanilla", "Tonka Bean"],
        longevity: "10-12 Hours (Very Long Lasting)",
        inStock: false,
        isNew: false,
        imageUrl: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "p5",
        name: "Mysore Sandalwood",
        category: "Attar",
        fragranceType: "Woody",
        description: "Creamy, smooth, and classic pure sandalwood oil with calming properties and timeless appeal.",
        fullDescription: "Revered in sacred rituals and ancient wellness practices, our Mysore Sandalwood attar is a tribute to India's most precious wood. Aging gracefully, this oil presents a creamy, milky, and exceptionally smooth woody profile that calms the mind and elevates the spirit. There are no sharp edges here—only a velvety, comforting embrace that sits close to the skin, providing a serene fragrance experience throughout the day.",
        rating: 4.9,
        reviews: 312,
        price: 5500,
        sizePricing: {
            "3ml": 5500,
            "6ml": 10500,
            "12ml": 20000
        },
        sizes: ["3ml", "6ml", "12ml"],
        topNotes: ["Soft Buttery Notes"],
        heartNotes: ["Creamy Sandalwood"],
        baseNotes: ["Aged Sandalwood Heartwood"],
        longevity: "8-10 Hours (Long Lasting, Intimate Sillage)",
        inStock: true,
        isNew: false,
        imageUrl: "https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "p6",
        name: "Shamama Tul Amber",
        category: "Attar",
        fragranceType: "Spicy & Oriental",
        description: "A complex traditional blend of spices, herbs, and woods, perfect for winters.",
        fullDescription: "Shamama Tul Amber is a masterclass in traditional Indian perfumery art, crafted through a grueling multi-stage distillation process. This complex elixir marries over fifty different herbs, spices, roots, and flowers, all distilled into a rich sandalwood base. The result is a profoundly deep, spicy, medicinal, and earthy aroma that is both deeply grounding and remarkably distinguished. A true connoisseur's fragrance, best cherished in the cool winter months.",
        rating: 4.5,
        reviews: 42,
        price: 2800,
        sizePricing: {
            "6ml": 2800,
            "12ml": 5400
        },
        sizes: ["6ml", "12ml"],
        topNotes: ["Saffron", "Cardamom", "Nutmeg"],
        heartNotes: ["Rose", "Jasmine", "Indian Herbs"],
        baseNotes: ["Sandalwood", "Vetiver", "Amber"],
        longevity: "12+ Hours (Extremely Long Lasting)",
        inStock: true,
        isNew: false,
        imageUrl: "https://images.unsplash.com/photo-1615529182904-14819c35db37?q=80&w=800&auto=format&fit=crop"
    }
];
