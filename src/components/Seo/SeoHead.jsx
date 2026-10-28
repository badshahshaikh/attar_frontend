import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSeoMetadata } from '../../hooks/useSeoMetadata';

const NON_INDEXABLE_PREFIXES = ['/cart', '/checkout', '/wishlist', '/account', '/login', '/register', '/admin'];

function isNonIndexable(pathname) {
    return NON_INDEXABLE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function setMeta(name, content, attr = 'name') {
    if (content === undefined || content === null || content === '') return;
    let el = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

function setLink(rel, href) {
    if (!href) return;
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

function isValidUrl(value) {
    if (!value) return false;
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

function canonicalFor(pathname, data) {
    if (data && data.canonical_url && isValidUrl(data.canonical_url)) {
        return data.canonical_url;
    }
    try {
        return new URL(pathname, window.location.origin).href;
    } catch {
        return window.location.origin + pathname;
    }
}

const SeoHead = () => {
    const location = useLocation();
    const pathname = location.pathname;
    const nonIndexable = isNonIndexable(pathname);
    const { data } = useSeoMetadata(nonIndexable ? null : pathname);

    useEffect(() => {
        // Non-indexable pages: mark noindex and clean any stale JSON-LD
        if (nonIndexable) {
            setMeta('robots', 'noindex,nofollow');
            const script = document.getElementById('seo-jsonld');
            if (script) script.remove();
            return;
        }

        if (!data) return;

        if (data.seo_title) document.title = data.seo_title;

        setMeta('description', data.meta_description);
        setMeta('robots', data.robots || 'index,follow');

        const canonical = canonicalFor(pathname, data);
        setLink('canonical', canonical);

        // Open Graph
        setMeta('og:title', data.og_title || data.seo_title, 'property');
        setMeta('og:description', data.og_description || data.meta_description, 'property');
        setMeta('og:image', data.og_image, 'property');
        setMeta('og:url', canonical, 'property');
        setMeta('og:type', 'website', 'property');

        // Twitter
        setMeta('twitter:card', data.twitter_card || 'summary_large_image');
        setMeta('twitter:title', data.twitter_title || data.seo_title);
        setMeta('twitter:description', data.twitter_description || data.meta_description);
        setMeta('twitter:image', data.twitter_image || data.og_image);

        // JSON-LD
        const existing = document.getElementById('seo-jsonld');
        const sd = data.structured_data;
        const hasSd = sd && typeof sd === 'object' && Object.keys(sd).length > 0;
        if (hasSd) {
            let script = existing;
            if (!script) {
                script = document.createElement('script');
                script.type = 'application/ld+json';
                script.id = 'seo-jsonld';
                document.head.appendChild(script);
            }
            script.textContent = JSON.stringify(sd);
        } else if (existing) {
            existing.remove();
        }
    }, [pathname, data, nonIndexable]);

    // Cleanup JSON-LD on unmount
    useEffect(() => {
        return () => {
            const script = document.getElementById('seo-jsonld');
            if (script) script.remove();
        };
    }, []);

    return null;
};

export default SeoHead;