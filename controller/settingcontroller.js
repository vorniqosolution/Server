const Settings = require("../model/Setting");

// We use a fixed ID to ensure we always work with the same settings document
const SETTINGS_ID = "global_settings";

// GET the current application settings
exports.getSettings = async (req, res) => {
  try {
    // Find the settings document, or create it with defaults if it doesn't exist
    let settings = await Settings.findById(SETTINGS_ID);

    if (!settings) {
      settings = await Settings.create({ _id: SETTINGS_ID });
    }

    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
}; // Replace with actual settings doc _id or store it in env

exports.updateSettings = async (req, res) => {
  try {
    const { taxRate, currencySymbol, hotelName } = req.body;
    console.log("Updating settings with:", { taxRate, currencySymbol, hotelName });
    
    // Ensure user object exists and role is accessible
    if (!req.user || req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ message: "Only admin can change the settings" });
    }

    // Validate inputs (optional but recommended)
    if (typeof taxRate !== 'number' || !currencySymbol || !hotelName) {
      return res.status(400).json({ message: 'Invalid input values' });
    }

    const updatedSettings = await Settings.findByIdAndUpdate(
      SETTINGS_ID,
      { taxRate, currencySymbol, hotelName },
      { new: true, upsert: true, runValidators: true }
    );

    if (!updatedSettings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedSettings,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message,
    });
  }
};

