function validateLogin(body) {
    const { username, password } = body;
    if (!username || !password) throw new Error('Username/email and password are required');
    return { username, password };
}

export { validateLogin };
