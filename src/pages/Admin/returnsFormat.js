// Pure formatting helpers for the Returns admin page, extracted from Returns.jsx.

export const formatMoney = (value) =>
    `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const formatDate = (iso) => {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (iso) => {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

// Ceiling for a refund = sum of the return's own line totals (the backend
// enforces the same bound server-side).
export const lineTotalSum = (items = []) =>
    items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
