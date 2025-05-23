const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Store verification tokens temporarily (in production, consider using Redis or DB)
const verificationTokens = {};

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Error fetching user profile' });
  }
};

// Request email verification for profile update
const requestProfileUpdate = async (req, res) => {
  try {
    const { username, email, newPassword } = req.body;
    const user = req.user;
    
    // No changes requested
    if (!username && !newPassword) {
      return res.status(400).json({ error: 'No changes requested' });
    }
    
    // Check if username already exists if trying to change it
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }
    
    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store update details with token
    verificationTokens[token] = {
      userId: user._id,
      username: username || user.username,
      newPassword: newPassword || null,
      expiresAt: Date.now() + 3600000 // 1 hour expiry
    };
    
    // Prepare verification email
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-profile-update?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Verify Profile Update',
      html: `
        <h1>Profile Update Verification</h1>
        <p>You requested the following changes to your profile:</p>
        <ul>
          ${username && username !== user.username ? `<li>Change username to: ${username}</li>` : ''}
          ${newPassword ? '<li>Change password</li>' : ''}
        </ul>
        <p>Click the link below to verify these changes:</p>
        <a href="${verificationLink}">Verify Profile Update</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this change, please ignore this email.</p>
      `
    };
    
    // Send verification email
    await transporter.sendMail(mailOptions);
    
    res.status(200).json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (error) {
    console.error('Profile update request error:', error);
    res.status(500).json({ error: 'Error processing profile update request' });
  }
};

// Complete profile update with verification token
const verifyProfileUpdate = async (req, res) => {
  try {
    const { token } = req.body;
    
    // Check if token exists and is not expired
    const updateData = verificationTokens[token];
    if (!updateData || updateData.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    // Find user
    const user = await User.findById(updateData.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Apply updates
    user.username = updateData.username;
    
    // If password update was requested
    if (updateData.newPassword) {
      user.password = updateData.newPassword;
    }
    
    // Save updated user
    await user.save();
    
    // Remove used token
    delete verificationTokens[token];
    
    res.status(200).json({ 
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        xp: user.xp,
        level: user.level,
        rating: user.rating
      }
    });
  } catch (error) {
    console.error('Profile update verification error:', error);
    res.status(500).json({ error: 'Error updating profile' });
  }
};

// API endpoint to verify if a token is valid (for frontend verification)
const checkVerificationToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    const updateData = verificationTokens[token];
    if (!updateData || updateData.expiresAt < Date.now()) {
      return res.status(400).json({ valid: false });
    }
    
    res.status(200).json({
      valid: true,
      updates: {
        username: updateData.username !== await User.findById(updateData.userId).then(user => user.username),
        password: !!updateData.newPassword
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Error verifying token' });
  }
};

module.exports = {
  getProfile,
  requestProfileUpdate,
  verifyProfileUpdate,
  checkVerificationToken
}; 