const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const Category = require('../models/Category');
const Writeup = require('../models/Writeup');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Subcategory = require('../models/Subcategory');

// Category Management
router.get('/categories', adminAuth, async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single category
router.get('/categories/:id', adminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching category', error: error.message });
  }
});

router.post('/categories', adminAuth, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    
    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const category = new Category({
      name,
      description,
      icon,
      slug
    });
    
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/categories/:id', adminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const { name, description, icon } = req.body;
    category.name = name || category.name;
    category.description = description || category.description;
    category.icon = icon || category.icon;

    await category.save();
    res.json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/categories/:id', adminAuth, async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // Find the category first
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Find all subcategories for this category
    const subcategories = await Subcategory.find({ category: categoryId });
   

    // Delete all writeups associated with the subcategories
    for (const subcategory of subcategories) {
      if (subcategory.writeups && subcategory.writeups.length > 0) {
        await Writeup.deleteMany({ _id: { $in: subcategory.writeups } });
      }
    }

    // Delete all subcategories
    await Subcategory.deleteMany({ category: categoryId });
    
    // Delete the category itself
    await Category.findByIdAndDelete(categoryId);
    


    res.json({ 
      message: 'Category and all associated subcategories and writeups deleted successfully',
      deletedCategory: categoryId,
      deletedSubcategories: subcategories.length
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get subcategories for a category
router.get('/categories/:id/subcategories', adminAuth, async (req, res) => {
  try {
    const subcategories = await Category.find({ parent: req.params.id }).sort({ name: 1 });
    res.json(subcategories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subcategories', error: error.message });
  }
});

// Get all subcategories
router.get('/subcategories', adminAuth, async (req, res) => {
  try {
    const subcategories = await Subcategory.find()
      .populate({
        path: 'category',
        select: 'name _id'
      })
      .sort({ createdAt: -1 });
    
   
    res.json({ subcategories });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new subcategory under a specific category
router.post('/categories/:categoryId/subcategories', adminAuth, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const { categoryId } = req.params;
    
    // Check if parent category exists
    const parentCategory = await Category.findById(categoryId);
    if (!parentCategory) {
      return res.status(404).json({ message: 'Parent category not found' });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const subcategory = new Subcategory({
      name,
      description,
      icon,
      category: categoryId,
      slug
    });

  
    await subcategory.save();
    
    // Populate the category field before sending response
    const populatedSubcategory = await Subcategory.findById(subcategory._id)
      .populate('category', 'name _id');
    
    
    res.status(201).json(populatedSubcategory);
  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update subcategory
router.put('/subcategories/:id', adminAuth, async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id);
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }

    const { name, description, icon, parentId } = req.body;
    
    // If parent is being changed, verify the new parent exists
    if (parentId && parentId !== subcategory.parent.toString()) {
      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        return res.status(404).json({ message: 'Parent category not found' });
      }
      subcategory.parent = parentId;
    }

    subcategory.name = name || subcategory.name;
    subcategory.description = description || subcategory.description;
    subcategory.icon = icon || subcategory.icon;

    await subcategory.save();
    res.json(subcategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete subcategory
router.delete('/subcategories/:id', adminAuth, async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id);
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }

    // Delete all writeups associated with this subcategory
    await Writeup.deleteMany({ subcategory: req.params.id });

    // Delete the subcategory
    await Subcategory.findByIdAndDelete(req.params.id);

    res.json({ message: 'Subcategory and associated writeups deleted successfully' });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ message: error.message });
  }
});

// Writeup Management
router.get('/writeups', adminAuth, async (req, res) => {
  try {
    const writeups = await Writeup.find()
      .populate({
        path: 'author',
        select: 'username email name',
        refPath: 'authorModel'
      })
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 });
    res.json(writeups);
  } catch (error) {
    console.error('Error fetching writeups:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/writeups', adminAuth, async (req, res) => {
  try {
    const { category, subcategory, ...writeupData } = req.body;
    
    const writeup = new Writeup({
      ...writeupData,
      category,
      subcategory: subcategory || null,
      author: req.admin._id
    });
    
    await writeup.save();
    await writeup.populateCategoryInfo();
    res.status(201).json(writeup);
  } catch (error) {
    res.status(400).json({ message: 'Error creating writeup', error: error.message });
  }
});

router.put('/writeups/:id', adminAuth, async (req, res) => {
  try {
    const { category, subcategory, ...updateData } = req.body;
    
    const writeup = await Writeup.findByIdAndUpdate(
      req.params.id,
      {
        ...updateData,
        category,
        subcategory: subcategory || null
      },
      { new: true, runValidators: true }
    );
    
    if (!writeup) {
      return res.status(404).json({ message: 'Writeup not found' });
    }
    
    await writeup.populateCategoryInfo();
    res.json(writeup);
  } catch (error) {
    res.status(400).json({ message: 'Error updating writeup', error: error.message });
  }
});

router.delete('/writeups/:id', adminAuth, async (req, res) => {
  try {
    const writeup = await Writeup.findByIdAndDelete(req.params.id);
    
    if (!writeup) {
      return res.status(404).json({ message: 'Writeup not found' });
    }
    
    res.json({ message: 'Writeup deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting writeup', error: error.message });
  }
});

// Get single writeup
router.get('/writeups/:id', adminAuth, async (req, res) => {
  try {
    const writeup = await Writeup.findById(req.params.id)
      .populate('author', 'username')
      .populate('category', 'name')
      .populate('subcategory', 'name');
    
    if (!writeup) {
      return res.status(404).json({ message: 'Writeup not found' });
    }
    
    res.json(writeup);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching writeup', error: error.message });
  }
});

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// Update user role
router.patch('/users/:id/role', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.role = role;
    await user.save();
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user role', error: error.message });
  }
});

// Toggle user active status
router.patch('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent deactivating the last active admin
    if (user.role === 'admin' && user.isActive) {
      const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdmins <= 1) {
        return res.status(400).json({ message: 'Cannot deactivate the last active admin' });
      }
    }
    
    user.isActive = !user.isActive;
    await user.save();
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user status', error: error.message });
  }
});

