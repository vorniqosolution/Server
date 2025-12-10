const Transaction = require("../model/transactions");
const Invoice = require("../model/invoice"); // <--- ADD THIS
const Guest = require("../model/guest");

// exports.addTransaction = async (req, res) => {
//   try {
//     const {
//       reservationId,
//       guestId,
//       amount,
//       type,
//       paymentMethod,
//       referenceId,
//       description,
//     } = req.body;

//     if (!amount || !type || !paymentMethod) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message: "Amount, Type, and Method are required.",
//         });
//     }

//     if (!reservationId && !guestId) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message: "Transaction must be linked to a Reservation or Guest.",
//         });
//     }

//     const transaction = await Transaction.create({
//       reservation: reservationId || null,
//       guest: guestId || null,
//       amount: Number(amount),
//       type,
//       paymentMethod,
//       referenceId,
//       description,
//       recordedBy: req.user.userId,
//     });
//     if (guestId && type === "payment") {
//       const invoice = await Invoice.findOne({ guest: guestId });

//       if (invoice) {
//             if (type === 'payment') {
//                 invoice.balanceDue = invoice.balanceDue - Number(amount);
//             }
//             // 👇 ADD THIS BLOCK 👇
//             else if (type === 'refund') {
//                 // If we give money back, the guest technically "owes" us that amount again
//                 // OR we are returning extra money they paid.
//                 // Usually: BalanceDue = BalanceDue + RefundAmount
//                 invoice.balanceDue = invoice.balanceDue + Number(amount);
                
//                 // If status was 'paid', it might become 'pending' again
//                 if (invoice.balanceDue > 0) invoice.status = 'pending';
//             }
//             // 👆 --------------- 👆

//             if (invoice.balanceDue < 0) invoice.balanceDue = 0; // Safety
//             if (invoice.balanceDue === 0) invoice.status = 'paid';

//             await invoice.save();
//         }
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Transaction recorded successfully",
//       data: transaction,
//     });
//   } catch (err) {
//     console.error("addTransaction Error:", err);
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error", error: err.message });
//   }
// };

exports.addTransaction = async (req, res) => {
  try {
    const {
      reservationId,
      guestId,
      amount,
      type,
      paymentMethod,
      referenceId,
      description,
    } = req.body;

    if (!amount || !type || !paymentMethod) {
      return res
        .status(400)
        .json({ success: false, message: "Amount, type and method are required." });
    }

    if (!reservationId && !guestId) {
      return res
        .status(400)
        .json({ success: false, message: "Link to a reservation or guest is required." });
    }

    const numericAmount = Number(amount) || 0;

    // 1) Create the ledger entry
    const transaction = await Transaction.create({
      reservation: reservationId || null,
      guest: guestId || null,
      amount: numericAmount,
      type,
      paymentMethod,
      referenceId,
      description,
      recordedBy: req.user.userId,
    });

    // 2) If this is for a GUEST, update their invoice
    if (guestId) {
      const invoice = await Invoice.findOne({ guest: guestId });

      if (invoice) {
        // Ensure we are working with numbers
        const grandTotal =
          typeof invoice.grandTotal === "number" ? invoice.grandTotal : Number(invoice.grandTotal) || 0;
        let paidSoFar =
          typeof invoice.advanceAdjusted === "number"
            ? invoice.advanceAdjusted
            : Number(invoice.advanceAdjusted) || 0;

        if (type === "payment") {
          // Guest is giving money now → increase paid amount
          paidSoFar += numericAmount;
        } else if (type === "refund") {
          // Hotel is giving money back → decrease paid amount (but not below 0)
          paidSoFar = Math.max(0, paidSoFar - numericAmount);
        }

        invoice.advanceAdjusted = paidSoFar;

        // Recalculate balance: how much still owed = Bill - Money we hold
        let newBalance = grandTotal - paidSoFar;
        if (newBalance < 0) newBalance = 0;

        invoice.balanceDue = newBalance;
        invoice.status = newBalance === 0 ? "paid" : "pending";

        await invoice.save();
      }
    }

    return res.status(201).json({
      success: true,
      message: "Transaction recorded",
      data: transaction,
    });
  } catch (err) {
    console.error("addTransaction Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.getTransactionsBySource = async (req, res) => {
  try {
    const { reservationId, guestId } = req.query;

    const query = {};
    if (reservationId) query.reservation = reservationId;
    if (guestId) query.guest = guestId;

    const list = await Transaction.find(query)
      .populate("recordedBy", "name")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: list.length, data: list });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
