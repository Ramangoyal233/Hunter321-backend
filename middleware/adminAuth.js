const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const adminAuth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Check if token starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Find admin by id
      const admin = await Admin.findById(decoded.id);
      
      if (!admin) {
        return res.status(401).json({ message: 'Admin not found' });
      }

      // Add admin to request object
      req.admin = admin;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ message: 'Token is not valid' });
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = adminAuth; 