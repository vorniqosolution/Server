// discountSeeder.js
// Run this script to seed initial discount data into the database

require('dotenv').config();
const connectDB = require('../config/db');
const Discount = require('../model/discount');
const User = require('../model/User');

const seedDiscounts = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Check if discounts already exist
    const existingDiscounts = await Discount.countDocuments();
    if (existingDiscounts > 0) {
      console.log('Discounts already exist in the database');
      process.exit();
    }

    // Find an admin user to use as createdBy
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('No admin user found. Please run the admin seeder first.');
      process.exit(1);
    }

    // Sample discount data
    const discountData = [
      {
        title: "Summer Sale",
        percentage: 25,
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-10-31'),
        createdBy: adminUser._id
      }
    ];

    // Insert discounts
    await Discount.insertMany(discountData);
    console.log('Discount data seeded successfully');
    console.log(`${discountData.length} discounts created`);
    process.exit();
  } catch (err) {
    console.error('Error seeding discount data:', err);
    process.exit(1);
  }
};

seedDiscounts();