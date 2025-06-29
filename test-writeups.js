const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Writeup = require('./models/Writeup');
const Category = require('./models/Category');
const Subcategory = require('./models/Subcategory');

// Load environment variables
dotenv.config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URL;

async function testWriteups() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', MONGODB_URI);
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log('Testing writeups...');
    
    // Check all writeups
    const allWriteups = await Writeup.find().populate('category').populate('subcategory');
    console.log(`Total writeups in database: ${allWriteups.length}`);
    
    allWriteups.forEach(writeup => {
      console.log(`- ${writeup.title} (ID: ${writeup._id})`);
      console.log(`  isPublished: ${writeup.isPublished}`);
      console.log(`  category: ${writeup.category ? writeup.category.name : 'None'}`);
      console.log(`  subcategory: ${writeup.subcategory ? writeup.subcategory.name : 'None'}`);
      console.log(`  platform: ${writeup.platform}`);
      console.log(`  difficulty: ${writeup.difficulty}`);
      console.log('');
    });
    
    // Check published writeups
    const publishedWriteups = await Writeup.find({ isPublished: true });
    console.log(`\nPublished writeups: ${publishedWriteups.length}`);
    
    // Check categories
    const categories = await Category.find().populate('writeups');
    console.log(`\nCategories: ${categories.length}`);
    categories.forEach(cat => {
      console.log(`- ${cat.name}: ${cat.writeups?.length || 0} writeups`);
    });
    
    // Check subcategories
    const subcategories = await Subcategory.find().populate('writeups');
    console.log(`\nSubcategories: ${subcategories.length}`);
    subcategories.forEach(sub => {
      console.log(`- ${sub.name}: ${sub.writeups?.length || 0} writeups`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

testWriteups(); 