/**
 * customerService.js — Storefront customer account API
 *
 * Talks to the customer endpoints under /api/auth/customer/*.
 * Sessions live in the httpOnly `customer_jwt` cookie, so every call must
 * send credentials.
 */

import { API_URL } from '../config/api';

async function parseResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || 'The request could not be completed.');
        error.status = response.status;
        throw error;
    }
    return data;
}

function send(path, { method = 'GET', body } = {}) {
    return fetch(`${API_URL}/api/auth/customer${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
    }).then(parseResponse);
}

export async function registerCustomer(payload) {
    const data = await send('/register', { method: 'POST', body: payload });
    return data.user;
}

export async function loginCustomer(email, password) {
    const data = await send('/login', { method: 'POST', body: { email, password } });
    return data.user;
}

export async function fetchCustomer() {
    const data = await send('/me');
    return data.user;
}

export async function logoutCustomer() {
    return send('/logout', { method: 'POST' });
}

export async function updateCustomerProfile(payload) {
    const data = await send('/me', { method: 'PUT', body: payload });
    return data.user;
}

export async function changeCustomerPassword(currentPassword, newPassword) {
    return send('/me/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
    });
}

/**
 * Saved addresses + order history live under /api/customer (a different mount
 * point than the auth endpoints above), same cookie, same credential rule.
 */
function sendAccount(path, { method = 'GET', body } = {}) {
    return fetch(`${API_URL}/api/customer${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
    }).then(parseResponse);
}

export async function fetchAddresses() {
    const data = await sendAccount('/addresses');
    return data.addresses || [];
}

export async function createAddress(payload) {
    const data = await sendAccount('/addresses', { method: 'POST', body: payload });
    return data.address;
}

export async function updateAddress(addressId, payload) {
    const data = await sendAccount(`/addresses/${addressId}`, { method: 'PUT', body: payload });
    return data.address;
}

export async function deleteAddress(addressId) {
    const data = await sendAccount(`/addresses/${addressId}`, { method: 'DELETE' });
    return data.addresses || [];
}

export async function setDefaultAddress(addressId) {
    const data = await sendAccount(`/addresses/${addressId}/default`, { method: 'POST' });
    return data.addresses || [];
}

export async function fetchOrders() {
    const data = await sendAccount('/orders');
    return data.orders || [];
}

export async function fetchOrder(orderNumber) {
    const data = await sendAccount(`/orders/${encodeURIComponent(orderNumber)}`);
    return data.order;
}

/**
 * Places an order for the signed-in customer. Prices, shipping and totals are
 * computed server-side from the products table — the client only sends which
 * products/sizes/quantities (plus an optional saved address), so a tampered
 * payload cannot change what the customer pays.
 */
export async function createOrder(payload) {
    const data = await sendAccount('/orders', { method: 'POST', body: payload });
    return data.order;
}

/** Creates a Razorpay order on the server (amount taken from DB total). */
export async function createPaymentSession(orderNumber) {
    const data = await sendAccount(`/orders/${encodeURIComponent(orderNumber)}/payment`, { method: 'POST' });
    return data;
}

/** Verifies the HMAC and marks the local order paid. */
export async function verifyPayment(orderNumber, proof) {
    const data = await sendAccount(`/orders/${encodeURIComponent(orderNumber)}/payment/verify`, {
        method: 'POST',
        body: {
            razorpay_order_id: proof.razorpayOrderId,
            razorpay_payment_id: proof.razorpayPaymentId,
            razorpay_signature: proof.razorpaySignature,
        },
    });
    return data.order;
}