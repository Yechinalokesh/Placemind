const mongoose = require('mongoose');

const driveStatusSchema = new mongoose.Schema({
  studentEmail: {
    type: String,
    required: true
  },
  companyName: {
    type: String,
    required: true
  },
  eligibility: {
    type: Boolean,
    default: false
  },
  rounds: [
    {
      name: String,     // Example: "Aptitude Test"
      status: String    // "Cleared", "Rejected", "Pending"
    }
  ],
  currentStatus: {
    type: String,       // Example: "Pending", "Placed", "Rejected"
    default: 'Pending'
  },
  finalPackage: {
    type: Number,
    default: 0
  },
  feedback: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DriveStatus', driveStatusSchema);
