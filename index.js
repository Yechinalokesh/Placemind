// ================================
// 1. IMPORTS & ENVIRONMENT SETUP
// ================================
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 📦 Mongoose Models
const Student = require('./models/Student');
const DriveStatus = require('./models/DriveStatus');
const User = require('./models/User');
const EligibleStudent = require('./models/EligibleStudent');
const CompanyDrive = require('./models/CompanyDrive');
const Application = require('./models/Application');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
// ================================
// 2. APP & AI INITIALIZATION
// ================================
const app = express();

// ================================
// 3. MIDDLEWARE
// ================================
app.use(cors());
app.use(express.json());

// ================================
// 4. DATABASE CONNECTION
// ================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ DB connection error:', err));

// ================================
// 5. SERVE STATIC FILES
// ================================
app.use(express.static(path.join(__dirname, 'public')));

// ================================
// 6. SECURITY & HELPER FUNCTIONS
// ================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ================================
// 7. API ROUTES
// ================================

// --- AUTHENTICATION ROUTES ---
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!['tpo', 'student'].includes(role)) return res.status(400).json({ message: 'Invalid role specified.' });
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists with this email.' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });
    const payload = { userId: user._id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: payload });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// --- PLACEMENT DATA ROUTES ---
app.get('/api/placements', async (req, res) => {
  try {
    const records = await Student.find({}, 'rollno name branch package company year cgpa email').sort({ package: -1 });
    res.json(records);
  } catch (err) {
    console.error('❌ Error fetching placements:', err);
    res.status(500).json({ message: 'Failed to load placements' });
  }
});

app.post('/add-student', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json({ message: 'Student added successfully', student });
  } catch (err) {
    console.error('❌ Error adding student:', err);
    res.status(500).json({ message: 'Failed to add student' });
  }
});

app.delete('/delete-student/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting student:', err);
    res.status(500).json({ message: 'Failed to delete student' });
  }
});

app.delete('/api/placements/delete-all', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') {
    return res.status(403).json({ message: 'Access Denied. TPO privileges required.' });
  }
  try {
    await Student.deleteMany({});
    await DriveStatus.deleteMany({});
    res.status(200).json({ message: 'All placement and drive records have been successfully deleted.' });
  } catch (error) {
    console.error('Error during "Delete All" operation:', error);
    res.status(500).json({ message: 'Server error while attempting to delete records.' });
  }
});

app.post('/api/upload-placements', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  const studentsData = req.body;
  if (!Array.isArray(studentsData) || studentsData.length === 0) return res.status(400).json({ message: 'No data received or data is not in array format.' });
  try {
    const operations = studentsData.map(student => {
      const studentDoc = {
        rollno: String(student["Roll Number"] || '').trim(),
        name: String(student["Student Name"] || '').trim(),
        email: String(student["Student Email"] || '').trim().toLowerCase(),
        branch: String(student.Branch || '').trim(),
        company: String(student["Company Name"] || '').trim(),
        package: parseFloat(student["Package (LPA)"]) || 0,
        year: parseInt(student["Graduation Year"]) || new Date().getFullYear(),
        cgpa: parseFloat(student.CGPA) || 0
      };
      if (!studentDoc.rollno || !studentDoc.name || !studentDoc.email || !studentDoc.branch) {
        console.warn('SKIPPING ROW due to missing required fields. Original data:', student);
        return null;
      }
      return { updateOne: { filter: { rollno: studentDoc.rollno }, update: { $set: studentDoc }, upsert: true } };
    }).filter(op => op !== null);
    if (operations.length === 0) return res.status(400).json({ message: 'The provided file contains no valid student data to process.' });
    const result = await Student.bulkWrite(operations);
    res.status(200).json({
      message: `Bulk upload complete. Processed ${studentsData.length} rows from file.`,
      details: { matchedAndUpdated: result.matchedCount, modifiedWithNewData: result.modifiedCount, newlyInsertedViaUpsert: result.upsertedCount },
      rawResult: result
    });
  } catch (error) {
    console.error('Error during bulk upload:', error);
    res.status(500).json({ message: 'Server error during bulk upload.' });
  }
});

