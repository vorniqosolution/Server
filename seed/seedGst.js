require("dotenv").config();
const connectDB = require("../config/db");
const Setting = require("../model/Setting");
const SETTINGS_ID = "global_settings";

const GstTex = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    let settings = await Setting.findById(SETTINGS_ID);
    if (settings) {
      console.log("GST already exists:", settings);
    } else {
      settings = await Setting.create({ _id: SETTINGS_ID });
      await settings.save();
      console.log("GST seed created successfully:", settings);
    }
    process.exit();
  } catch (error) {
    console.error("DB connection error", err);
    process.exit(1);
  }
};

GstTex();
