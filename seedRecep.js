
require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./model/User');
const bcrypt = require('bcryptjs');

const seedRecep = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Check if an Receptionist with the given email already exists
    const existingRecep = await User.findOne({ email: process.env.receptionist_EMAIL });
    if (existingRecep) {
      console.log('Receptionist user already exists: ' + process.env.receptionist_EMAIL);
      process.exit();
    }

    // Hash the Receptionist password
    const hashedPassword = await bcrypt.hash(process.env.receptionist_PASSWORD, 10);

    // Create the Receptionist user
    const RecepUser = new User({
      name: process.env.receptionist_NAME,
      email: process.env.receptionist_EMAIL,
      password: hashedPassword,
      role: 'receptionist'
    });

    await RecepUser.save();
    console.log('Receptionist user seeded successfully:', process.env.receptionist_EMAIL);
    process.exit();
  } catch (err) {
    console.error('Error seeding Receptionist user:', err);
    process.exit(1);
  }
};

seedRecep();
