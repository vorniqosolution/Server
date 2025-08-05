const Discount = require("../model/discount");

// Create a new discount
exports.createDiscount = async (req, res) => {
  try {
    const { title, percentage, startDate, endDate } = req.body;
    const discount = await Discount.create({
      title,
      percentage,
      startDate,
      endDate,
      createdBy: req.user.userId,
    });
    res.status(201).json({ message: "Discount created", discount });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all discounts
exports.getDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.status(200).json({ discounts });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete a discount
exports.deleteDiscount = async (req, res) => {
  try {
    const discount = await Discount.findByIdAndDelete(req.params.id);
    if (!discount)
      return res.status(404).json({ message: "Discount not found" });
    res.status(200).json({ message: "Discount deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// get current discount
exports.GetCurrentDiscount = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentDiscounts = await Discount.find({
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
    });
    console.log("Current discount", currentDiscounts);
    if (currentDiscounts.length === 0) {
      return res
        .status(200)
        .json({ message: "Currently no discount available" });
    }
    return res
      .status(200)
      .json({ message: "Current Discount", discount: currentDiscounts });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
