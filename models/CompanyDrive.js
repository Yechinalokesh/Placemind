const mongoose = require('mongoose');

const companyDriveSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  jobRole: {
    type: String,
    required: true,
    trim: true
  },
  jobDescription: {
    type: String,
    required: true
  },
  packageLPA: { // Package in Lakhs Per Annum
    type: Number,
    required: true
  },
  eligibility: {
    branches: [{ type: String }], // Array of eligible branches, e.g., ["CSE", "ECE"]
    minCGPA: {
      type: Number,
      default: 0
    },
    graduationYear: {
      type: Number,
      required: true
    }
  },
  lastDateToApply: {
    type: Date,
    required: true
  },
  applicationLink: { // External link to apply
    type: String,
    trim: true
  },
  status: { // To control if the drive is visible to students
    type: String,
    enum: ['Open', 'Closed'],
    default: 'Open'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

module.exports = mongoose.model('CompanyDrive', companyDriveSchema);