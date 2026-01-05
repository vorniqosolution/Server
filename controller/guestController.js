const mongoose = require("mongoose");
const axios = require("axios");
const Guest = require("../model/guest");
const Room = require("../model/room");
const Discount = require("../model/discount");
const Invoice = require("../model/invoice");
const Setting = require("../model/Setting");
const Reservation = require("../model/reservationmodel");
const DecorOrder = require("../model/decorOrder");
const DecorPackage = require("../model/decorPackage");
const InventoryItem = require("../model/inventoryItem");
const InventoryTransaction = require("../model/inventoryTransaction");
const Transaction = require("../model/transactions");
const { checkRoomAvailability, calculateNights } = require("../utils/roomUtils");
const { updateMattressCharges } = require("../utils/invoiceUtils");


exports.createGuest = async (req, res) => {
  try {
    let {
      fullName,
      address,
      phone,
      cnic,
      email,
      roomNumber,
      adults = 1,
      infants = 0,
      extraMattresses = 0,
      checkInDate,
      checkOutDate,
      paymentMethod,
      applyDiscount = false,
      additionaldiscount = 0,
      reservationId,
      // For Walk-ins who buy decor immediately at desk
      decorPackageid,
    } = req.body;

    // Helper: Calculate free mattresses based on room category and bed type
    // SOP: Presidential/Duluxe-Plus/Deluxe/Executive: One Bed=1, Two Bed=2
    //      Standard (Studio): 0 free
    const getFreeMattresses = (category, bedType) => {
      const isTwoBed = bedType === "Two Bed";
      switch (category) {
        case "Presidential":
        case "Duluxe-Plus":
        case "Deluxe":
        case "Executive":
          return isTwoBed ? 2 : 1;
        case "Standard":
        default:
          return 0;
      }
    };

    // --- 1. VALIDATIONS ---
    if (!checkInDate || !checkOutDate)
      return res
        .status(400)
        .json({ success: false, message: "Check-in/out dates required." });

    const checkInMoment = new Date();
    const checkInTimeStr = checkInMoment.toTimeString().slice(0, 5);
    const checkIn = new Date(`${checkInDate}T${checkInTimeStr}:00.000`);
    const checkOut = new Date(`${checkOutDate}T00:00:00.000Z`);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()))
      return res
        .status(400)
        .json({ success: false, message: "Invalid dates." });
    if (checkOut <= checkIn)
      return res
        .status(400)
        .json({ success: false, message: "Check-out must be after check-in." });

    const today = new Date();
    const checkInDay = new Date(checkInDate);
    today.setUTCHours(0, 0, 0, 0);
    checkInDay.setUTCHours(0, 0, 0, 0);

    // Block future check-in dates (use Reservations for future bookings)
    if (checkInDay.getTime() > today.getTime())
      return res
        .status(400)
        .json({ success: false, message: "Cannot check-in for a future date. Please use Reservations for future bookings." });

    const room = await Room.findOne({ roomNumber });
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });

    // Maintenance always blocks
    if (room.status === "maintenance")
      return res
        .status(400)
        .json({ success: false, message: "Room is under maintenance." });

    // For occupied rooms, check if there's an actual guest overlap
    if (room.status === "occupied") {
      // Find any guest currently occupying this room whose dates overlap
      const overlappingGuest = await Guest.findOne({
        room: room._id,
        status: "checked-in",
        // Check for date overlap: existing guest's checkout > new checkin AND existing guest's checkin < new checkout
        checkOutAt: { $gt: checkIn },
        checkInAt: { $lt: checkOut }
      });

      if (overlappingGuest) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Room is occupied from ${new Date(overlappingGuest.checkInAt).toLocaleDateString()} to ${new Date(overlappingGuest.checkOutAt).toLocaleDateString()}.`
          });
      }
    }

    // Capacity Check
    if (room.adults < adults)
      return res
        .status(400)
        .json({ success: false, message: "Adult capacity exceeded." });
    const roomMaxInfants = room.infants || 0;
    if (roomMaxInfants < infants)
      return res
        .status(400)
        .json({ success: false, message: "Infant capacity exceeded." });

    // Reservation Overlap Check
    const blockingReservation = await Reservation.findOne({
      room: room._id,
      status: { $in: ["reserved", "confirmed"] },
      startAt: { $lte: checkInDay },
      endAt: { $gt: checkInDay },
    });

    if (
      blockingReservation &&
      (!reservationId || blockingReservation._id.toString() !== reservationId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Room is reserved for another guest.",
      });
    }

    let advanceFromReservation = 0;

    if (reservationId) {
      // Fetch all transactions linked to this Reservation ID
      const txHistory = await Transaction.find({ reservation: reservationId });

      // Calculate the Net Balance (Money In - Money Out)
      txHistory.forEach((tx) => {
        if (tx.type === "advance") advanceFromReservation += tx.amount;
        if (tx.type === "refund") advanceFromReservation -= tx.amount;
      });

      // Safety: Ensure we don't carry over a negative number
      advanceFromReservation = Math.max(0, advanceFromReservation);
    }
    // 👆 --------------------- 👆

    // --- 2. CALCULATE BASE ROOM CHARGES ---
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    const settings = await Setting.findById("global_settings").lean();
    const taxRate = Number(settings?.taxRate ?? 0);
    const mattressRate = Number(settings?.mattressRate ?? 1500);
    const rate = Number(room.rate) || 0;
    const roomTotal = rate * nights;

    // --- MATTRESS CALCULATIONS ---
    const requestedMattresses = Math.min(Math.max(0, Number(extraMattresses) || 0), 4);
    const freeMattresses = getFreeMattresses(room.category, room.bedType);
    const chargeableMattresses = Math.max(0, requestedMattresses - freeMattresses);
    const mattressCharges = chargeableMattresses * mattressRate;

    // --- 3. CREATE GUEST ---
    const guest = await Guest.create({
      fullName,
      address,
      phone,
      cnic,
      email,
      room: room._id,
      adults,
      infants,
      extraMattresses: requestedMattresses,
      checkInAt: checkIn,
      checkInTime: checkInTimeStr,
      checkOutAt: checkOut,
      stayDuration: nights,
      paymentMethod,
      applyDiscount,
      totalRent: 0,
      gst: 0,
      additionaldiscount: 0, // Will update these after calculating decor
      createdBy: req.user.userId,
      advancePayment: advanceFromReservation,
    });

    // Lock Room
    room.status = "occupied";
    await room.save();

    // Link Reservation if exists
    if (reservationId) {
      await Reservation.findByIdAndUpdate(reservationId, {
        status: "checked-in",
        guest: guest._id,
      });
    }

    // --- 4. PREPARE INVOICE ITEMS (THE UNIFIED LOGIC) ---
    const invoiceItems = [
      {
        description: `Room Rent (${room.category} - #${room.roomNumber})`,
        quantity: nights,
        unitPrice: rate,
        total: roomTotal,
      },
    ];

    // Add mattress charges if applicable
    if (chargeableMattresses > 0) {
      invoiceItems.push({
        description: `Extra Mattresses`,
        quantity: chargeableMattresses,
        unitPrice: mattressRate,
        total: mattressCharges,
      });
    }

    let decorTotal = 0;

    // SCENARIO A: Walk-In Guest buys Decor NOW
    if (decorPackageid) {
      const decorPkg = await DecorPackage.findById(decorPackageid).populate(
        "inventoryRequirements.item"
      );
      if (decorPkg) {
        // Add to List
        invoiceItems.push({
          description: `Decor: ${decorPkg.title}`,
          quantity: 1,
          unitPrice: decorPkg.price,
          total: decorPkg.price,
        });
        decorTotal += decorPkg.price;

        // Create Billed Order
        await DecorOrder.create({
          package: decorPkg._id,
          guest: guest._id,
          price: decorPkg.price,
          status: "billed",
          createdBy: req.user.userId,
        });

        // Deduct Inventory
        for (const reqItem of decorPkg.inventoryRequirements) {
          if (reqItem.item) {
            await InventoryTransaction.create({
              item: reqItem.item._id,
              transactionType: "usage",
              quantity: reqItem.quantity,
              reason: `Decor (Walk-in): ${decorPkg.title}`,
              createdBy: req.user.userId,
            });
            await InventoryItem.findByIdAndUpdate(reqItem.item._id, {
              $inc: { quantityOnHand: -reqItem.quantity },
            });
          }
        }
      }
    }

    // SCENARIO B: Reservation Guest has PRE-BOOKED Decor
    if (reservationId) {
      const pendingOrders = await DecorOrder.find({
        reservation: reservationId,
        status: "pending",
      }).populate("package");

      for (const order of pendingOrders) {
        if (!order.package) continue;

        // Add to List
        invoiceItems.push({
          description: `Pre-booked Decor: ${order.package.title}`,
          quantity: 1,
          unitPrice: order.price,
          total: order.price,
        });
        decorTotal += order.price;

        // Link to Guest & Bill
        order.guest = guest._id;
        order.status = "billed";
        await order.save();

        // Deduct Inventory
        const fullPkg = await DecorPackage.findById(order.package._id).populate(
          "inventoryRequirements.item"
        );
        if (fullPkg && fullPkg.inventoryRequirements) {
          for (const reqItem of fullPkg.inventoryRequirements) {
            if (reqItem.item) {
              await InventoryTransaction.create({
                item: reqItem.item._id,
                transactionType: "usage",
                quantity: reqItem.quantity,
                reason: `Decor (Resv): ${fullPkg.title}`,
                createdBy: req.user.userId,
              });
              await InventoryItem.findByIdAndUpdate(reqItem.item._id, {
                $inc: { quantityOnHand: -reqItem.quantity },
              });
            }
          }
        }
      }
    }

    // --- 5. FINAL CALCULATIONS (Using new totals) ---
    const finalSubtotal = roomTotal + decorTotal + mattressCharges;

    // Discounts - Additional discount can apply to full subtotal
    const discountAmtNum = Math.min(
      Math.max(0, Number(additionaldiscount) || 0),
      finalSubtotal
    );

    // Standard discount (percentage) applies ONLY to room rent, not extras
    let stdPct = 0;
    let discountTitle = null;
    if (applyDiscount) {
      const validDiscount = await Discount.findOne({
        startDate: { $lte: today },
        endDate: { $gte: today },
      });
      if (validDiscount) {
        stdPct = Number(validDiscount.percentage) || 0;
        discountTitle = validDiscount.title;
      }
    }
    // Apply standard discount ONLY to room total (not mattresses, decor)
    const stdDiscountAmt = Math.round(roomTotal * (stdPct / 100));

    const invoiceSubtotalBeforeTax = Math.max(
      0,
      finalSubtotal - stdDiscountAmt - discountAmtNum
    );
    const invoiceGstAmount = Math.round(
      (invoiceSubtotalBeforeTax * taxRate) / 100
    );
    const invoiceGrandTotal = invoiceSubtotalBeforeTax + invoiceGstAmount;

    const balanceDue = Math.max(0, invoiceGrandTotal - advanceFromReservation);

    // Update Guest record with final money stats
    guest.totalRent = invoiceGrandTotal;
    guest.gst = invoiceGstAmount;
    guest.additionaldiscount = discountAmtNum;
    guest.discountTitle = discountTitle;
    await guest.save();

    // --- 6. CREATE INVOICE ---
    await Invoice.create({
      invoiceNumber: `HSQ-${Date.now()}`,
      guest: guest._id,
      items: invoiceItems, // <--- Contains both Room & Decor items

      subtotal: finalSubtotal,
      discountAmount: stdDiscountAmt,
      additionaldiscount: discountAmtNum,
      taxRate,
      taxAmount: invoiceGstAmount,
      grandTotal: invoiceGrandTotal,

      // 👇 PASTE THESE LINES HERE (To Save to Invoice) 👇
      advanceAdjusted: advanceFromReservation,
      balanceDue: balanceDue,
      status: balanceDue === 0 ? "paid" : "pending",
      // 👆 ------------------------------------------ 👆

      dueDate: checkOut,
      // status: "pending",
      createdBy: req.user.userId,
      checkInAt: guest.checkInAt,
      guestDetails: {
        fullName: guest.fullName,
        phone: guest.phone,
        cnic: guest.cnic,
        adults: guest.adults,
        infants: guest.infants,
      },
      roomDetails: {
        roomNumber: room.roomNumber,
        category: room.category,
      },
    });

    // --- 7. EXTERNAL SYNC ---
    try {
      await axios.post(
        `${process.env.API_BASE_URL}/api/inventory/checkin`,
        {
          roomId: room._id,
          guestId: guest._id,
          source: reservationId ? "reservation" : "walkin",
        },
        {
          headers: {
            Cookie: req.headers.cookie,
            Authorization: req.headers.authorization,
          },
        }
      );
    } catch (invErr) {
      console.error("Auto-Inventory failed:", invErr?.message);
    }

    return res.status(201).json({
      success: true,
      message: "Guest checked in successfully",
      data: { guest },
    });
  } catch (err) {
    console.error("createGuest Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.getGuests = async (req, res) => {
  try {
    const guests = await Guest.find()
      // pull in roomNumber, bedType, rate and status
      .populate("room", "roomNumber bedType category rate status view")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
    return res.status(200).json({ guests });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

exports.getGuestById = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id)
      .populate("room", "roomNumber bedType category rate status view")
      .populate("createdBy", "name email");

    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    const invoice = await Invoice.findOne({ guest: guest._id });

    res.status(200).json({
      data: {
        guest,
        invoice: invoice || null,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

exports.checkoutGuest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid guest ID" });
    }

    const guest = await Guest.findById(id);
    if (!guest) {
      return res.status(404).json({ success: false, message: "Guest not found" });
    }
    if (guest.status === "checked-out") {
      return res.status(400).json({ success: false, message: "Guest already checked out" });
    }

    // 1. Mark checkout timestamp
    const now = new Date();
    guest.checkOutAt = now;
    guest.checkOutTime = now.toTimeString().slice(0, 5);
    guest.status = "checked-out";

    // 2. Recalculate Actual Stay Duration
    const inMs = guest.checkInAt.getTime();
    const outMs = now.getTime();
    // Ensure at least 1 day counts even if checking out same day
    const calculatedNights = Math.ceil((outMs - inMs) / (1000 * 60 * 60 * 24));
    guest.stayDuration = calculatedNights > 0 ? calculatedNights : 1;

    await guest.save();

    // 3. Free up the room
    const room = await Room.findById(guest.room);
    if (room) {
      room.status = "available";
      await room.save();
    }

    // 4. Update Reservation Status
    await Reservation.findOneAndUpdate(
      { guest: id },
      { $set: { status: "checked-out" } },
      { new: true }
    );

    // ============================================================
    // 👇 NEW LOGIC: RECALCULATE INVOICE FOR ACTUAL STAY 👇
    // ============================================================
    let refundDue = 0;
    const invoice = await Invoice.findOne({ guest: guest._id });

    if (invoice && invoice.items && invoice.items.length > 0) {
      // Assume first item is Room Rent
      const roomLine = invoice.items[0];
      const originalNights = Number(roomLine.quantity) || 1;
      const actualNights = guest.stayDuration;

      // Only recalculate if the nights have changed (Early Checkout or Extension)
      if (actualNights !== originalNights) {
        const ratio = actualNights / originalNights;

        // Helper to ensure numbers
        const getNum = (val) => (typeof val === 'number' ? val : Number(val) || 0);

        const originalSubtotal = getNum(invoice.subtotal);
        const originalStdDiscount = getNum(invoice.discountAmount);
        const extraDiscount = getNum(invoice.additionaldiscount); // Flat amount, doesn't scale
        const taxRate = getNum(invoice.taxRate);

        // A. Scale the Room Price & % Discount
        const newSubtotal = Math.round(originalSubtotal * ratio);
        const newStdDiscount = Math.round(originalStdDiscount * ratio);

        // B. Calculate New Tax & Total
        // Formula: (Room - StdDisc - FlatDisc) * Tax
        const taxableAmount = Math.max(0, newSubtotal - newStdDiscount - extraDiscount);
        const newTaxAmount = Math.round((taxableAmount * taxRate) / 100);
        const newGrandTotal = taxableAmount + newTaxAmount;

        // C. Update Invoice Fields
        roomLine.quantity = actualNights;
        roomLine.total = newSubtotal; // Update line item total

        invoice.subtotal = newSubtotal;
        invoice.discountAmount = newStdDiscount;
        // invoice.additionaldiscount remains unchanged (it's flat)
        invoice.taxAmount = newTaxAmount;
        invoice.grandTotal = newGrandTotal;

        // D. Recalculate Balance based on what they ALREADY PAID
        const paidSoFar = getNum(invoice.advanceAdjusted);

        let rawBalance = newGrandTotal - paidSoFar;

        if (rawBalance < 0) {
          // Negative balance means we owe them money (Refund)
          refundDue = Math.abs(rawBalance);
          invoice.balanceDue = 0; // They owe nothing
        } else {
          refundDue = 0;
          invoice.balanceDue = rawBalance; // They still owe some amount
        }

        invoice.status = invoice.balanceDue === 0 ? "paid" : "pending";

        // Mark items modified so Mongoose saves the array update
        invoice.markModified('items');
        await invoice.save();
      }
    }
    // ============================================================

    // 5. Notify Inventory
    try {
      await axios.post(
        `${process.env.API_BASE_URL}/api/inventory/checkout`,
        { roomId: guest.room, guestId: guest._id },
        { headers: { Cookie: req.headers.cookie } }
      );
    } catch (invErr) {
      console.error("Inventory check-out failed:", invErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Guest checked out",
      data: { guest, refundDue } // Send refund amount to frontend just in case
    });

  } catch (err) {
    console.error("checkoutGuest Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.deleteGuest = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);

    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    const room = await Room.findById(guest.room);

    if (room) {
      await Room.findByIdAndUpdate(room._id, { status: "available" });
    }
    await Guest.findByIdAndDelete(req.params.id);

    return res.json({
      message: "Guest deleted successfully, room status updated",
    });
  } catch (err) {
    console.error("deleteGuest Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

exports.UpdateGuestById = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      email,
      phone,
      cnic,
      paymentMethod,
      address,
      adults,
      infants,
      extraMattresses,
    } = req.body;

    // First, get the original guest to compare mattress count
    const originalGuest = await Guest.findById(id).populate('room');
    if (!originalGuest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    const oldMattresses = originalGuest.extraMattresses || 0;
    const newMattresses = extraMattresses !== undefined
      ? Math.min(Math.max(0, Number(extraMattresses) || 0), 4)
      : oldMattresses;
    const mattressesChanged = newMattresses !== oldMattresses;

    // Update guest record
    const updatedGuest = await Guest.findByIdAndUpdate(
      id,
      {
        fullName: fullName,
        email: email,
        phone: phone,
        cnic: cnic,
        paymentMethod: paymentMethod,
        address: address,
        ...(adults !== undefined && { adults }),
        ...(infants !== undefined && { infants }),
        ...(extraMattresses !== undefined && { extraMattresses: newMattresses }),
      },
      { new: true, runValidators: true }
    ).populate('room');

    if (!updatedGuest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    // If mattresses changed, recalculate invoice
    let invoiceUpdateResult = null;
    if (mattressesChanged && updatedGuest.room) {
      invoiceUpdateResult = await updateMattressCharges(
        id,
        newMattresses,
        updatedGuest.room
      );

      if (!invoiceUpdateResult.success) {
        console.warn("Invoice update warning:", invoiceUpdateResult.message);
      }
    }

    return res.status(200).json({
      message: "Guest updated successfully",
      data: updatedGuest,
      invoiceUpdated: mattressesChanged && invoiceUpdateResult?.success,
      invoiceMessage: invoiceUpdateResult?.message
    });
  } catch (error) {
    console.error("UpdateGuestById Error:", error);
    return res.status(500).json({
      message: "Internal server error while updating guest",
      error: error.message,
    });
  }
};

exports.getGuestActivityByDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required. Format: YYYY-MM-DD",
      });
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const queries = {
      checkIns: Guest.find({
        checkInAt: { $gte: dayStart, $lte: dayEnd },
      })
        .populate("room", "roomNumber category")
        .lean(),

      checkOuts: Guest.find({
        status: "checked-out",
        checkOutAt: { $gte: dayStart, $lte: dayEnd },
      })
        .populate("room", "roomNumber category")
        .lean(),
    };

    // Execute both queries in parallel for speed
    const [checkIns, checkOuts] = await Promise.all(Object.values(queries));

    // Prepare the data payload with categorized lists
    const responseData = {
      checkIns,
      checkOuts,
    };

    // Prepare the summary with the counts
    const summary = {
      checkIns: checkIns.length,
      checkOuts: checkOuts.length,
    };

    res.status(200).json({ success: true, date, summary, data: responseData });
  } catch (err) {
    console.error("Error in getGuestActivityByDate:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.extendStay = async (req, res) => {
  try {
    const { id } = req.params;
    const { newCheckoutDate, additionalDiscount = 0, applyStandardDiscount = true } = req.body;

    // Validate guest ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid guest ID"
      });
    }

    // Validate new checkout date provided
    if (!newCheckoutDate) {
      return res.status(400).json({
        success: false,
        message: "New checkout date is required"
      });
    }

    // Find the guest
    const guest = await Guest.findById(id).populate("room");
    if (!guest) {
      return res.status(404).json({
        success: false,
        message: "Guest not found"
      });
    }

    // Must be checked-in to extend
    if (guest.status !== "checked-in") {
      return res.status(400).json({
        success: false,
        message: "Can only extend stay for checked-in guests"
      });
    }

    const newCheckout = new Date(newCheckoutDate);
    const currentCheckout = new Date(guest.checkOutAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate new checkout is in the future
    if (newCheckout <= today) {
      return res.status(400).json({
        success: false,
        message: "New checkout date must be in the future"
      });
    }

    // Validate new checkout is after current checkout
    if (newCheckout <= currentCheckout) {
      return res.status(400).json({
        success: false,
        message: "New checkout date must be after current checkout date",
        currentCheckout: currentCheckout
      });
    }

    // Check for conflicts (from current checkout to new checkout)
    const availability = await checkRoomAvailability(
      guest.room._id,
      currentCheckout,
      newCheckout,
      { excludeGuestId: id }
    );

    if (!availability.available) {
      return res.status(409).json({
        success: false,
        message: "Cannot extend: Room has conflicting bookings",
        conflicts: availability.conflicts
      });
    }

    // Calculate additional nights
    const additionalNights = calculateNights(currentCheckout, newCheckout);
    const originalNights = guest.stayDuration;
    const newTotalNights = originalNights + additionalNights;

    // Get room rate for invoice calculation
    const room = guest.room;
    const nightlyRate = room.rate || 0;
    const additionalRentBeforeDiscount = additionalNights * nightlyRate;

    // Update guest record
    guest.checkOutAt = newCheckout;
    guest.stayDuration = newTotalNights;
    await guest.save();

    // Update invoice if exists
    const invoice = await Invoice.findOne({ guest: id });
    let discountInfo = { stdDiscountPct: 0, stdDiscountAmt: 0, addlDiscountAmt: 0, netAdditionalRent: additionalRentBeforeDiscount };

    if (invoice) {
      // Calculate the standard discount percentage
      // For extended stay, we need to apply the same percentage that was used at check-in
      // The discount should only apply to room rent, not extras
      let stdDiscountPct = 0;

      // Check if guest originally had discount applied
      if (guest.applyDiscount) {
        // Try to get the original discount percentage from invoice
        // We need to calculate it from room-only portion
        const roomRentItem = invoice.items.find(item =>
          item.description && item.description.includes('Room Rent')
        );

        if (roomRentItem && roomRentItem.total > 0) {
          const originalRoomTotal = roomRentItem.total;
          const originalStdDiscount = invoice.discountAmount || 0;

          // If there was a discount, calculate the percentage from room total
          if (originalStdDiscount > 0) {
            // Discount was applied to roomTotal, so: stdDiscountAmt = roomTotal * (pct/100)
            // Therefore: pct = (stdDiscountAmt / roomTotal) * 100
            stdDiscountPct = (originalStdDiscount / originalRoomTotal) * 100;
          }
        }
      }

      // Apply standard discount only if flag is true
      const extendedStdDiscount = applyStandardDiscount
        ? Math.round(additionalRentBeforeDiscount * (stdDiscountPct / 100))
        : 0;

      // Use user-provided additional discount (sanitize it)
      const extendedAddlDiscount = Math.max(0, Math.round(Number(additionalDiscount) || 0));

      // Net additional rent after discounts
      const netAdditionalRent = Math.max(0, additionalRentBeforeDiscount - extendedStdDiscount - extendedAddlDiscount);

      // Store discount info for response
      discountInfo = {
        stdDiscountPct: applyStandardDiscount ? Math.round(stdDiscountPct * 100) / 100 : 0,
        stdDiscountAmt: extendedStdDiscount,
        addlDiscountAmt: extendedAddlDiscount,
        netAdditionalRent: netAdditionalRent
      };

      // Add line item for extended nights (showing GROSS price, discounts applied separately)
      invoice.items.push({
        description: `Extended Stay (${additionalNights} night${additionalNights > 1 ? 's' : ''})`,
        quantity: additionalNights,
        unitPrice: nightlyRate,
        total: additionalRentBeforeDiscount, // GROSS amount before discounts
      });

      // Update discount amounts
      invoice.discountAmount = (invoice.discountAmount || 0) + extendedStdDiscount;
      invoice.additionaldiscount = (invoice.additionaldiscount || 0) + extendedAddlDiscount;

      // Recalculate totals - subtotal is GROSS (before discounts)
      invoice.subtotal = (invoice.subtotal || 0) + additionalRentBeforeDiscount;

      // Calculate total discounts
      const totalDiscounts = (invoice.discountAmount || 0) + (invoice.additionaldiscount || 0);

      // Grand total = subtotal - all discounts + tax
      const subtotalAfterDiscounts = Math.max(0, invoice.subtotal - totalDiscounts);
      invoice.taxAmount = Math.round(subtotalAfterDiscounts * (invoice.taxRate / 100));
      invoice.grandTotal = subtotalAfterDiscounts + invoice.taxAmount;

      // Recalculate balance due
      const paidAmount = invoice.advanceAdjusted || guest.advancePayment || 0;
      invoice.balanceDue = Math.max(0, invoice.grandTotal - paidAmount);

      await invoice.save();
    }

    res.status(200).json({
      success: true,
      message: `Stay extended by ${additionalNights} night(s)`,
      data: {
        guest: {
          _id: guest._id,
          fullName: guest.fullName,
          originalCheckout: currentCheckout,
          newCheckout: newCheckout,
          originalNights: originalNights,
          additionalNights: additionalNights,
          newTotalNights: newTotalNights,
        },
        charges: {
          nightlyRate: nightlyRate,
          grossAmount: additionalRentBeforeDiscount,
          standardDiscountPct: discountInfo.stdDiscountPct,
          standardDiscountAmt: discountInfo.stdDiscountAmt,
          additionalDiscountAmt: discountInfo.addlDiscountAmt,
          netAmount: discountInfo.netAdditionalRent,
        },
        invoice: invoice ? {
          invoiceNumber: invoice.invoiceNumber,
          newGrandTotal: invoice.grandTotal,
          newBalanceDue: invoice.balanceDue,
        } : null
      }
    });

  } catch (err) {
    console.error("extendStay Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
