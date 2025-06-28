const mongoose = require('mongoose');



const readingProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  currentPage: { type: Number, required: true, min: 1 },
  lastRead: { type: Date, default: Date.now },
  totalReadingTime: { type: Number, default: 0, min: 0 }, // in seconds
  totalPagesRead: { type: Number, default: 0, min: 0 }
});

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  description: { type: String, required: true },
  readingProgress: { type: [readingProgressSchema], default: [] },
  pdfUrl: { type: String, required: true },
  coverImageUrl: { type: String, required: true },
  duration: { type: Number, default: 0 }, // Total duration in seconds
  todayReads: { type: Number, default: 0 }, // Number of reads today
  totalReads: { type: Number, default: 0 }, // Total number of reads
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    duration: { type: Number, default: 0 } // Reading duration in seconds
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ensure arrays are properly initialized
bookSchema.pre('save', function(next) {
  if (!this.readingProgress) this.readingProgress = [];
  if (!this.readBy) this.readBy = [];
  next();
});

// Ensure arrays are properly initialized during updates
bookSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.$set) {
    if (update.$set.readingProgress && !Array.isArray(update.$set.readingProgress)) {
      update.$set.readingProgress = [];
    }
    if (update.$set.readBy && !Array.isArray(update.$set.readBy)) {
      update.$set.readBy = [];
    }
  }
  next();
});

// Get filename from URL
bookSchema.virtual('pdfFilename').get(function() {
  return this.pdfUrl ? this.pdfUrl.split('/').pop() : null;
});

bookSchema.virtual('coverImageFilename').get(function() {
  return this.coverImageUrl ? this.coverImageUrl.split('/').pop() : null;
});

// Virtual for getting the full URL of the cover image
bookSchema.virtual('fullCoverImageUrl').get(function() {
  if (!this.coverImageUrl) return '';
  // If it's already a full URL, return as is
  if (this.coverImageUrl.startsWith('http://') || this.coverImageUrl.startsWith('https://')) {
    return this.coverImageUrl;
  }
  // If it's a local path (filename), construct the full URL
  return `/uploads/covers/${this.coverImageUrl.split('/').pop()}`;
});

// Virtual for getting the full URL of the PDF
bookSchema.virtual('fullPdfUrl').get(function() {
  if (!this.pdfUrl) return '';
  // If it's already a full URL, return as is
  if (this.pdfUrl.startsWith('http://') || this.pdfUrl.startsWith('https://')) {
    return this.pdfUrl;
  }
  // If it's a local path (filename), construct the full URL
  return `/uploads/books/${this.pdfUrl.split('/').pop()}`;
});

// Method to reset today's reads at midnight
bookSchema.methods.resetTodayReads = function() {
  this.todayReads = 0;
  return this.save();
};

// Method to increment reads
bookSchema.methods.incrementReads = async function(userId, duration = 0) {
  this.totalReads += 1;
  this.todayReads += 1;
  this.duration += duration;
  
  // Add to readBy array
  this.readBy.push({
    user: userId,
    timestamp: new Date(),
    duration: duration
  });
  
  return this.save();
};

const Book = mongoose.model('Book', bookSchema);

module.exports = Book; 