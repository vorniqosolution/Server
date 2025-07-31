const User = require("../model/User");
const bcrypt = require("bcryptjs");

exports.UpdatePassword = async (req, res) => {
  try {
    const { prevpassword, newpassword } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(prevpassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Previous password does not match" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newpassword, salt);

    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Update password error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
exports.AdminUpdateUserPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const role = req.user.role;
    if (role !== "admin") {
      return res.status(403).json({
        message: "Access denied. Only admin can perform this action.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      message: "Recipient password updated successfully by admin",
    });
  } catch (err) {
    console.error("Admin update password error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
exports.DeleteRecipient = async (req, res) => {
  try {
    const { userId } = req.body;
    const role = req.user.role;

    if (role !== "admin") {
      return res.status(403).json({
        message: "Access denied. Only admin can perform this action.",
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      message: "Recipient deleted successfully by admin",
    });
  } catch (err) {
    console.error("Admin delete recipient error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.ViewRecipient = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Access denied. Only admin can view recipients.",
      });
    }

    const recipients = await User.find({ role: "receptionist" }).select(
      "-password"
    );

    if (recipients.length === 0) {
      return res.status(200).json({
        message: "No recipient added",
        data: [],
      });
    }

    return res.status(200).json({
      message: "Recipients fetched successfully",
      data: recipients,
    });
  } catch (error) {
    console.error("ViewRecipient error:", error);
    return res.status(500).json({
      message: "Server error while fetching recipients",
    });
  }
};