// Block/Unblock user
router.patch('/users/:id/block', adminAuth, async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Broadcast user status change to all connected clients
    if (req.app.get('io')) {
      req.app.get('io').emit('userStatusChanged', {
        userId: user._id,
        isActive: user.isActive
      });
    }

    res.json({
      message: user.isActive ? 'User has been unblocked' : 'User has been blocked',
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user status', error: error.message });
  }
});

// Get user analytics
router.get('/analytics/users', adminAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get today's new users
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: today }
    });

    // Get today's active users
    const activeUsersToday = await User.countDocuments({
      lastLogin: { $gte: today }
    });

    // Get monthly new users
    const monthlyNewUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get user locations
    const userLocations = await User.aggregate([
      { $match: { 'location.country': { $exists: true } } },
      { $group: { _id: '$location.country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get daily active users for the last 30 days
    const dailyActiveUsers = await User.aggregate([
      { $match: { lastLogin: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastLogin' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get user growth over time
    const userGrowth = await User.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    // Get IP-based analytics
    const ipAnalytics = await User.aggregate([
      { $unwind: '$visitHistory' },
      {
        $group: {
          _id: '$visitHistory.ip',
          count: { $sum: 1 },
          lastVisit: { $max: '$visitHistory.date' },
          userCount: { $addToSet: '$_id' }
        }
      },
      {
        $project: {
          ip: '$_id',
          visitCount: '$count',
          lastVisit: 1,
          uniqueUsers: { $size: '$userCount' }
        }
      },
      { $sort: { visitCount: -1 } },
      { $limit: 10 }
    ]);

    // Get IP-based daily visits
    const ipDailyVisits = await User.aggregate([
      { $unwind: '$visitHistory' },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$visitHistory.date' } },
            ip: '$visitHistory.ip'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          totalVisits: { $sum: '$count' },
          uniqueIPs: { $addToSet: '$_id.ip' }
        }
      },
      {
        $project: {
          date: '$_id',
          totalVisits: 1,
          uniqueIPs: { $size: '$uniqueIPs' }
        }
      },
      { $sort: { date: 1 } },
      { $limit: 30 }
    ]);

    res.json({
      newUsersToday,
      activeUsersToday,
      monthlyNewUsers,
      userLocations,
      dailyActiveUsers,
      userGrowth,
      ipAnalytics,
      ipDailyVisits
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get campaign analytics
router.get('/analytics/campaigns', adminAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get campaign statistics
    const campaignStats = await User.aggregate([
      {
        $group: {
          _id: '$campaign',
          count: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          lastSignup: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          campaign: '$_id',
          totalUsers: '$count',
          activeUsers: 1,
          lastSignup: 1,
          conversionRate: {
            $multiply: [
              { $divide: ['$activeUsers', '$count'] },
              100
            ]
          }
        }
      },
      { $sort: { totalUsers: -1 } }
    ]);

    // Get daily campaign signups
    const dailyCampaignSignups = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            campaign: '$campaign'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          campaigns: {
            $push: {
              campaign: '$_id.campaign',
              count: '$count'
            }
          },
          totalSignups: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get campaign performance metrics
    const campaignPerformance = await User.aggregate([
      {
        $group: {
          _id: '$campaign',
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          totalReads: { $sum: { $ifNull: ['$totalReads', 0] } },
          totalWriteups: { $sum: { $ifNull: ['$totalWriteups', 0] } }
        }
      },
      {
        $project: {
          campaign: '$_id',
          totalUsers: 1,
          activeUsers: 1,
          totalReads: 1,
          totalWriteups: 1,
          engagementRate: {
            $multiply: [
              { $divide: ['$totalReads', { $max: ['$totalUsers', 1] }] },
              100
            ]
          }
        }
      },
      { $sort: { totalUsers: -1 } }
    ]);

    res.json({
      campaignStats,
      dailyCampaignSignups,
      campaignPerformance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 