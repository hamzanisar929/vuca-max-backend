const jwt = require('jsonwebtoken');

const generateTokenAndSetCookie = (userId, res) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15d' });
    
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
        path: '/'
    });

    // Set non-httpOnly cookie for client-side access
    res.cookie('token_client', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
        path: '/'
    });

    return token;
}

module.exports = generateTokenAndSetCookie;