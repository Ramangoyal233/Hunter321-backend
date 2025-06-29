const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Book = require('../models/Book');
const { userAuth, adminAuth } = require('../middleware/auth');
const pdfParse = require('pdf-parse');
const mongoose = require('mongoose');

// Ensure upload directories exist at the project root public directory
const createUploadDirs = () => {
  const projectRoot = path.resolve(__dirname, '../'); // Go up one level from backend/routes to backend
  const dirs = [
    path.join(projectRoot, 'uploads/books'),
    path.join(projectRoot, 'uploads/covers')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createUploadDirs();

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadDir;
    const projectRoot = path.resolve(__dirname, '../'); // Go up one level from backend/routes to backend
    if (file.fieldname === 'pdf') {
      uploadDir = path.join(projectRoot, 'uploads/books');
    } else if (file.fieldname === 'coverImage') {
      uploadDir = path.join(projectRoot, 'uploads/covers');
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for PDFs, 2MB for images (handled in fileFilter)
  },
  fileFilter: function (req, file, cb) {
    if (file.fieldname === 'pdf' && file.mimetype === 'application/pdf') {
      // Check PDF file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        return cb(new Error('PDF file too large. Max 50MB allowed.'));
      }
      cb(null, true);
    } else if (file.fieldname === 'coverImage' && file.mimetype.startsWith('image/')) {
      // Check image file size (2MB limit)
      if (file.size > 2 * 1024 * 1024) {
        return cb(new Error('Image file too large. Max 2MB allowed.'));
      }
      cb(null, true);
    } else {
      cb(new Error('Invalid file type!'));
    }
  }
}).fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]);

// Test setup route
router.post('/test/setup', async (req, res) => {
  try {
    // Clear existing books
    await Book.deleteMany({});

    const sampleBooks = [
      {
        title: "The Web Application Hacker's Handbook",
        author: "Dafydd Stuttard and Marcus Pinto",
        description: "The Web Application Hacker's Handbook is a comprehensive guide to web application security. It covers everything from basic concepts to advanced techniques for finding and exploiting security vulnerabilities.",
        genre: "Cybersecurity",
        coverImageUrl: "/uploads/covers/sample1.jpg",
        pdfUrl: "/uploads/books/sample1.pdf",
        pages: 768,
        publishedYear: 2011,
        isbn: "978-1118026472",
        rating: 4.5
      },
      {
        title: "Practical Malware Analysis",
        author: "Michael Sikorski and Andrew Honig",
        description: "A hands-on guide to analyzing malicious software. This book teaches you how to analyze malware, understand its behavior, and develop effective countermeasures.",
        genre: "Malware Analysis",
        coverImageUrl: "/uploads/covers/sample2.jpg",
        pdfUrl: "/uploads/books/sample2.pdf",
        pages: 800,
        publishedYear: 2012,
        isbn: "978-1593272906",
        rating: 4.7
      },
      {
        title: "The Art of Deception",
        author: "Kevin D. Mitnick",
        description: "The Art of Deception is about the human side of security. It shows how social engineering can be used to bypass even the most sophisticated security systems.",
        genre: "Social Engineering",
        coverImageUrl: "/uploads/covers/sample3.jpg",
        pdfUrl: "/uploads/books/sample3.pdf",
        pages: 368,
        publishedYear: 2002,
        isbn: "978-0764542800",
        rating: 4.3
      }
    ];

    await Book.insertMany(sampleBooks);
    res.json({ message: 'Sample books created successfully' });
  } catch (error) {
    console.error('Error creating sample books:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ message: 'Error creating sample books', error: error.message });
  }
});

// User: Get All Books
router.get('/', async (req, res) => {
  try {
    const books = await Book.find().lean(); // Fetch lean documents
    

    const transformedBooks = books.map(book => {
      // Apply the same logic as the fullCoverImageUrl virtual, but use 'coverImageUrl' from lean document
      const fullCoverImageUrl = book.coverImageUrl ?
        (book.coverImageUrl.startsWith('http://') || book.coverImageUrl.startsWith('https://') ?
          book.coverImageUrl :
          `/uploads/covers/${book.coverImageUrl.split('/').pop()}`)
        : null;

      // Apply the same logic as the fullPdfUrl virtual, but use 'pdfUrl' from lean document
      const fullPdfUrl = book.pdfUrl ?
        (book.pdfUrl.startsWith('http://') || book.pdfUrl.startsWith('https://') ?
          book.pdfUrl :
          `/uploads/books/${book.pdfUrl.split('/').pop()}`)
        : null;

      return {
        ...book,
        coverImageUrl: fullCoverImageUrl, // Use the correctly constructed URL
        pdfUrl: fullPdfUrl, // Use the correctly constructed URL
      };
    });

    res.status(200).json(transformedBooks);
  } catch (error) {
    console.error('Error fetching books:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ message: 'Failed to fetch books. Server error.' });
  }
});

// Get a specific book
router.get('/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id)
      .populate('readingProgress.user', 'username');
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Transform the book to include proper URLs using the virtuals
    const transformedBook = {
      ...book.toObject({
        getters: true, // Include getters (virtuals)
        virtuals: ['fullCoverImageUrl', 'fullPdfUrl'] // Explicitly include these virtuals
      }),
      coverImageUrl: book.fullCoverImageUrl,
      pdfUrl: book.fullPdfUrl
    };

    res.json(transformedBook);
  } catch (error) {
    console.error('Error fetching book:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ message: 'Error fetching book', error: error.message });
  }
});

// Get book PDF
router.get('/:id/pdf', userAuth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if user has access to the book
    // You might want to add additional checks here based on your requirements
    // For example, checking if the user has purchased the book

    // Get the PDF filename from the URL
    let pdfFilename;
    if (book.pdfUrl) {
      // Extract filename from the URL
      pdfFilename = book.pdfUrl.split('/').pop();
    } else {
      return res.status(404).json({ message: 'PDF file not found for this book' });
    }

    // Construct the correct path to the PDF file
    // Files are stored in backend/uploads/books, not public/uploads/books
    const projectRoot = path.resolve(__dirname, '../'); // Go up one level from backend/routes to backend
    const pdfFilePath = path.join(projectRoot, 'uploads', 'books', pdfFilename);

 
    // Check if file exists
    if (!require('fs').existsSync(pdfFilePath)) {
      console.error('PDF file not found at path:', pdfFilePath);
      return res.status(404).json({ 
        message: 'PDF file not found on server',
        path: pdfFilePath,
        filename: pdfFilename
      });
    }

    // Set proper headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename}"`);
    
    // Send the PDF file
    res.sendFile(pdfFilePath, (err) => {
      if (err) {
        console.error('Error sending PDF file:', err);
        if (!res.headersSent) {
          res.status(500).json({ 
            message: 'Error serving PDF file', 
            error: err.message 
          });
        }
      }
    });
  } catch (error) {
    console.error('Error fetching book PDF:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ message: 'Error fetching book PDF', error: error.message });
  }
});

