const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const { auth, userAuth } = require('../middleware/auth');
const Writeup = require('../models/Writeup');

// Get all writeups
router.get('/', async (req, res) => {
  try {
   
    
    // Get all categories and subcategories with populated writeups
    const categories = await Category.find()
      .populate({
        path: 'writeups',
        populate: {
          path: 'author',
          select: 'username'
        }
      });
      
    const subcategories = await Subcategory.find()
      .populate({
        path: 'writeups',
        populate: {
          path: 'author',
          select: 'username'
        }
      });
    
   
    
    // Use a Map to track unique writeups by their ID
    const writeupsMap = new Map();
    
    // Add writeups from categories
    categories.forEach(category => {
      if (category.writeups && category.writeups.length > 0) {
        category.writeups.forEach(writeup => {
          if (!writeupsMap.has(writeup._id.toString())) {
            writeupsMap.set(writeup._id.toString(), {
              ...writeup.toObject(),
              category: {
                _id: category._id,
                name: category.name,
                slug: category.slug
              }
            });
          }
        });
      }
    });
    
    // Add writeups from subcategories
    subcategories.forEach(subcategory => {
      if (subcategory.writeups && subcategory.writeups.length > 0) {
        subcategory.writeups.forEach(writeup => {
          if (!writeupsMap.has(writeup._id.toString())) {
            writeupsMap.set(writeup._id.toString(), {
              ...writeup.toObject(),
              category: {
                _id: subcategory.parent,
                name: subcategory.name,
                slug: subcategory.slug,
                isSubcategory: true
              }
            });
          }
        });
      }
    });
    
    // Convert Map to array and sort by creation date
    const allWriteups = Array.from(writeupsMap.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
  
    
    res.json(allWriteups);
  } catch (error) {
    console.error('Error fetching writeups:', error);
    res.status(500).json({ message: 'Error fetching writeups', error: error.message });
  }
});

// Get recent writeups
router.get('/recent', async (req, res) => {
  try {
    const recentWriteups = await Writeup.find({ isPublished: true })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate('author', 'username')
      .populate('category', 'name')
      .populate('subcategory', 'name');

    res.json(recentWriteups);
  } catch (error) {
    console.error('Error fetching recent writeups:', error);
    res.status(500).json({ message: 'Error fetching recent writeups' });
  }
});

// Get writeups by category
router.get('/category/:categorySlug', async (req, res) => {
  try {
    const { categorySlug } = req.params;
    
    // Find category
    const category = await Category.findOne({ slug: categorySlug })
      .populate('writeups.author', 'username');
      
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Find subcategories
    const subcategories = await Subcategory.find({ parent: category._id })
      .populate('writeups.author', 'username');
    
    // Collect writeups
    let writeups = [...category.writeups];
    
    // Add writeups from subcategories
    subcategories.forEach(subcategory => {
      writeups = writeups.concat(subcategory.writeups);
    });
    
    // Sort by creation date
    writeups.sort((a, b) => b.createdAt - a.createdAt);
    
    res.json(writeups);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching writeups', error: error.message });
  }
});

// Get writeups by subcategory
router.get('/subcategory/:subcategorySlug', async (req, res) => {
  try {
    const { subcategorySlug } = req.params;
    
    const subcategory = await Subcategory.findOne({ slug: subcategorySlug })
      .populate('writeups.author', 'username')
      .populate('parent', 'name slug');
      
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    
    res.json(subcategory.writeups);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching writeups', error: error.message });
  }
});

// Get writeup by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Search in categories
    const category = await Category.findOne({ 'writeups._id': id })
      .populate('writeups.author', 'username');
      
    if (category) {
      const writeup = category.writeups.find(w => w._id.toString() === id);
      if (writeup) {
        return res.json({
          ...writeup.toObject(),
          category: {
            _id: category._id,
            name: category.name,
            slug: category.slug
          }
        });
      }
    }
    
    // Search in subcategories
    const subcategory = await Subcategory.findOne({ 'writeups._id': id })
      .populate('writeups.author', 'username')
      .populate('parent', 'name slug');
      
    if (subcategory) {
      const writeup = subcategory.writeups.find(w => w._id.toString() === id);
      if (writeup) {
        return res.json({
          ...writeup.toObject(),
          category: {
            _id: subcategory.parent._id,
            name: subcategory.name,
            slug: subcategory.slug,
            isSubcategory: true
          }
        });
      }
    }
    
    res.status(404).json({ message: 'Writeup not found' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching writeup', error: error.message });
  }
});

