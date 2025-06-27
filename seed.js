require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student');

// --- UPDATED DUMMY DATA ---
// Every student now has a unique email address.
const dummyStudents = [
  { rollno: '18B11A0501', name: 'Arun Kumar', email: 'arun.kumar@test.com', branch: 'CSE', package: 12, company: 'Google', year: 2022, cgpa: 9.2 },
  { rollno: '18B11A0402', name: 'Priya Sharma', email: 'priya.sharma@test.com', branch: 'ECE', package: 7.5, company: 'TCS', year: 2022, cgpa: 8.5 },
  { rollno: '19B11A0534', name: 'Varun Reddy', email: 'varun.reddy@test.com', branch: 'CSE', package: 9, company: 'Microsoft', year: 2023, cgpa: 8.9 },
  { rollno: '19B11A0211', name: 'Anjali Gupta', email: 'anjali.gupta@test.com', branch: 'EEE', package: 6, company: 'Wipro', year: 2023, cgpa: 7.8 },
  { rollno: '20B11A1205', name: 'Rohan Singh', email: 'rohan.singh@test.com', branch: 'IT', package: 5.5, company: 'Infosys', year: 2024, cgpa: 8.1 },
  { rollno: '20B11A0555', name: 'Sneha Patel', email: 'sneha.patel@test.com', branch: 'CSE', package: 15, company: 'Amazon', year: 2024, cgpa: 9.5 },
  { rollno: '19B11A0101', name: 'Kiran Desai', email: 'kiran.desai@test.com', branch: 'MECH', package: 4.5, company: 'L&T', year: 2023, cgpa: 7.2 },
  { rollno: '20B11A0440', name: 'Meera Iyer', email: 'meera.iyer@test.com', branch: 'ECE', package: 8, company: 'Qualcomm', year: 2024, cgpa: 8.8 },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected for seeding');

    await Student.deleteMany({});
    console.log('🧹 Cleared existing student data');

    await Student.insertMany(dummyStudents);
    console.log('🌱 Database has been seeded with new students!');

  } catch (err) {
    // This will provide a clearer error message if something goes wrong.
    console.error('❌ Error seeding database:', err.message);
    if (err.errors) {
        console.error('Validation Details:', err.errors);
    }
  } finally {
    await mongoose.connection.close();
    console.log('🔌 DB connection closed');
  }
};

seedDB();