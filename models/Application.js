const mongoose = require('mongoose');
const { Schema } = mongoose;

// This blueprint links a student (User) to a specific company drive.
const applicationSchema = new Schema({
  driveId: {
    type: Schema.Types.ObjectId, // A special type for storing MongoDB IDs
    ref: 'CompanyDrive',         // This tells Mongoose it refers to a document in the 'CompanyDrive' collection
    required: true
  },
  studentId: {
    type: Schema.Types.ObjectId, // This refers to the student's User ID
    ref: 'User',                 // It refers to a document in the 'User' collection
    required: true
  },
  studentName: { // Storing name and email here for convenience, to avoid extra lookups later
    type: String,
    required: true
  },
  studentEmail: {
    type: String,
    required: true
  },
  status: { // The TPO could potentially update this later (e.g., to "Shortlisted")
    type: String,
    enum: ['Applied', 'Shortlisted', 'Rejected by TPO'],
    default: 'Applied'
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// This ensures that a student can only apply to a specific drive ONCE.
// The database will throw an error if you try to create a duplicate combination.
applicationSchema.index({ driveId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);