// Get reading progress for a specific book
router.get('/:id/progress', userAuth, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const book = await Book.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Find the user's reading progress
    const progress = book.readingProgress.find(
      p => p.user.toString() === req.user._id.toString()
    );

    res.json({ 
      progress: progress || null,
      message: progress ? 'Reading progress found' : 'No reading progress found'
    });
  } catch (error) {
    console.error('Error fetching reading progress:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ 
      message: 'Error fetching reading progress', 
      error: error.message 
    });
  }
});

// Get book stats (total reads, today's reads, total duration)
router.get('/:id/stats', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Calculate total reading time from all reading progress entries
    const totalDuration = book.readingProgress.reduce((total, progress) => {
      return total + (progress.totalReadingTime || 0);
    }, 0);

    // Calculate total reads from reading progress entries
    const totalReads = book.readingProgress.length;

    // Calculate today's reads from reading progress entries
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const todayReads = book.readingProgress.filter(progress => {
      if (!progress.lastRead) return false;
      const lastReadDate = new Date(progress.lastRead);
      lastReadDate.setHours(0, 0, 0, 0); // Start of the day when last read
      return lastReadDate.getTime() === today.getTime();
    }).length;

    const stats = {
      totalReads: totalReads,
      todayReads: todayReads,
      totalDuration: totalDuration,
      totalPages: book.pages || 0,
      averageRating: book.rating || 0,
      reviewCount: book.reviews ? book.reviews.length : 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching book stats:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ 
      message: 'Error fetching book stats', 
      error: error.message 
    });
  }
});

// Test endpoint to verify data transmission
router.post('/:id/test-progress', userAuth, async (req, res) => {
  try {
    
    res.json({ 
      message: 'Test endpoint received data',
      receivedData: req.body,
      parsedData: {
        currentPage: req.body.currentPage,
        isSessionStart: req.body.isSessionStart,
        totalReadingTime: req.body.totalReadingTime,
        totalPagesRead: req.body.totalPagesRead
      }
    });
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({ message: 'Test endpoint error', error: error.message });
  }
});

