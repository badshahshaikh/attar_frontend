const assert = require('assert');

async function runTests() {
    console.log('Running API security tests...');

    const baseUrl = 'http://localhost:5000/api';
    let cookie = '';

    // Test 1: login with wrong password
    let res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    assert.strictEqual(res.status, 401, 'Wrong password should return 401');

    // Test 2: Login with valid credentials
    res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'adminpassword' })
    });
    assert.strictEqual(res.status, 200, 'Valid login should return 200');
    cookie = res.headers.get('set-cookie');
    assert(cookie.includes('jwt='), 'Cookie should contain jwt');

    // Test 3: GET /auth/me without auth
    res = await fetch(`${baseUrl}/auth/me`);
    assert.strictEqual(res.status, 401, '/me without auth should return 401');

    // Test 4: GET /auth/me with auth
    res = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Cookie': cookie }
    });
    assert.strictEqual(res.status, 200, '/me with auth should return 200');
    let data = await res.json();
    assert.strictEqual(data.user.username, 'admin', 'User should be admin');

    // Test 5: POST /products without auth
    res = await fetch(`${baseUrl}/products`, { method: 'POST', body: JSON.stringify({}) });
    assert.strictEqual(res.status, 401, 'POST /products without auth should be 401');

    // Test 6: POST /products with auth
    res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: "Test Auth Product",
            price: 50,
            brand: "Testing Brand",
            fragranceFamily: "Oud"
        })
    });
    assert.strictEqual(res.status, 201, 'POST /products with auth should be 201');
    const product = await res.json();
    const tempId = product.id;
    assert(tempId > 0, 'Should return product with ID');

    // Test 7: GET /products (public API)
    res = await fetch(`${baseUrl}/products`);
    assert.strictEqual(res.status, 200, 'GET /products should be public');

    // Test 8: PUT /products/:id without auth
    res = await fetch(`${baseUrl}/products/${tempId}`, { method: 'PUT', body: JSON.stringify({}) });
    assert.strictEqual(res.status, 401, 'PUT /products/:id without auth should be 401');

    // Test 9: PUT /products/:id with auth
    res = await fetch(`${baseUrl}/products/${tempId}`, {
        method: 'PUT',
        headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: "Test Auth Product Updated",
            price: 60,
            brand: "Testing Brand",
            fragranceFamily: "Oud"
        })
    });
    assert.strictEqual(res.status, 200, 'PUT /products/:id with auth should be 200');

    // Test 10: DELETE /products/:id without auth
    res = await fetch(`${baseUrl}/products/${tempId}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 401, 'DELETE /products/:id without auth should be 401');

    // Test 11: DELETE /products/:id with auth
    res = await fetch(`${baseUrl}/products/${tempId}`, {
        method: 'DELETE',
        headers: { 'Cookie': cookie }
    });
    assert.strictEqual(res.status, 200, 'DELETE /products/:id with auth should be 200');

    console.log('All tests passed successfully!');
}

runTests().catch(console.error);
