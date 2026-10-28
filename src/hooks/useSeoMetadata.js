import { useState, useEffect } from 'react';
import { getPublicSeo } from '../services/seoService';

const cache = new Map();

export function useSeoMetadata(routePath) {
    const [fetchedRoute, setFetchedRoute] = useState(null);
    const [fetchedData, setFetchedData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Resolve data synchronously from cache when available so route changes
    // never briefly apply stale metadata from a previous route.
    const cached = routePath ? cache.get(routePath) : undefined;
    const data = cached !== undefined ? cached : (fetchedRoute === routePath ? fetchedData : null);

    useEffect(() => {
        if (!routePath) {
            setFetchedRoute(null);
            setFetchedData(null);
            setLoading(false);
            setError('');
            return;
        }

        const cachedNow = cache.get(routePath);
        if (cachedNow) {
            setFetchedRoute(routePath);
            setFetchedData(cachedNow);
            setLoading(false);
            setError('');
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError('');
        getPublicSeo(routePath)
            .then((res) => {
                if (cancelled) return;
                cache.set(routePath, res);
                setFetchedRoute(routePath);
                setFetchedData(res);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err.message || 'Failed to load SEO metadata');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [routePath]);

    return { data, loading, error };
}

export function clearSeoMetadataCache() {
    cache.clear();
}