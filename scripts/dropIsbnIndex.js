const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://admin:admin@cluster0.pvzofac.mongodb.net/bugbounty_hub?retryWrites=true&w=majority&appName=Cluster0';

async function dropIsbnIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Get the books collection
    const booksCollection = mongoose.connection.collection('books');

    // Drop the isbn index
    await booksCollection.dropIndex('isbn_1');
    console.log('Successfully dropped isbn index');

    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dropIsbnIndex(); 