const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Subcategory = require('../models/Subcategory');

// Get all categories with subcategories and writeups (public route)
router.get('/public', async (req, res) => {
  try {
    const categories = await Category.find({ isSubcategory: false })
      .populate({
        path: 'writeups',
        populate: {
          path: 'author',
          select: 'username'
        }
      })
      .sort({ name: 1 });
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// Get all categories with subcategories and writeups
router.get('/', async (req, res) => {
  try {
    // Get main categories
    const categories = await Category.find({ isSubcategory: false })
      .populate({
        path: 'writeups',
        populate: {
          path: 'author',
          select: 'username'
        }
      })
      .sort({ name: 1 });

    // Get subcategories for each category
    const categoriesWithSubcategories = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await Category.find({ 
          parent: category._id,
          isSubcategory: true 
        })
        .populate({
          path: 'writeups',
          populate: {
            path: 'author',
            select: 'username'
          }
        })
        .sort({ name: 1 });

        return {
          ...category.toObject(),
          subcategories
        };
      })
    );

    res.json(categoriesWithSubcategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// Get all subcategories
router.get('/subcategories', async (req, res) => {
  try {
    const subcategories = await Category.find({ isSubcategory: true })
      .populate('parent', 'name')
      .sort({ createdAt: -1 });
    res.json({ subcategories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a specific category
router.get('/:categoryId', async (req, res) => {
  try {
    const category = await Category.findById(req.params.categoryId)
      .populate({
        path: 'writeups',
        populate: {
          path: 'author',
          select: 'username'
        }
      });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // If it's a main category, get its subcategories
    if (!category.isSubcategory) {
      const subcategories = await Category.find({ 
        parent: category._id,
        isSubcategory: true 
      })
      .populate({
        path: 'writeups',
        populate: {
          path: 'author',
          select: 'username'
        }
      });

      return res.json({
        ...category.toObject(),
        subcategories
      });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching category', error: error.message });
  }
});

// Get subcategories for a specific category
router.get('/:id/subcategories', async (req, res) => {
  try {
    console.log("category id", req.params.id);
    const subcategories = await Subcategory.find({ 
      category: req.params.id,
      isSubcategory: true 
    })
    
    
    console.log(subcategories);
    if (!subcategories) {
      return res.json({ subcategories: [] });
    }
    
    res.json({ subcategories });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new category (admin only)
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const category = new Category({
      ...req.body,
      isSubcategory: false
    });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
});

// Add a subcategory to a category (admin only)
router.post('/:categoryId/subcategories', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const parentCategory = await Category.findById(req.params.categoryId);
    if (!parentCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const subcategory = new Category({
      ...req.body,
      parent: parentCategory._id,
      isSubcategory: true
    });
    await subcategory.save();
    res.status(201).json(subcategory);
  } catch (error) {
    res.status(500).json({ message: 'Error adding subcategory', error: error.message });
  }
});

// Add a writeup to a category or subcategory
router.post('/:categoryId/writeups', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const category = await Category.findById(req.params.categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const writeup = {
      ...req.body,
      author: user._id
    };

    category.writeups.push(writeup);
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error adding writeup', error: error.message });
  }
});

// Update a category (admin only)
router.put('/:categoryId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const category = await Category.findByIdAndUpdate(
      req.params.categoryId,
      req.body,
      { new: true }
    );
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error updating category', error: error.message });
  }
});

// Delete a category (admin only)
router.delete('/:categoryId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // First, find all subcategories
    const subcategories = await Category.find({ parent: req.params.categoryId });
    
    // Delete all writeups from subcategories
    for (const subcategory of subcategories) {
      subcategory.writeups = [];
      await subcategory.save();
    }
    
    // Delete all subcategories
    await Category.deleteMany({ parent: req.params.categoryId });
    
    // Find and delete the main category
    const category = await Category.findById(req.params.categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Clear writeups from the main category
    category.writeups = [];
    await category.save();
    
    // Delete the category
    await Category.findByIdAndDelete(req.params.categoryId);
    
    res.json({ message: 'Category, subcategories, and all associated writeups deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
});

// Test route to create a sample category (temporary)
router.post('/test/setup', async (req, res) => {
  try {
    // Create a main category
    const webCategory = new Category({
      name: 'Web Security',
      description: 'Web application security vulnerabilities and exploits',
      icon: '🌐',
      slug: 'web-security',
      isSubcategory: false
    });
    await webCategory.save();

    // Create a subcategory
    const xssCategory = new Category({
      name: 'Cross-Site Scripting (XSS)',
      description: 'XSS vulnerabilities and exploitation techniques',
      icon: '🎯',
      slug: 'xss',
      parent: webCategory._id,
      isSubcategory: true
    });
    await xssCategory.save();

    // Add a sample writeup
    const writeup = {
      title: 'Basic XSS Exploitation',
      description: 'A beginner-friendly guide to XSS exploitation',
      content: 'Detailed content about XSS...',
      difficulty: 'Easy',
      author: '65f2a1b3c4d5e6f7g8h9i0j1' // Replace with a valid user ID from your database
    };
    xssCategory.writeups.push(writeup);
    await xssCategory.save();

    res.json({ message: 'Test categories created successfully', categories: [webCategory, xssCategory] });
  } catch (error) {
    res.status(500).json({ message: 'Error creating test categories', error: error.message });
  }
});

module.exports = router;