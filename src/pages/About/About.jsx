import React from 'react';
import './About.css';

const About = () => {
    return (
        <main className="about-page container">
            <div className="about-hero">
                <div className="about-hero-content">
                    <h1>The Art of Pure Perfumery</h1>
                    <p className="subtitle">Discover the heritage and craftsmanship behind every drop.</p>
                </div>
            </div>

            <section className="about-content-section">
                <div className="about-text-block">
                    <h2>Our Heritage</h2>
                    <p>Rooted in centuries of tradition, RoohAttars brings the timeless art of pure, non-alcoholic perfumery to the modern connoisseur. We believe that true luxury lies in nature's finest ingredients, meticulously distilled and aged to perfection.</p>
                </div>
                <div className="about-text-block">
                    <h2>Our Philosophy</h2>
                    <p>We craft intimate scent experiences. Unlike commercial perfumes that evaporate quickly, our premium attars melt into your skin, evolving throughout the day to create a signature aura that is uniquely yours. No alcohol, no harsh synthetics—just the pure soul (Rooh) of the fragrance.</p>
                </div>
                <div className="about-text-block">
                    <h2>Craftsmanship</h2>
                    <p>From the rare Ouds of Assam to the delicate Taif roses, we source only the most exceptional raw materials. Every bottle represents countless hours of patient distillation, careful blending, and respectful maturation.</p>
                </div>
            </section>
        </main>
    );
};

export default About;