// --- ELIGIBLE STUDENTS MASTER LIST ROUTES ---
app.post('/api/eligible-students/upload', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  const studentsData = req.body;
  if (!Array.isArray(studentsData) || studentsData.length === 0) {
    return res.status(400).json({ message: 'No data received.' });
  }
  try {
    const operations = studentsData.map(student => {
      const studentDoc = {
        rollno: student.RollNo || student.rollno,
        name: student.Name || student.name,
        email: student.Email || student.email,
        branch: student.Branch || student.branch,
        cgpa: parseFloat(student.CGPA) || parseFloat(student.cgpa) || 0,
        graduationYear: parseInt(student["Graduation Year"] || student.graduationYear) || new Date().getFullYear()
      };
      if (!studentDoc.rollno || !studentDoc.name || !studentDoc.email) return null;
      return {
        updateOne: {
          filter: { email: studentDoc.email },
          update: { $set: studentDoc },
          upsert: true
        }
      };
    }).filter(op => op !== null);
    if (operations.length === 0) return res.status(400).json({ message: 'No valid student data found in the file. Check headers.' });
    const result = await EligibleStudent.bulkWrite(operations);
    res.status(200).json({
      message: `Master list updated. ${result.upsertedCount + result.modifiedCount} records processed.`
    });
  } catch (error) {
    console.error('Error during eligible students bulk upload:', error);
    res.status(500).json({ message: 'Server error during upload.' });
  }
});

app.get('/api/eligible-students', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    const students = await EligibleStudent.find().sort({ branch: 1, rollno: 1 });
    res.json(students);
  } catch (error) {
    console.error('Error fetching eligible students:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// *** CORRECTED ORDER STARTS HERE ***

// Specific route for deleting all students is now FIRST.
app.delete('/api/eligible-students/delete-all', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    const deleteResult = await EligibleStudent.deleteMany({});
    res.json({ message: `Successfully deleted ${deleteResult.deletedCount} records from the master list.` });
  } catch (error) {
    console.error('Error deleting all eligible students:', error);
    res.status(500).json({ message: 'Server error while clearing the master list.' });
  }
});

// Dynamic route for deleting a single student by ID is now SECOND.
app.delete('/api/eligible-students/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    const deletedStudent = await EligibleStudent.findByIdAndDelete(req.params.id);
    if (!deletedStudent) {
      return res.status(404).json({ message: 'Eligible student not found.' });
    }
    res.json({ message: 'Eligible student removed successfully.' });
  } catch (error) {
    console.error('Error deleting eligible student:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// *** CORRECTED ORDER ENDS HERE ***

// --- ANALYTICS ROUTES ---
app.get('/api/analytics/branch-status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  const { branch } = req.query;
  if (!branch) return res.status(400).json({ message: 'Branch parameter is required.' });
  try {
    const eligibleStudents = await EligibleStudent.find({ branch: branch });
    const placedStudents = await Student.find({ branch: branch });
    const placedEmails = new Set(placedStudents.map(s => s.email));
    const unplacedStudents = eligibleStudents.filter(eligible => !placedEmails.has(eligible.email));
    const analyticsData = {
      totalStudents: eligibleStudents.length,
      placedCount: placedStudents.length,
      unplacedCount: unplacedStudents.length,
      placementPercentage: eligibleStudents.length > 0 ? ((placedStudents.length / eligibleStudents.length) * 100).toFixed(1) : 0,
      placed: placedStudents,
      unplaced: unplacedStudents
    };
    res.json(analyticsData);
  } catch (error) {
    console.error('Error in branch status analytics:', error);
    res.status(500).json({ message: 'Server error while generating analytics.' });
  }
});

app.get('/api/analytics/full-status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  const { branch } = req.query;
  if (!branch) return res.status(400).json({ message: 'Branch parameter is required.' });
  const ELIGIBILITY_CGPA_THRESHOLD = 7.0;
  try {
    const allEligibleStudents = await EligibleStudent.find({ branch: branch });
    const placedStudents = await Student.find({ branch: branch });
    const placedEmails = new Set(placedStudents.map(s => s.email));
    const allUnplacedStudents = allEligibleStudents.filter(eligibleStudent => !placedEmails.has(eligibleStudent.email));
    const unplacedEligible = allUnplacedStudents.filter(student => student.cgpa >= ELIGIBILITY_CGPA_THRESHOLD);
    const ineligible = allUnplacedStudents.filter(student => student.cgpa < ELIGIBILITY_CGPA_THRESHOLD);
    const analyticsData = {
      totalStudents: allEligibleStudents.length,
      placedCount: placedStudents.length,
      unplacedEligibleCount: unplacedEligible.length,
      ineligibleCount: ineligible.length,
      placed: placedStudents,
      unplacedEligible: unplacedEligible,
      ineligible: ineligible
    };
    res.json(analyticsData);
  } catch (error) {
    console.error('Error in full status analytics:', error);
    res.status(500).json({ message: 'Server error while generating analytics.' });
  }
});