// Create writeup
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, content, categoryId, subcategoryId, difficulty, platform, platformUrl, bounty, tags, author } = req.body;
    
  
    // Create new writeup
    const writeup = new Writeup({
      title,
      description,
      content,
      author,
      category: categoryId,
      subcategory: subcategoryId,
      difficulty,
      platform,
      platformUrl,
      bounty,
      tags
    });
    
   
    // Save the writeup
    const savedWriteup = await writeup.save();
  
    // Add writeup reference to subcategory
    if (subcategoryId) {
      const subcategory = await Subcategory.findById(subcategoryId);
      if (!subcategory) {
        return res.status(404).json({ message: 'Subcategory not found' });
      }
      
      subcategory.writeups.push(savedWriteup._id);
      await subcategory.save();
     
    }
    
    // Add writeup reference to category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    category.writeups.push(savedWriteup._id);
    await category.save();
  
    
    res.status(201).json(savedWriteup);
  } catch (error) {
    console.error('Error creating writeup:', error);
    res.status(500).json({ 
      message: 'Error creating writeup', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update writeup
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, difficulty, platform, platformUrl, bounty, tags } = req.body;
    
    // Search in categories
    const category = await Category.findOne({ 'writeups._id': id });
    if (category) {
      const writeup = category.writeups.id(id);
      if (writeup) {
        if (writeup.author.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to update this writeup' });
        }
        
        writeup.title = title;
        writeup.description = description;
        writeup.content = content;
        writeup.difficulty = difficulty;
        writeup.platform = platform;
        writeup.platformUrl = platformUrl;
        writeup.bounty = bounty;
        writeup.tags = tags;
        writeup.updatedAt = Date.now();
        
        await category.save();
        return res.json(writeup);
      }
    }
    
    // Search in subcategories
    const subcategory = await Subcategory.findOne({ 'writeups._id': id });
    if (subcategory) {
      const writeup = subcategory.writeups.id(id);
      if (writeup) {
        if (writeup.author.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to update this writeup' });
        }
        
        writeup.title = title;
        writeup.description = description;
        writeup.content = content;
        writeup.difficulty = difficulty;
        writeup.platform = platform;
        writeup.platformUrl = platformUrl;
        writeup.bounty = bounty;
        writeup.tags = tags;
        writeup.updatedAt = Date.now();
        
        await subcategory.save();
        return res.json(writeup);
      }
    }
    
    res.status(404).json({ message: 'Writeup not found' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating writeup', error: error.message });
  }
});

// Delete writeup
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Search in categories
    const category = await Category.findOne({ 'writeups._id': id });
    if (category) {
      const writeup = category.writeups.id(id);
      if (writeup) {
        if (writeup.author.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to delete this writeup' });
        }
        
        writeup.remove();
        await category.save();
        return res.json({ message: 'Writeup deleted successfully' });
      }
    }
    
    // Search in subcategories
    const subcategory = await Subcategory.findOne({ 'writeups._id': id });
    if (subcategory) {
      const writeup = subcategory.writeups.id(id);
      if (writeup) {
        if (writeup.author.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to delete this writeup' });
        }
        
        writeup.remove();
        await subcategory.save();
        return res.json({ message: 'Writeup deleted successfully' });
      }
    }
    
    res.status(404).json({ message: 'Writeup not found' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting writeup', error: error.message });
  }
});

router.get('/categories', auth, async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    const subcategories = await Subcategory.find().sort({ createdAt: -1 });
    
    const categoriesWithSubcategories = categories.map(category => ({
      ...category.toObject(),
      subcategories: subcategories.filter(sub => sub.parent._id === category._id)
    }));
    
    res.json({ categories: categoriesWithSubcategories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Increment read count
router.post('/:id/read', userAuth, async (req, res) => {
  try {
    const writeup = await Writeup.findById(req.params.id);
    if (!writeup) {
      return res.status(404).json({ message: 'Writeup not found' });
    }

    // Check if user has already read this writeup
    const alreadyRead = writeup.readBy.some(entry => entry.user && entry.user.toString() === req.user._id.toString());
    if (alreadyRead) {
      return res.json({ 
        reads: writeup.reads,
        message: 'Already read by this user'
      });
    }

    // Add user to readBy array and increment read count
    writeup.readBy.push({ user: req.user._id });
    writeup.reads += 1;
    await writeup.save();

    res.json({ 
      reads: writeup.reads,
      message: 'Read count incremented'
    });
  } catch (error) {
    console.error('Error incrementing read count:', error);
    res.status(500).json({ message: 'Error incrementing read count' });
  }
});

// Search writeups
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
   
    
    if (!query) {
     
      return res.json([]);
    }

    // First, let's check how many writeups exist in total
    const totalWriteups = await Writeup.countDocuments();
  

    // Check how many published writeups exist
    const publishedWriteups = await Writeup.countDocuments({ isPublished: true });
    
    const writeups = await Writeup.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ],
      isPublished: true
    })
    .select('title content description category createdAt')
    .populate('category', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

   

    res.json(writeups);
  } catch (error) {
    console.error('❌ Error searching writeups:', error);
    res.status(500).json({ message: 'Error searching writeups', error: error.message });
  }
});

module.exports = router; 