// Update reading progress
router.post('/:id/progress', userAuth, async (req, res) => {
  try {
 
    
    const { currentPage, isSessionStart, totalReadingTime, totalPagesRead } = req.body;


    // Validate currentPage
    if (!currentPage || typeof currentPage !== 'number' || currentPage < 1) {
      return res.status(400).json({ 
        message: 'Invalid current page',
        error: 'currentPage must be a positive number'
      });
    }

    // Validate totalReadingTime and totalPagesRead
    const validatedReadingTime = typeof totalReadingTime === 'number' ? totalReadingTime : 0;
    const validatedPagesRead = typeof totalPagesRead === 'number' ? totalPagesRead : 0;

    

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ Database not connected. Ready state:', mongoose.connection.readyState);
      return res.status(503).json({ 
        message: 'Database connection unavailable',
        error: 'Please try again in a moment'
      });
    }

    const book = await Book.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Find existing progress or create new one
    const progressIndex = book.readingProgress.findIndex(
      p => p.user.toString() === req.user._id.toString()
    );

    const now = new Date();

    if (progressIndex > -1) {
      const progress = book.readingProgress[progressIndex];
      
      
      // Now using seconds for totalReadingTime
      progress.currentPage = currentPage;
      progress.lastRead = now;
      progress.totalReadingTime = validatedReadingTime; // Use validated value
      progress.totalPagesRead = validatedPagesRead; // Use validated value
      
     
      // Handle session start/end for tracking purposes
      if (isSessionStart) {
        progress.lastSessionStart = now;
      } else if (progress.lastSessionStart) {
        progress.lastSessionStart = null; // End session
      }
    } else {
      // Create new progress entry
      book.readingProgress.push({
        user: req.user._id,
        currentPage,
        lastRead: now,
        lastSessionStart: isSessionStart ? now : null,
        readingSessions: [],
        totalReadingTime: validatedReadingTime, // Use validated value
        totalPagesRead: validatedPagesRead // Use validated value
      });
    }

   

    // Save to database with timeout
    const savePromise = Book.findOneAndUpdate(
      { _id: req.params.id },
      { 
        $set: { 
          readingProgress: book.readingProgress 
        }
      },
      { 
        new: true,
        runValidators: true
      }
    );

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database operation timeout')), 10000);
    });

    const updatedBook = await Promise.race([savePromise, timeoutPromise]);

    if (!updatedBook) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Find the updated progress
    const updatedProgress = updatedBook.readingProgress.find(
      p => p.user.toString() === req.user._id.toString()
    );

   
    // Return the values that were actually saved (or the frontend values if there's an issue)
    const responseStats = {
      currentPage: updatedProgress?.currentPage || currentPage,
      totalReadingTime: updatedProgress?.totalReadingTime || validatedReadingTime,
      totalPagesRead: updatedProgress?.totalPagesRead || validatedPagesRead
    };

   

    res.json({ 
      message: 'Reading progress updated',
      readingStats: responseStats
    });
  } catch (error) {
    console.error('❌ Error updating reading progress:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      bookId: req.params.id,
      userId: req.user._id
    });
    
    // Handle specific error types
    if (error.name === 'MongoServerSelectionError') {
      return res.status(503).json({ 
        message: 'Database connection issue',
        error: 'Please try again in a moment'
      });
    } else if (error.message === 'Database operation timeout') {
      return res.status(504).json({ 
        message: 'Database operation timed out',
        error: 'Please try again'
      });
    }
    
    res.status(500).json({ 
      message: 'Error updating reading progress', 
      error: error.message
    });
  }
});

// Add a review
router.post('/:id/reviews', userAuth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const book = await Book.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if user has already reviewed
    const existingReviewIndex = book.reviews.findIndex(
      r => r.user.toString() === req.user._id.toString()
    );

    if (existingReviewIndex > -1) {
      book.reviews[existingReviewIndex] = {
        user: req.user._id,
        rating,
        comment,
        createdAt: new Date()
      };
    } else {
      book.reviews.push({
        user: req.user._id,
        rating,
        comment
      });
    }

    // Update average rating
    const totalRating = book.reviews.reduce((sum, review) => sum + review.rating, 0);
    book.rating = totalRating / book.reviews.length;

    await book.save();
    res.json({ message: 'Review added successfully' });
  } catch (error) {
    console.error('Error adding review:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ message: 'Error adding review', error: error.message });
  }
});

