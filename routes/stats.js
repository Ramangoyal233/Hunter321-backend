const express = require('express');
const router = express.Router();
const Writeup = require('../models/Writeup');
const Category = require('../models/Category');
const User = require('../models/User');

// Get overall statistics
router.get('/', async (req, res) => {
  try {
    const [totalWriteups, totalCategories, totalUsers, totalReads] = await Promise.all([
      Writeup.countDocuments({}),
      Category.countDocuments({}),
      User.countDocuments(),
      Writeup.aggregate([
        { $group: { _id: null, total: { $sum: '$reads' } } }
      ]).then(result => result[0]?.total || 0)
    ]);

    res.json({
      totalWriteups,
      totalCategories,
      totalUsers,
      totalReads
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

module.exports = router; 