// --- STUDENT DRIVE & COMPANY DRIVE ROUTES ---
// This section now includes the new student-specific route
app.post('/api/drive-status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access denied: TPO only.' });
  const { studentEmail, companyName, rounds, currentStatus, finalPackage } = req.body;
  if (!studentEmail || !companyName) return res.status(400).json({ message: 'Student Email and Company Name are required.' });
  try {
    const drive = await DriveStatus.findOneAndUpdate({ studentEmail: studentEmail, companyName: companyName }, { $set: { rounds: rounds, currentStatus: currentStatus, finalPackage: finalPackage } }, { new: true, upsert: true });
    res.status(200).json({ message: 'Drive status saved successfully!', data: drive });
  } catch (err) {
    console.error('❌ Error saving drive status:', err);
    res.status(500).json({ message: 'Server error while saving drive status.' });
  }
});

app.get('/api/mydrives', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Access Denied: Students only.' });
  try {
    const studentDrives = await DriveStatus.find({ studentEmail: req.user.email }).sort({ createdAt: -1 });
    res.json(studentDrives);
  } catch (err) {
    console.error('Error fetching student drives:', err);
    res.status(500).json({ message: 'Failed to fetch drive information.' });
  }
});

// NEW: Endpoint for a student to get just the IDs of drives they have applied to.
app.get('/api/my-applications', authenticateToken, async (req, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ message: 'Access Denied' });

    try {
        // Find all applications for this student and select ONLY the driveId field.
        const applications = await Application.find({ studentId: req.user.userId }).select('driveId');
        
        // Send back a simple array of the drive IDs.
        const driveIds = applications.map(app => app.driveId);
        res.json(driveIds);

    } catch (error) {
        console.error("Error fetching student's application IDs:", error);
        res.status(500).json({ message: 'Server error.' });
    }
});

app.post('/api/company-drives', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    const newDrive = new CompanyDrive(req.body);
    await newDrive.save();
    res.status(201).json({ message: 'Company drive posted successfully!', data: newDrive });
  } catch (error) {
    console.error('Error posting new drive:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation failed. Please check all fields.', details: error.errors });
    }
    res.status(500).json({ message: 'Server error while posting drive.' });
  }
});

app.get('/api/company-drives', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    const drives = await CompanyDrive.find().sort({ lastDateToApply: -1 });
    res.json(drives);
  } catch (error) {
    console.error('Error fetching company drives:', error);
    res.status(500).json({ message: 'Server error while fetching drives.' });
  }
});

app.get('/api/company-drives/:driveId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    const drive = await CompanyDrive.findById(req.params.driveId);
    if (!drive) {
      return res.status(404).json({ message: 'Drive not found.' });
    }
    res.json(drive);
  } catch (error) {
    console.error("Error fetching single drive:", error);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/company-drives/:driveId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    const updatedDrive = await CompanyDrive.findByIdAndUpdate(req.params.driveId, req.body, { new: true, runValidators: true });
    if (!updatedDrive) return res.status(404).json({ message: 'Drive not found.' });
    res.json({ message: 'Drive updated successfully!', data: updatedDrive });
  } catch (error) {
    console.error('Error updating drive:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.delete('/api/company-drives/:driveId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    const deletedDrive = await CompanyDrive.findByIdAndDelete(req.params.driveId);
    if (!deletedDrive) return res.status(404).json({ message: 'Drive not found.' });
    await Application.deleteMany({ driveId: req.params.driveId });
    res.json({ message: 'Drive and all associated applications deleted successfully.' });
  } catch (error) {
    console.error('Error deleting drive:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.get('/api/drives/:driveId/applications', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  try {
    const applications = await Application.find({ driveId: req.params.driveId });
    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/drives/:driveId/apply', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Only students can apply for drives.' });
  }
  try {
    const driveId = req.params.driveId;
    const studentId = req.user.userId;
    const existingApplication = await Application.findOne({ driveId, studentId });
    if (existingApplication) {
      return res.status(409).json({ message: 'You have already applied for this drive.' });
    }
    const newApplication = new Application({
      driveId: driveId,
      studentId: studentId,
      studentName: req.user.name,
      studentEmail: req.user.email
    });
    await newApplication.save();
    res.status(201).json({ message: 'Application submitted successfully!', data: newApplication });
  } catch (error) {
    console.error('Error submitting application:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'You have already applied for this drive.' });
    }
    res.status(500).json({ message: 'Server error while submitting application.' });
  }
});