// Search books
router.get('/search/:query', async (req, res) => {
  try {
    const books = await Book.find(
      { $text: { $search: req.params.query } },
      { score: { $meta: "textScore" } }
    )
    .select('-pdfUrl')
    .sort({ score: { $meta: "textScore" } });
    
    res.json(books);
  } catch (error) {
    console.error('Error searching books:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ message: 'Error searching books', error: error.message });
  }
});

// Increment book reads count
router.post('/:id/reads', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const duration = req.body.duration || 0;
    await book.incrementReads(req.user?._id, duration);

    res.status(200).json({ 
      message: 'Book reads count incremented', 
      readsCount: book.totalReads,
      todayReads: book.todayReads,
      duration: book.duration
    });
  } catch (error) {
    console.error('Error incrementing book reads count:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ message: 'Failed to increment reads count. Server error.' });
  }
});

// Reset today's reads (to be called by a cron job at midnight)
router.post('/reset-today-reads', adminAuth, async (req, res) => {
  try {
    const books = await Book.find({ todayReads: { $gt: 0 } });
    const resetPromises = books.map(book => book.resetTodayReads());
    await Promise.all(resetPromises);
    
    res.status(200).json({ 
      message: 'Today\'s reads reset successfully',
      booksReset: books.length
    });
  } catch (error) {
    console.error('Error resetting today\'s reads:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ message: 'Failed to reset today\'s reads. Server error.' });
  }
});

