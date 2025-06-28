const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {

      return res.status(401).json({ message: 'Please authenticate.' });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {

      return res.status(401).json({ message: 'Please authenticate.' });
    }



    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    const admin = await Admin.findById(decoded.id || decoded._id);
    if (!admin) {

      return res.status(401).json({ message: 'Please authenticate.' });
    }

    req.token = token;
    req.admin = admin;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    res.status(401).json({ message: 'Please authenticate.' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      
      return res.status(401).json({ message: 'Please authenticate.' });
    }

    // Remove 'Bearer ' prefix if present
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token) {
    
      return res.status(401).json({ message: 'Please authenticate.' });
    }

   
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
   

    // Handle both id and _id in token payload
    const adminId = decoded.id || decoded._id;
    if (!adminId) {
      
      return res.status(401).json({ message: 'Invalid token format.' });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      
      return res.status(401).json({ message: 'Invalid token.' });
    }

    if (decoded.role !== 'admin' && !decoded.isAdmin) {
    
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    req.admin = admin;
    req.token = token;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
};

const userAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');


    if (!authHeader) {

      return res.status(401).json({ message: 'Please authenticate.' });
    }

    const token = authHeader.replace('Bearer ', '');


    if (!token) {

      return res.status(401).json({ message: 'Please authenticate.' });
    }


    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    // Handle both userId and id in token payload
    const userId = decoded.userId || decoded.id;


    if (!userId) {

      return res.status(401).json({ message: 'Invalid token format.' });
    }

    // Check if user is admin
    if (decoded.role === 'admin' || decoded.isAdmin) {

      const admin = await Admin.findById(userId);
      if (!admin) {

        return res.status(401).json({ message: 'Please authenticate.' });
      }
      req.admin = admin;  // Set the entire admin object
      req.isAdmin = true;
      req.token = token;
      return next();
    }


    const user = await User.findById(userId);


    if (!user) {

      return res.status(401).json({ message: 'Please authenticate.' });
    }

    if (!user.isActive) {

      return res.status(403).json({
        message: 'Your account has been blocked. Please contact support.',
        blocked: true
      });
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    console.error('User auth middleware error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    res.status(401).json({ message: 'Please authenticate.' });
  }
};

module.exports = { auth, adminAuth, userAuth }; 