// UPDATED: Endpoint for STUDENTS to get open drives, now with applicant counts
app.get('/api/active-drives', authenticateToken, async (req, res) => {
    try {
        // 1. Find all drives where the status is 'Open'
        const activeDrives = await CompanyDrive.find({ status: 'Open' }).lean(); // .lean() makes it faster

        // 2. For each drive, count how many applications it has
        const drivesWithCounts = await Promise.all(activeDrives.map(async (drive) => {
            const count = await Application.countDocuments({ driveId: drive._id });
            return {
                ...drive, // Keep all the original drive data
                applicantCount: count // Add the new applicantCount field
            };
        }));
        
        // Sort after adding counts
        drivesWithCounts.sort((a, b) => new Date(a.lastDateToApply) - new Date(b.lastDateToApply));

        res.json(drivesWithCounts);

    } catch (error) {
        console.error('Error fetching active drives:', error);
        res.status(500).json({ message: 'Server error while fetching active drives.' });
    }
});

// --- ✨ AI FEATURE ROUTES ---
app.get('/api/students-at-risk', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') {
    return res.status(403).json({ message: 'Access Denied. TPO privileges required.' });
  }
  try {
    const atRiskCriteria = {
      company: { $in: [null, ""] },
      cgpa: { $lt: 7.5 }
    };
    const atRiskStudents = await Student.find(atRiskCriteria).sort({ cgpa: 1 });
    res.json(atRiskStudents);
  } catch (error) {
    console.error("Error fetching at-risk students:", error);
    res.status(500).json({ message: "Server error while fetching at-risk students." });
  }
});

// UPDATED & MORE POWERFUL AI CHATBOT ROUTE
app.post('/api/chat', async (req, res) => {
    try {
        // Now we receive both the message and the contextData
        const { message, contextData } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: "No message provided." });
        }

        // Convert the placement data into a simplified string for the AI prompt
        const dataSummary = (contextData && contextData.length > 0) 
            ? JSON.stringify(contextData.map(s => ({ 
                branch: s.branch, company: s.company, package: s.package 
              })))
            : "No placement data is available.";

        // The new, more powerful prompt
        const prompt = `
            You are 'PlacemindU', a friendly and professional college placement assistant.
            Your task is to answer the user's question based ONLY on the JSON data provided below.
            Do not use any external knowledge.
            Analyze the data to answer questions about counts, companies, branches, or packages.
            If the data cannot answer the question, politely say "I do not have enough information to answer that question."

            Here is the placement data:
            ${dataSummary}

            Based on that data, please answer the following question: "${message}"
        `;

        const result = await aiModel.generateContent(prompt);
        const response = result.response;
        const aiText = response.text();

        res.json({ reply: aiText });

    } catch (error) {
        console.error("Error with AI Chat:", error);
        res.status(500).json({ error: "The AI is having trouble thinking right now. Please try again." });
    }
});

app.post('/api/placements/parse-with-ai', authenticateToken, async (req, res) => {
  if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Access Denied' });
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ message: 'No text provided to parse.' });
  }
  const prompt = `
        From the following unstructured text, extract the placement details and return them as a valid JSON object.
        The JSON object must have these exact keys: "rollno", "name", "email", "branch", "cgpa", "year", "company", "package".
        If a value is not found, use null for that key.
        The branch must be one of these: "CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "DS", "AI&DS", "AIML", "EIE".
        The package and cgpa should be numbers. The year should be a 4-digit number.
        Text to parse: "${text}"
        JSON output:
    `;
  try {
    const result = await aiModel.generateContent(prompt);
    const response = result.response;
    let aiText = response.text();
    aiText = aiText.replace(/```json\n/g, '').replace(/```/g, '');
    const jsonData = JSON.parse(aiText);
    res.json(jsonData);
  } catch (error) {
    console.error('AI Parsing Error:', error);
    res.status(500).json({ message: 'The AI failed to understand the text. Please try rephrasing.' });
  }
});

// ================================
// 8. SERVER STARTUP & FALLBACK
// ================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});