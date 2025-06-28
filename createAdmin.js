const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://admin:admin@cluster0.pvzofac.mongodb.net/bugbounty_hub?retryWrites=true&w=majority&appName=Cluster0';

async function verifyAdminLogin(email, password) {
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.log('Error: Admin user not found in database');
      return false;
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      console.log('Error: Password verification failed');
      return false;
    }

    console.log('Success: Admin credentials verified');
    return true;
  } catch (error) {
    console.error('Error verifying admin:', error.message);
    return false;
  }
}

async function createAdminUser() {
  try {
    console.log('Attempting to connect to MongoDB...');
    // Connect to MongoDB with retry options
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('Connected to MongoDB successfully');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@example.com' });
    if (existingAdmin) {
      console.log('Admin user already exists with email:', existingAdmin.email);
      console.log('Verifying existing admin credentials...');
      const isValid = await verifyAdminLogin('admin@example.com', 'admin123');
      if (!isValid) {
        console.log('The existing admin credentials are invalid. Please check the database.');
      }
      process.exit(0);
    }

    // Create new admin user
    const admin = new Admin({
      email: 'admin@example.com',
      password: 'admin123',
      name: 'Admin User',
      role: 'admin'
    });

    // Save admin user
    await admin.save();
    console.log('Admin user created successfully');
    console.log('Email:', admin.email);
    console.log('Password: admin123');

    // Verify the admin was created correctly
    console.log('\nVerifying admin credentials...');
    const isValid = await verifyAdminLogin('admin@example.com', 'admin123');
    if (!isValid) {
      console.log('Warning: Admin was created but credentials verification failed');
    }

  } catch (error) {
    console.error('Error creating admin:', error.message);
    if (error.name === 'MongoServerSelectionError') {
      console.error('Could not connect to MongoDB. Please check your connection string and network.');
    }
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
createAdminUser(); 