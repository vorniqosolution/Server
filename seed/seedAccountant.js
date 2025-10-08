require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../model/User");
const bcrypt = require("bcryptjs");

const SeedAccounted = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Check if an Receptionist with the given email already exists
    const existingAcc = await User.findOne({
      email: process.env.ACCOUNTED_EMAIL,
    });
    if (existingAcc) {
      console.log(
        "accountant user already exists: " + process.env.ACCOUNTED_PASSWORD
      );
      process.exit();
    }

    // Hash the Receptionist password
    const hashedPassword = await bcrypt.hash(
      process.env.ACCOUNTED_PASSWORD,
      10
    );

    // Create the Receptionist user
    const AccUser = new User({
      name: process.env.ACCOUNTED_NAME,
      email: process.env.ACCOUNTED_EMAIL,
      password: hashedPassword,
      role: "accountant",
    });

    await AccUser.save();
    console.log(
      "Accountant user seeded successfully:",
      process.env.ACCOUNTED_EMAIL
    );
    process.exit();
  } catch (err) {
    console.error("Error seeding accountant User:", err);
    process.exit(1);
  }
};

SeedAccounted();
