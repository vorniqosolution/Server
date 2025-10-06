require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../model/User');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
  try {
    await connectDB();

    const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (existingAdmin) {
      console.log('Admin user already exists: ' + process.env.ADMIN_EMAIL);
      process.exit();
    }

    const hashedPassword = bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    // Create the admin user
    const adminUser = new User({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin'
    });

    await adminUser.save();
    console.log('Admin user seeded successfully:', process.env.ADMIN_EMAIL);
    process.exit();
  } catch (err) {
    console.error('Error seeding admin user:', err);
    process.exit(1);
  }
};

seedAdmin();
