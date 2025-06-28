const express = require('express');
const router = express.Router();
const Subcategory = require('../../models/Subcategory');
const { auth } = require('../../middleware/auth');

// Get all subcategories
router.get('/', auth, async (req, res) => {
  try {
    const subcategories = await Subcategory.find()
      .populate('category', 'name description')
      .sort({ createdAt: -1 });
    res.json({ subcategories });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subcategories', error: error.message });
  }
});

// Get subcategories by category
router.get('/category/:categoryId', auth, async (req, res) => {
  try {
    const subcategories = await Subcategory.find({ category: req.params.categoryId })
      .populate('category', 'name description')
      .sort({ createdAt: -1 });
    res.json({ subcategories });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subcategories', error: error.message });
  }
});

// Create new subcategory
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, icon, category } = req.body;
    
    const subcategory = new Subcategory({
      name,
      description,
      icon,
      category,
      slug: name.toLowerCase().replace(/\s+/g, '-')
    });
    
    await subcategory.save();
    res.status(201).json(subcategory);
  } catch (error) {
    res.status(500).json({ message: 'Error creating subcategory', error: error.message });
  }
});

// Update subcategory
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, icon, category } = req.body;
    
    const subcategory = await Subcategory.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        icon,
        category,
        slug: name.toLowerCase().replace(/\s+/g, '-')
      },
      { new: true }
    );
    
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    
    res.json(subcategory);
  } catch (error) {
    res.status(500).json({ message: 'Error updating subcategory', error: error.message });
  }
});

// Delete subcategory
router.delete('/:id', auth, async (req, res) => {
  try {
    const subcategory = await Subcategory.findByIdAndDelete(req.params.id);
    
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    
    res.json({ message: 'Subcategory deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting subcategory', error: error.message });
  }
});

module.exports = router; 