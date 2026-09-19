const API_BASE_URL =
    import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const apiUrl = (path) => {
    const normalizedPath = path.startsWith('/')
        ? path
        : `/${path}`;

    return `${API_BASE_URL}${normalizedPath}`;
};

export const fetchJson = async (path) => {
    const response = await fetch(apiUrl(path));

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
};