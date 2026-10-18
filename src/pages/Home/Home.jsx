import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PageLoader from '../../components/PageLoader/PageLoader';
import ProductCard from '../../components/ProductCard/ProductCard';
import { useProducts } from '../../context/ProductContext';
import './Home.css';

const heroSlides = [
    {
        eyebrow: 'THE ART OF FRAGRANCE',
        headline: 'Timeless attars, rooted in tradition.',
        description: 'Pure Indian perfumery for evenings, rituals and everyday wear.',
        cta: 'Explore Collection',
        secondary: 'Shop Attars',
        image: '/hero-1.webp',
        target: '/shop'
    },
    {
        eyebrow: 'SIGNATURE SCENTS',
        headline: 'Rose, musk and sandalwood in every drop.',
        description: 'Warm, intimate fragrances inspired by Indian gardens and sacred evenings.',
        cta: 'Browse Bestsellers',
        secondary: 'Shop Attars',
        image: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?q=80&w=1600&auto=format&fit=crop',
        target: '/shop'
    },
    {
        eyebrow: 'CRAFTED WITH CARE',
        headline: 'Fragrance that lingers beautifully.',
        description: 'Non-alcoholic attars blended to feel soft, elegant and personal.',
        cta: 'Discover More',
        secondary: 'Explore Collections',
        image: 'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?q=80&w=1600&auto=format&fit=crop',
        target: '/shop'
    }
];

const Home = () => {
    const { products, loading, error } = useProducts();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mediaQuery.matches || isPaused) {
            return undefined;
        }

        const timer = window.setTimeout(() => {
            setCurrentSlide(prev => (prev + 1) % heroSlides.length);
        }, 6000);

        return () => window.clearTimeout(timer);
    }, [currentSlide, isPaused]);

    const categories = useMemo(() => {
        const uniqueCategories = [...new Set(products.map(product => product.fragranceType))];
        return uniqueCategories.slice(0, 6);
    }, [products]);

    const featuredProducts = useMemo(() => {
        return [...products]
            .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.isNew) - Number(a.isNew) || b.reviews - a.reviews)
            .slice(0, 4);
    }, [products]);

    const handleSlideChange = (direction) => {
        setCurrentSlide(prev => {
            if (direction === 'next') {
                return (prev + 1) % heroSlides.length;
            }
            return (prev - 1 + heroSlides.length) % heroSlides.length;
        });
    };

    if (loading) {
        return (
            <main className="home-page">
                <PageLoader />
            </main>
        );
    }

    if (error) {
        return (
            <main className="home-page">
                <section className="home-section container" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 300, marginBottom: '16px', color: 'var(--text-color)' }}>{error}</h2>
                </section>
            </main>
        );
    }

    return (
        <main className="home-page">
            <section
                className="home-hero"
                aria-label="Featured fragrance highlights"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
            >
                <div className="hero-slider">
                    {heroSlides.map((slide, index) => (
                        <div
                            key={slide.headline}
                            className={`hero-slide ${index === currentSlide ? 'active' : ''}`}
                            aria-hidden={index !== currentSlide}
                        >
                            <img
                                src={slide.image}
                                alt={slide.headline}
                                className="hero-slide-image"
                                style={{ objectPosition: index === 0 ? 'center center' : index === 1 ? 'center center' : 'center center' }}
                                loading={index === 0 ? 'eager' : 'lazy'}
                                fetchPriority={index === 0 ? 'high' : undefined}
                                decoding="async"
                            />
                            <div className="container hero-inner">
                                <div className="hero-content">
                                    <span className="eyebrow">{slide.eyebrow}</span>
                                    <h1>{slide.headline}</h1>
                                    {/* <p>{slide.description}</p> */}

                                    <div className="hero-actions">
                                        {/* <Link to={slide.target} className="btn btn-primary hero-primary">{slide.cta}</Link> */}
                                        {/* <Link to="/shop?collection=Floral" className="btn btn-outline hero-secondary">{slide.secondary}</Link> */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {/* 
                <div className="container hero-controls" aria-label="Hero controls">
                    <button
                        type="button"
                        className="hero-arrow"
                        onClick={() => handleSlideChange('prev')}
                        aria-label="Previous slide"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="hero-dots" role="tablist" aria-label="Choose a slide">
                        {heroSlides.map((slide, index) => (
                            <button
                                key={`${slide.headline}-dot`}
                                type="button"
                                className={`hero-dot ${index === currentSlide ? 'active' : ''}`}
                                onClick={() => setCurrentSlide(index)}
                                aria-label={`Show slide ${index + 1}`}
                                aria-pressed={index === currentSlide}
                            />
                        ))}
                    </div>

                    <button
                        type="button"
                        className="hero-arrow"
                        onClick={() => handleSlideChange('next')}
                        aria-label="Next slide"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div> */}
            </section>

            <section className="home-section container">
                <div className="section-header">
                    <div>
                        <span className="eyebrow section-eyebrow">Shop by Fragrance</span>
                        <h2>Explore fragrances that feel like home.</h2>
                    </div>
                    <Link to="/shop" className="section-link">Browse all</Link>
                </div>

                <div className="category-grid">
                    {categories.map(category => {
                        const categoryProduct = products.find(product => product.fragranceType === category) || products[0];

                        return (
                            <Link
                                key={category}
                                to={`/shop?collection=${encodeURIComponent(category)}`}
                                className="category-card"
                            >
                                <img src={categoryProduct.imageUrl} alt={category} loading="lazy" decoding="async" />
                                <div className="category-card-overlay">
                                    <span>Collection</span>
                                    <h3>{category}</h3>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>

            <section className="home-section container featured-section">
                <div className="section-header">
                    <div>
                        <span className="eyebrow section-eyebrow">Featured Fragrances</span>
                        <h2>Our most-loved attars.</h2>
                    </div>
                </div>

                <div className="featured-grid">
                    {featuredProducts.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>

                <div className="section-action">
                    <Link to="/shop" className="btn btn-outline">View All Fragrances</Link>
                </div>
            </section>

            {/* <section className="home-story container">
                <div className="story-visual">
                    <img
                        src="https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=1200&q=80"
                        alt="Fragrance bottles and ingredients"
                    />
                </div>

                <div className="story-copy">
                    <span className="eyebrow section-eyebrow">Our Story</span>
                    <h2>Traditional craft, softened for modern living.</h2>
                    <p>
                        MS Fragrance brings together the richness of classic Indian perfumery with an effortless contemporary feel.
                        Every scent is thoughtfully composed to feel warm, natural and deeply personal — designed to linger in the memory long after the day is over.
                    </p>
                    <Link to="/about" className="btn btn-outline">Discover Our Story</Link>
                </div>
            </section> */}

            <section className="home-cta container">
                <div>
                    <span className="eyebrow section-eyebrow">Find your signature</span>
                    <h2>Find a fragrance that feels like you.</h2>
                    <p>Warm, fresh, floral or woody — discover an attar that settles softly and stays beautifully with you.</p>
                </div>

                <Link to="/shop" className="btn btn-primary">Explore the Collection</Link>
            </section>
        </main>
    );
};

export default Home;
