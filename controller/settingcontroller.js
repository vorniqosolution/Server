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
};

// UPDATE the application settings (Admin only)
exports.updateSettings = async (req, res) => {
  try {
    const { taxRate, currencySymbol, hotelName } = req.body;
    const role = req.user.role;
    if (role !== "admin") {
      return res
        .status(404)
        .json({ message: "Only Admin can changed the setting" });
    }
    // Use findByIdAndUpdate with 'upsert: true'.
    // This will update the document if it exists, or create it if it doesn't.
    // It's a very robust way to handle this single-document model.
    const updatedSettings = await Settings.findByIdAndUpdate(
      SETTINGS_ID,
      { taxRate, currencySymbol, hotelName },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: updatedSettings,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
