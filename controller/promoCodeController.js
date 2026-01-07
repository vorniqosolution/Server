const PromoCode = require("../model/promoCode");

// Create a new promo code
exports.createPromoCode = async (req, res) => {
    try {
        const { code, percentage, startDate, endDate } = req.body;

        const existingCode = await PromoCode.findOne({ code: code.toUpperCase() });
        if (existingCode) {
            return res.status(400).json({ success: false, message: "Promo code already exists" });
        }

        const newCode = await PromoCode.create({
            code: code.toUpperCase(),
            percentage,
            startDate,
            endDate,
            createdBy: req.user.userId,
        });

        res.status(201).json({ success: true, data: newCode });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all promo codes
exports.getAllPromoCodes = async (req, res) => {
    try {
        const codes = await PromoCode.find().sort({ createdAt: -1 }).populate("createdBy", "name");
        res.status(200).json({ success: true, data: codes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update status (activate/deactivate)
exports.updatePromoStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const updatedCode = await PromoCode.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updatedCode) {
            return res.status(404).json({ success: false, message: "Promo code not found" });
        }

        res.status(200).json({ success: true, data: updatedCode });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Validate a code (Public/Frontend use)
exports.validatePromoCode = async (req, res) => {
    try {
        const { code } = req.params;
        const promo = await PromoCode.findOne({
            code: code.toUpperCase(),
            status: "active",
            startDate: { $lte: new Date().setUTCHours(23, 59, 59, 999) },
            endDate: { $gte: new Date().setUTCHours(0, 0, 0, 0) },
        });

        if (!promo) {
            return res.status(400).json({ success: false, message: "Invalid or expired promo code" });
        }

        res.status(200).json({ success: true, data: promo });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
