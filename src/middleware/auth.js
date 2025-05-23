const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Check for token in Authorization header or cookies
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    // If no token in header, check cookies
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new Error('User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ error: 'Please authenticate.' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    // Check for token in Authorization header or cookies
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    // If no token in header, check cookies
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.role !== 'admin') {
      throw new Error('Admin privileges required');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error.message);
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
};

module.exports = {
  auth,
  adminAuth
}; 