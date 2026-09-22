
const API_BASE_URL =
    import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const apiUrl = (path) => {
    const normalizedPath = path.startsWith('/')
        ? path
        : `/${path}`;

    return `${API_BASE_URL}${normalizedPath}`;
};

export const fetchJson = async (path, options = {}) => {
    const response = await fetch(apiUrl(path), {
        ...options,
        credentials: 'include',
        headers: {
            ...(options.body
                ? { 'Content-Type': 'application/json' }
                : {}),
            ...options.headers,
        },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            data?.error ||
            data?.message ||
            `Request failed: ${response.status}`
        );
    }

    return data;
};