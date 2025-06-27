const mongoose = require('mongoose');

// This is the blueprint for a single student's placement record.
const studentSchema = new mongoose.Schema({
  rollno: {
    type: String,
    required: true,
    unique: true 
  },
  name: {
    type: String,
    required: true
  },
  // --- THIS IS THE NEWLY ADDED FIELD ---
  email: {
    type: String,
    required: [true, 'Student email is required'], // Added a custom error message
    unique: true,
    lowercase: true, // Always store emails in lowercase for consistency
    trim: true // Remove any extra spaces
  },
  // ------------------------------------
  branch: {
    type: String,
    required: true
  },
  package: {
    type: Number,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
cgpa: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  }
}, {
  timestamps: true 
});

module.exports = mongoose.model('Student', studentSchema);