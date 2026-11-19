import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomerController } from '../../../src/modules/customer/customer.controller.js';

function createMockResponse() {
    return {
        statusCode: 200,
        body: undefined,
        headersSent: false,
        status(code) {
            if (this.headersSent) {
                const err = new Error('Cannot set headers after they are sent to the client');
                err.code = 'ERR_HTTP_HEADERS_SENT';
                throw err;
            }
            this.statusCode = code;
            return this;
        },
        json(data) {
            if (this.headersSent) {
                const err = new Error('Cannot set headers after they are sent to the client');
                err.code = 'ERR_HTTP_HEADERS_SENT';
                throw err;
            }
            this.headersSent = true;
            this.body = data;
            return this;
        }
    };
}

test('createOrder with invalid payload returns 400 cleanly and does not trigger ERR_HTTP_HEADERS_SENT', async () => {
    let serviceCalled = false;
    const customerService = {
        async createOrder() {
            serviceCalled = true;
            return { id: 101 };
        }
    };

    const controller = createCustomerController({ customerService });
    const req = {
        customer: { id: 1 },
        body: { items: [] } // invalid: empty basket
    };
    const res = createMockResponse();

    await controller.createOrder(req, res);

    assert.equal(serviceCalled, false, 'Service should not be called on validation error');
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /order has no items/i);
});

test('createOrder with valid payload invokes customerService and returns 201', async () => {
    let receivedPayload = null;
    const customerService = {
        async createOrder(customerId, payload) {
            receivedPayload = { customerId, payload };
            return { id: 101, orderNumber: 'MSF-101' };
        }
    };

    const controller = createCustomerController({ customerService });
    const req = {
        customer: { id: 7 },
        body: {
            items: [{ productId: 1, size: '6ml', quantity: 2 }],
            addressId: 3,
            source: 'web'
        }
    };
    const res = createMockResponse();

    await controller.createOrder(req, res);

    assert.equal(receivedPayload.customerId, 7);
    assert.equal(receivedPayload.payload.items.length, 1);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.order.orderNumber, 'MSF-101');
});

test('createGuestOrder with invalid payload returns 400 cleanly and does not trigger ERR_HTTP_HEADERS_SENT', async () => {
    let serviceCalled = false;
    const customerService = {
        async createGuestOrder() {
            serviceCalled = true;
            return { id: 102 };
        }
    };

    const controller = createCustomerController({ customerService });
    const req = {
        body: { fullName: '', items: [] } // invalid
    };
    const res = createMockResponse();

    await controller.createGuestOrder(req, res);

    assert.equal(serviceCalled, false, 'Service should not be called on validation error');
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
});

test('createGuestOrder with valid payload invokes customerService and returns 201', async () => {
    let receivedPayload = null;
    const customerService = {
        async createGuestOrder(payload) {
            receivedPayload = payload;
            return { id: 102, orderNumber: 'MSF-GUEST-102' };
        }
    };

    const controller = createCustomerController({ customerService });
    const req = {
        body: {
            fullName: 'John Doe',
            phone: '9876543210',
            addressLine: '123 Main St',
            city: 'Mumbai',
            postalCode: '400001',
            items: [{ productId: 1, size: '6ml', quantity: 1 }],
            source: 'web'
        }
    };
    const res = createMockResponse();

    await controller.createGuestOrder(req, res);

    assert.equal(receivedPayload.contactName, 'John Doe');
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.order.orderNumber, 'MSF-GUEST-102');
});

test('createAddress with invalid payload returns 400 cleanly and does not trigger ERR_HTTP_HEADERS_SENT', async () => {
    let serviceCalled = false;
    const customerService = {
        async createAddress() {
            serviceCalled = true;
            return { id: 1 };
        }
    };

    const controller = createCustomerController({ customerService });
    const req = {
        customer: { id: 1 },
        body: { phone: 'invalid-phone' }
    };
    const res = createMockResponse();

    await controller.createAddress(req, res);

    assert.equal(serviceCalled, false, 'Service should not be called on validation error');
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
});

test('createAddress with valid payload invokes customerService and returns 201', async () => {
    let receivedData = null;
    const customerService = {
        async createAddress(customerId, addressData) {
            receivedData = { customerId, addressData };
            return { id: 10, ...addressData };
        }
    };

    const controller = createCustomerController({ customerService });
    const req = {
        customer: { id: 5 },
        body: {
            fullName: 'Jane Doe',
            phone: '9876543210',
            line1: '456 Park Ave',
            city: 'Delhi',
            state: 'Delhi',
            postalCode: '110001'
        }
    };
    const res = createMockResponse();

    await controller.createAddress(req, res);

    assert.equal(receivedData.customerId, 5);
    assert.equal(receivedData.addressData.fullName, 'Jane Doe');
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.address.id, 10);
});

test('updateAddress with invalid payload returns 400 cleanly and does not trigger ERR_HTTP_HEADERS_SENT', async () => {
    let serviceCalled = false;
    const customerService = {
        async updateAddress() {
            serviceCalled = true;
            return { id: 1 };
        }
    };

    const controller = createCustomerController({ customerService });
    const req = {
        params: { id: '1' },
        customer: { id: 1 },
        body: { phone: '123' } // invalid phone
    };
    const res = createMockResponse();

    await controller.updateAddress(req, res);

    assert.equal(serviceCalled, false, 'Service should not be called on validation error');
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
});

test('updateAddress with valid payload invokes customerService and returns 200', async () => {
    let receivedData = null;
    const customerService = {
        async updateAddress(customerId, id, payload) {
            receivedData = { customerId, id, payload };
            return { id, ...payload };
        }
    };

    const controller = createCustomerController({ customerService });
    const req = {
        params: { id: '2' },
        customer: { id: 5 },
        body: {
            fullName: 'Jane Smith',
            phone: '9876543211',
            line1: '789 Broad St',
            city: 'Delhi',
            state: 'Delhi',
            postalCode: '110002'
        }
    };
    const res = createMockResponse();

    await controller.updateAddress(req, res);

    assert.equal(receivedData.customerId, 5);
    assert.equal(receivedData.id, 2);
    assert.equal(receivedData.payload.fullName, 'Jane Smith');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
});
