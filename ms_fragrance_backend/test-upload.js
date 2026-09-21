import assert from 'assert';

async function testUpload() {
    console.log('Testing Image Upload Security...');
    const baseUrl = 'http://localhost:5000/api';

    // 1. Without Auth
    let res = await fetch(`${baseUrl}/products/upload-image`, { method: 'POST', body: new FormData() });
    assert.strictEqual(res.status, 401, 'Upload without auth should fail 401');

    // 2. Login
    res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'adminpassword' })
    });
    const cookie = res.headers.get('set-cookie');

    // 3. With auth (no file)
    res = await fetch(`${baseUrl}/products/upload-image`, {
        method: 'POST',
        headers: { 'Cookie': cookie },
        body: new FormData()
    });
    // Should be 400 No file uploaded, meaning it passed the 401 check
    assert.strictEqual(res.status, 400, 'Upload with auth but no file should be 400');

    console.log('Image upload security tested: PASS');
}

testUpload().catch(console.error);
