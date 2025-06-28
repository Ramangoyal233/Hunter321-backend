const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const Admin = require('./models/Admin');
const User = require('./models/User');
const settingsMiddleware = require('./middleware/settingsMiddleware');
const path = require('path');
const authRoutes = require('./routes/auth');
const booksRoutes = require('./routes/books');


// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with proper settings
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.29.240:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: false
});

// Store io instance in app for use in routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.29.240:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Apply settings middleware to all routes
app.use(settingsMiddleware);

console.log(process.env.PORT);
// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URL;
console.log(process.env.MONGODB_URL);
// Improved MongoDB connection with better error handling
const connectWithRetry = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 30000, // 30 seconds
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      retryReads: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    setTimeout(connectWithRetry, 5000);
  }
};

// Connect to MongoDB
connectWithRetry();

// Add global mongoose error handlers
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
  if (err.name === 'MongoServerSelectionError') {
    
    setTimeout(connectWithRetry, 5000);
  }
});

mongoose.connection.on('disconnected', () => {
 
  setTimeout(connectWithRetry, 5000);
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Routes
const categoriesRoutes = require('./routes/categories');
const writeupsRoutes = require('./routes/writeups');
const adminRoutes = require('./routes/admin');
const adminSettingsRoutes = require('./routes/adminSettings');
const statsRoutes = require('./routes/stats');
const settingsRoutes = require('./routes/settings');

app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/writeups', writeupsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);

// Admin routes
app.use('/api/admin', require('./routes/adminAuth')); // Route adminAuth for /api/admin/login
app.use('/api/admin', adminRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Socket.IO connection handling
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    
    // Check if it's an admin or user token
    if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id);
      if (!admin) {
        return next(new Error('Authentication error'));
      }
      socket.admin = admin;
    } else {
      const user = await User.findById(decoded._id || decoded.userId);
      if (!user) {
        return next(new Error('Authentication error'));
      }
      socket.user = user;
    }
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });

  // Handle reconnection
  socket.on('reconnect_attempt', () => {
    const token = socket.handshake.auth.token;
    if (token) {
      socket.auth = { token };
    }
  });
});

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
})