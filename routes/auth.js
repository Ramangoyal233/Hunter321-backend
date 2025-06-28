const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const { adminAuth, userAuth } = require('../middleware/auth');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/profile-images';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide both email and password' });
    }

   
    // Find admin by email
    const admin = await Admin.findOne({ email });
    
    if (!admin) {
     
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify password
    const isMatch = await admin.comparePassword(password);
    
    if (!isMatch) {
     
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        _id: admin._id,
        id: admin._id,
        role: 'admin',
        isAdmin: true 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

   
    res.json({
      token,
      admin: {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Error during admin login' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
     
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
   
    if (!user) {
    
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
     
      return res.status(403).json({ message: 'Account is blocked', blocked: true });
    }

    // Use the User model's comparePassword method
    const isMatch = await user.comparePassword(password);
   
    
    if (!isMatch) {
      
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    
    const token = jwt.sign(
      { userId: user._id, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: 'user',
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error during login' });
  }
});

// Verify token
router.get('/verify', userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ valid: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ valid: false, message: 'Account is blocked' });
    }

    res.json({
      valid: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: 'user',
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ valid: false, message: 'Error verifying token' });
  }
});

// Get current user
router.get('/me', userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert user to plain object and add full image URL
    const userObj = user.toObject();
    if (userObj.profile?.avatar) {
      userObj.profile.avatar = `http://192.168.29.240:5001${userObj.profile.avatar}`;
    }

    res.json(userObj);
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
});

// Upload profile image
router.post('/upload-profile-image', upload.single('profileImage'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Update user's profile image
    user.profile.avatar = `/uploads/profile-images/${req.file.filename}`;
    await user.save();

    res.json({
      message: 'Profile image uploaded successfully',
      imageUrl: user.profile.avatar
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading profile image', error: error.message });
  }
});

// Change password
router.put('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password', error: error.message });
  }
});

// Update profile
router.put('/update-profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { username, email, bio, socialLinks, skills, location } = req.body;

    // Update user fields
    if (username) user.username = username;
    if (email) user.email = email;
    if (bio) user.profile.bio = bio;
    if (socialLinks) user.profile.socialLinks = socialLinks;
    if (skills) user.profile.skills = skills;
    if (location) user.profile.location = location;

    await user.save();

    // Convert user to plain object and add full image URL
    const userObj = user.toObject();
    if (userObj.profile?.avatar) {
      userObj.profile.avatar = `http://192.168.29.240:5001${userObj.profile.avatar}`;
    }

    res.json(userObj);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

// Check user status
router.get('/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId).select('isActive');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ isActive: user.isActive });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
});

// Admin verification endpoint
router.get('/admin/verify', adminAuth, async (req, res) => {
  try {
   
    const admin = await Admin.findById(req.admin._id);
    
    if (!admin) {
   
      return res.status(401).json({ message: 'Invalid admin token' });
    }

    
    res.json({
      isAdmin: true,
      admin: {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({ message: 'Error verifying admin token' });
  }
});

module.exports = router; 