// Admin: Upload New Book
// Admin: Upload New Book
router.post('/', adminAuth, upload, async (req, res) => {
 
  // Set headers to prevent caching and ensure proper response
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Type': 'application/json'
  });
  
  try {
    const { title, author, description } = req.body;
    const pdfFile = req.files['pdf'] ? req.files['pdf'][0] : null;
    const coverImageFile = req.files['coverImage'] ? req.files['coverImage'][0] : null;


    // Validate required fields
    if (!title || !author || !description) {
      
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields',
        required: ['title', 'author', 'description']
      });
    }

    // Validate PDF file
    if (!pdfFile) {
      return res.status(400).json({ 
        success: false,
        message: 'PDF file is required' 
      });
    }

    // Validate cover image
    if (!coverImageFile) {
    
      return res.status(400).json({ 
        success: false,
        message: 'Cover image is required' 
      });
    }

    // Read PDF file to get page count
   
    const pdfFilePath = pdfFile.path;

    
    let totalPages = 0;
    try {
      const pdfData = await pdfParse(fs.readFileSync(pdfFilePath));
      totalPages = pdfData.numpages;
     
    } catch (pdfError) {
      console.error('Error parsing PDF:', pdfError);
      return res.status(400).json({ 
        success: false,
        message: 'Error processing PDF file' 
      });
    }

    // Create new book object
  
    const newBook = new Book({
      title,
      author,
      description,
      pdfUrl: `/uploads/books/${pdfFile.filename}`,
      coverImageUrl: `/uploads/covers/${coverImageFile.filename}`,
      pages: totalPages,
      readingProgress: []
    });


    // Save to database
   
    try {
      const savedBook = await newBook.save();
      
      // Send success response
      const responseData = {
        success: true,
        message: 'Book uploaded successfully',
        book: {
          _id: savedBook._id,
          title: savedBook.title,
          author: savedBook.author,
          description: savedBook.description,
          pdfUrl: savedBook.pdfUrl,
          coverImageUrl: savedBook.coverImageUrl,
          pages: totalPages,
          createdAt: savedBook.createdAt
        }
      };
      
    
      return res.status(201).json(responseData);
      
    } catch (saveError) {
      console.error('Database save error:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save book to database',
        error: saveError.message
      });
    }

  } catch (error) {
    console.error('\n=== Error in Book Upload ===');
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Clean up uploaded files if an error occurs
    if (req.files) {
     
      if (req.files['pdf'] && req.files['pdf'][0]) {
        fs.unlink(req.files['pdf'][0].path, err => {
          if (err) console.error('Error deleting PDF:', err);
        });
      }
      if (req.files['coverImage'] && req.files['coverImage'][0]) {
        fs.unlink(req.files['coverImage'][0].path, err => {
          if (err) console.error('Error deleting cover:', err);
        });
      }
    }
    
    // Handle specific error types
    let statusCode = 500;
    let message = 'Error uploading book';
    
    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation error';
    } else if (error.message === 'Invalid file type!') {
      statusCode = 400;
      message = error.message;
    } else if (error.code === 'LIMIT_FILE_SIZE') {
      statusCode = 400;
      message = 'File too large. Max 50MB allowed.';
    } else if (error.message && error.message.includes('too large')) {
      statusCode = 400;
      message = error.message;
    }

    return res.status(statusCode).json({ 
      success: false,
      message,
      error: error.message
    });
    
  }
});
// Admin: Update Book by ID
router.put('/:id', adminAuth, upload, async (req, res) => {
  try {
    const { title, author, genre, description, publishedYear, isbn, rating } = req.body;
    const bookId = req.params.id;
    const pdfFile = req.files['pdf'] ? req.files['pdf'][0] : null;
    const coverImageFile = req.files['coverImage'] ? req.files['coverImage'][0] : null;

    // First find the existing book
    const existingBook = await Book.findById(bookId);
    if (!existingBook) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    // Prepare update data
    const updateData = {
      title,
      author,
      genre,
      description,
      publishedYear,
      isbn,
      rating: parseFloat(rating) || 0
    };

    // If new files are uploaded
    if (pdfFile) {
      updateData.pdfUrl = `/uploads/books/${pdfFile.filename}`;
      // Delete old PDF file
      if (existingBook.pdfUrl) {
        const oldPdfPath = path.join(path.resolve(__dirname, '../../public'), existingBook.pdfUrl);
        if (fs.existsSync(oldPdfPath)) {
          fs.unlink(oldPdfPath, (err) => {
            if (err) console.warn(`Could not delete old PDF file:`, err);
          });
        }
      }
    }

    if (coverImageFile) {
      updateData.coverImageUrl = `/uploads/covers/${coverImageFile.filename}`;
      // Delete old cover image file
      if (existingBook.coverImageUrl) {
        const oldCoverPath = path.join(path.resolve(__dirname, '../../public'), existingBook.coverImageUrl);
        if (fs.existsSync(oldCoverPath)) {
          fs.unlink(oldCoverPath, (err) => {
            if (err) console.warn(`Could not delete old cover image:`, err);
          });
        }
      }
    }

    // Update the book
    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({ message: 'Book updated successfully', book: updatedBook });
  } catch (error) {
    console.error('Error updating book:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ message: 'Error updating book', error: error.message });
  }
});

// Admin: Delete Book by ID
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const bookToDelete = await Book.findById(req.params.id);
    if (!bookToDelete) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    // Delete the associated files from storage
    if (bookToDelete.pdfUrl) {
      const pdfPath = path.join(path.resolve(__dirname, '../../public'), bookToDelete.pdfUrl);
      if (fs.existsSync(pdfPath)) {
        fs.unlink(pdfPath, (err) => {
          if (err) console.warn(`Could not delete PDF file:`, err);
        });
      }
    }

    if (bookToDelete.coverImageUrl) {
      const coverPath = path.join(path.resolve(__dirname, '../../public'), bookToDelete.coverImageUrl);
      if (fs.existsSync(coverPath)) {
        fs.unlink(coverPath, (err) => {
          if (err) console.warn(`Could not delete cover image:`, err);
        });
      }
    }

    await Book.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Book deleted successfully!' });
  } catch (error) {
    console.error('Error deleting book:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      query: req.query
    });
    res.status(500).json({ message: 'Failed to delete book. Server error.' });
  }
});

// Temporary endpoint to fix cover images for existing books
router.post('/fix-cover-images', adminAuth, async (req, res) => {
  try {
    // Get all books
    const books = await Book.find();
   
    
    // Get all cover image files
    const projectRoot = path.resolve(__dirname, '../../');
    const coversDir = path.join(projectRoot, 'public/uploads/covers');
    const coverFiles = fs.readdirSync(coversDir);
  
    
    // Create a mapping of book creation time to cover image files
    const bookUpdates = [];
    
    for (let i = 0; i < books.length && i < coverFiles.length; i++) {
      const book = books[i];
      const coverFile = coverFiles[i];
      
      // Update the book with the cover image
      book.coverImageUrl = `/uploads/covers/${coverFile}`;
      bookUpdates.push(book.save());
      
     
    }
    
    // Save all updates
    await Promise.all(bookUpdates);
   
    
    res.json({ 
      success: true,
      message: `Updated ${bookUpdates.length} books with cover images`,
      updatedCount: bookUpdates.length
    });
    
  } catch (error) {
    console.error('Error fixing cover images:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fixing cover images',
      error: error.message 
    });
  }
});

module.exports = router; 
