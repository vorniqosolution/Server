const Transaction = require("../model/transactions");
const Invoice = require("../model/invoice"); // <--- ADD THIS
const Guest = require("../model/guest"); 

// 1. Record a New Transaction
exports.addTransaction = async (req, res) => {
  try {
    const {
      reservationId, 
      guestId,       
      amount,
      type,
      paymentMethod, // Must be "Cash", "Card", "Online", or "PayAtHotel"
      referenceId,
      description
    } = req.body;

    // Basic Validation
    if (!amount || !type || !paymentMethod) {
      return res.status(400).json({ success: false, message: "Amount, Type, and Method are required." });
    }

    // Context Validation
    if (!reservationId && !guestId) {
      return res.status(400).json({ success: false, message: "Transaction must be linked to a Reservation or Guest." });
    }

    // Logic Check: "PayAtHotel" usually means NO advance was paid.
    // If you try to record a $5000 Advance via "PayAtHotel", it's slightly contradictory, 
    // but the system will allow it if that's how you categorize "Cash received at desk".
    
    const transaction = await Transaction.create({
      reservation: reservationId || null,
      guest: guestId || null,
      amount: Number(amount),
      type,
      paymentMethod,
      referenceId,
      description,
      recordedBy: req.user.userId,
    });

    // ============================================================
    // NEW: AUTO-UPDATE INVOICE IF LINKED TO A GUEST
    // ============================================================
    if (guestId && type === 'payment') {
        const invoice = await Invoice.findOne({ guest: guestId });
        
        if (invoice) {
            // Subtract the paid amount from the balance
            invoice.balanceDue = invoice.balanceDue - Number(amount);
            
            // Safety: Don't let it go below zero (unless you want to track overpayment)
            if (invoice.balanceDue < 0) invoice.balanceDue = 0;

            // Check if fully paid
            if (invoice.balanceDue === 0) {
                invoice.status = 'paid';
            }

            await invoice.save();
        }
    }
    // ============================================================

    return res.status(201).json({
      success: true,
      message: "Transaction recorded successfully",
      data: transaction,
    });
  } catch (err) {
    console.error("addTransaction Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// 2. Get Transactions (Statement)
exports.getTransactionsBySource = async (req, res) => {
  try {
    const { reservationId, guestId } = req.query;

    const query = {};
    if (reservationId) query.reservation = reservationId;
    if (guestId) query.guest = guestId;

    const list = await Transaction.find(query)
      .populate("recordedBy", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: list.length, data: list });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};