const mongoose = require('mongoose');

// This is the master blueprint for ALL students eligible for placements.
// It is separate from the 'Student' (placement record) model.
const eligibleStudentSchema = new mongoose.Schema({
  rollno: {
    type: String,
    required: true,
    unique: true,
    uppercase: true, // Store roll numbers consistently
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  branch: {
    type: String,
    required: true
  },
  cgpa: {
    type: Number,
    required: true
  },
  graduationYear: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EligibleStudent', eligibleStudentSchema);