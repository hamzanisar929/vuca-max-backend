const jwt = require('jsonwebtoken');
const User = require('../models/User');
const generateTokenAndSetCookie = require('../utils/generateTokenAndSetCookie');

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists with this email or username'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      xp: 0,
      level: 1,
      rating: 0,
      role: 'user'
    });

    if(user){
      // Generate token and set cookie
      generateTokenAndSetCookie(user._id, res);
      await user.save();

      // Return user data
      res.status(200).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        xp: user.xp,
        level: user.level,
        rating: user.rating,
        createdAt: user.createdAt
      });
    }else{
      return res.status(400).json({ error: "Failed to create new user" });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt with email:', email);

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found with email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }


    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Password does not match for user:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token and set cookie
    generateTokenAndSetCookie(user._id, res);

    // Return user data
    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      xp: user.xp,
      level: user.level,
      rating: user.rating,
      createdAt: user.createdAt
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
};

const createAdmin = async (req, res) => {
  try {
    const { username, email, password, adminSecret } = req.body;

    // Verify admin secret
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Invalid admin secret' });
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ $or: [{ email }, { username }] });
    if (existingAdmin) {
      return res.status(400).json({
        error: 'Admin already exists with this email or username'
      });
    }

    // Create new admin user
    const admin = new User({
      username,
      email,
      password,
      role: 'admin',
      xp: 0,
      level: 1,
      rating: 0
    });

    await admin.save();

    if(admin){
      // Generate token and set cookie
      generateTokenAndSetCookie(admin._id, res);

      // Return admin data
      res.status(200).json({
        _id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        xp: admin.xp,
        level: admin.level,
        rating: admin.rating,
        createdAt: admin.createdAt
      });
    }else{
      return res.status(400).json({ error: "Failed to create new admin" });
    }

  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(500).json({ error: 'Error creating admin user' });
  }
};

const logout = async (req, res) => {
  try {
    // Clear both token cookies
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/',
      sameSite: 'lax'
    });
    
    res.cookie('token_client', '', {
      httpOnly: false,
      expires: new Date(0),
      path: '/',
      sameSite: 'lax'
    });
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Error logging out' });
  }
};

module.exports = {
  register,
  login,
  createAdmin,
  logout
}; 