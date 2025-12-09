const Guest = require("../model/guest");
const Room = require("../model/room");
const Discount = require("../model/discount");
const Invoice = require("../model/invoice");
const axios = require("axios");
const Setting = require("../model/Setting");
const mongoose = require("mongoose");
const Reservation = require("../model/reservationmodel");

const DecorOrder = require("../model/decorOrder");
const DecorPackage = require("../model/decorPackage");
const InventoryItem = require("../model/inventoryItem");
const InventoryTransaction = require("../model/inventoryTransaction");
const Transaction = require("../model/transactions");

// exports.createGuest = async (req, res) => {
//   try {
//     let {
//       fullName,
//       address,
//       phone,
//       cnic,
//       email,
//       roomNumber,
//       adults = 1,
//       infants = 0,
//       checkInDate,
//       checkOutDate,
//       paymentMethod,
//       applyDiscount = false,
//       additionaldiscount = 0,
//       reservationId,
//     } = req.body;

//     if (!checkInDate || !checkOutDate) {
//       return res.status(400).json({
//         success: false,
//         message: "Check-in and check-out dates are required.",
//       });
//     }

//     // 1. FIX: CAPTURE THE ACTUAL CHECK-IN MOMENT AND TIME STRING
//     const checkInMoment = new Date();
//     const checkInTimeStr = checkInMoment.toTimeString().slice(0, 5);

//     // This format ensures the saved Date object includes the exact time of check-in
//     // instead of midnight UTC, fixing the checkInTime calculation.
//     const checkIn = new Date(`${checkInDate}T${checkInTimeStr}:00.000`);
//     const checkOut = new Date(`${checkOutDate}T00:00:00.000Z`);

//     // Check if the dates are valid after parsing
//     if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid date format. Please use YYYY-MM-DD.",
//       });
//     }

//     if (checkOut <= checkIn) {
//       return res.status(400).json({
//         success: false,
//         message: "Check-out date must be after the check-in date.",
//       });
//     }

//     // 2. ENFORCE "TODAY ONLY" RULE
//     const today = new Date();
//     // Compare only the date part for today's rule
//     const checkInDay = new Date(checkInDate);

//     today.setUTCHours(0, 0, 0, 0);
//     checkInDay.setUTCHours(0, 0, 0, 0);

//     if (checkInDay.getTime() !== today.getTime()) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Guest check-in must be for today's date. For future bookings, please create a reservation.",
//       });
//     }

//     // 3. FIND ROOM AND CHECK CURRENT AVAILABILITY
//     const room = await Room.findOne({ roomNumber });
//     if (!room)
//       return res
//         .status(404)
//         .json({ success: false, message: "Room not found" });
//     if (room.status === "occupied" || room.status === "maintenance") {
//       return res
//         .status(400)
//         .json({ success: false, message: `Room is currently ${room.status}.` });
//     }

//     // --- NEW: Capacity Check Logic ---
//     if (room.adults < adults) {
//         return res.status(400).json({
//             success: false,
//             message: `Capacity exceeded. Room ${roomNumber} allows max ${room.adults} adults.`
//         });
//     }
//     const roomMaxInfants = room.infants || 0;
//     if (roomMaxInfants < infants) {
//         return res.status(400).json({
//             success: false,
//             message: `Capacity exceeded. Room ${roomNumber} allows max ${roomMaxInfants} infants.`
//         });
//     }

//     const blockingReservation = await Reservation.findOne({
//       room: room._id,
//       status: { $in: ["reserved", "confirmed"] },
//       startAt: { $lte: checkInDay }, // Use the date part for comparison
//       endAt: { $gt: checkInDay },
//     });

//     if (
//       blockingReservation &&
//       (!reservationId || blockingReservation._id.toString() !== reservationId)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Room is reserved for another guest today. Please check in via the reservation.",
//       });
//     }

//     // --- FROM HERE, THE REST OF THE LOGIC IS UNCHANGED ---
//     const nights = Math.ceil(
//       (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
//     );
//     const settings = await Setting.findById("global_settings").lean();
//     const taxRate = Number(settings?.taxRate ?? 0);
//     const rate = Number(room.rate) || 0;
//     const roomTotal = rate * nights;

//     const additionalDiscountAmount = Math.min(
//       Math.max(0, Number(additionaldiscount) || 0),
//       roomTotal
//     );
//     let stdPct = 0;
//     let discountTitle = null;

//     if (applyDiscount) {
//       const validDiscount = await Discount.findOne({
//         startDate: { $lte: today },
//         endDate: { $gte: today },
//       });
//       if (!validDiscount)
//         return res.status(400).json({
//           success: false,
//           message: "No valid discount is available for today.",
//         });
//       stdPct = Number(validDiscount.percentage) || 0;
//       discountTitle = validDiscount.title;
//     }
//     const standardDiscountAmount = Math.round(roomTotal * (stdPct / 100));
//     const subtotalBeforeTax = Math.max(
//       0,
//       roomTotal - standardDiscountAmount - additionalDiscountAmount
//     );
//     const gstAmount = Math.round((subtotalBeforeTax * taxRate) / 100);
//     const totalRent = subtotalBeforeTax + gstAmount;

//     const guest = await Guest.create({
//       fullName,
//       address,
//       phone,
//       cnic,
//       email,
//       room: room._id,
//       // Save data
//       adults,
//       infants,
//       // ---------
//       checkInAt: checkIn,
//       checkInTime: checkInTimeStr, // FIX: Explicitly set the correct time string
//       checkOutAt: checkOut,
//       stayDuration: nights,
//       paymentMethod,
//       applyDiscount,
//       discountTitle,
//       totalRent,
//       gst: gstAmount,
//       additionaldiscount: additionalDiscountAmount,
//       createdBy: req.user.userId,
//     });

//     room.status = "occupied";
//     await room.save();

//     if (reservationId)
//       await Reservation.findByIdAndUpdate(reservationId, {
//         status: "checked-in",
//         guest: guest._id,
//       });

//     await Invoice.create({
//       invoiceNumber: `HSQ-${Date.now()}`,
//       guest: guest._id,
//       items: [
//         {
//           description: `Room Rent (${room.category} - #${room.roomNumber})`,
//           quantity: nights,
//           unitPrice: rate,
//           total: roomTotal,
//         },
//       ],
//       subtotal: roomTotal,
//       discountAmount: standardDiscountAmount,
//       additionaldiscount: additionalDiscountAmount,
//       taxRate,
//       taxAmount: gstAmount,
//       grandTotal: totalRent,
//       dueDate: checkOut,
//       status: "pending",
//       createdBy: req.user.userId,
//       checkInAt: guest.checkInAt,
//       guestDetails: {
//         fullName: guest.fullName,
//         phone: guest.phone,
//         cnic: guest.cnic,
//         adults: guest.adults,
//         infants: guest.infants
//       },
//       roomDetails: {
//         roomNumber: room.roomNumber,
//         category: room.category,
//       },
//     });

//     try {
//       await axios.post(
//         `${process.env.API_BASE_URL}/api/inventory/checkin`,
//         {
//           roomId: room._id,
//           guestId: guest._id,
//           source: reservationId ? "reservation" : "walkin",
//         },
//         {
//           headers: {
//             Cookie: req.headers.cookie,
//             Authorization: req.headers.authorization,
//           },
//         }
//       );
//     } catch (invErr) {
//       console.error("Inventory check-in failed:", invErr?.message);
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Guest checked in successfully",
//       data: { guest },
//     });
//   } catch (err) {
//     console.error("createGuest Error:", err);
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error", error: err.message });
//   }
// };

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
      checkInDate,
      checkOutDate,
      paymentMethod,
      applyDiscount = false,
      additionaldiscount = 0,
      reservationId,
      // For Walk-ins who buy decor immediately at desk
      decorPackageId,
    } = req.body;

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

    if (checkInDay.getTime() !== today.getTime())
      return res
        .status(400)
        .json({ success: false, message: "Check-in must be for today." });

    const room = await Room.findOne({ roomNumber });
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    if (room.status === "occupied" || room.status === "maintenance")
      return res
        .status(400)
        .json({ success: false, message: `Room is ${room.status}.` });

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
      return res
        .status(400)
        .json({
          success: false,
          message: "Room is reserved for another guest.",
        });
    }

    // 👇 PASTE THIS BLOCK HERE 👇
    // ============================================================
    // NEW LOGIC: CHECK RESERVATION WALLET
    // ============================================================
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
    const rate = Number(room.rate) || 0;
    const roomTotal = rate * nights;

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

    let decorTotal = 0;

    // SCENARIO A: Walk-In Guest buys Decor NOW
    if (decorPackageId) {
      const decorPkg = await DecorPackage.findById(decorPackageId).populate(
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
    const finalSubtotal = roomTotal + decorTotal;

    // Discounts
    const discountAmtNum = Math.min(
      Math.max(0, Number(additionaldiscount) || 0),
      finalSubtotal
    );
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
    const stdDiscountAmt = Math.round(finalSubtotal * (stdPct / 100));

    const invoiceSubtotalBeforeTax = Math.max(
      0,
      finalSubtotal - stdDiscountAmt - discountAmtNum
    );
    const invoiceGstAmount = Math.round(
      (invoiceSubtotalBeforeTax * taxRate) / 100
    );
    const invoiceGrandTotal = invoiceSubtotalBeforeTax + invoiceGstAmount;

     // 👇 PASTE THIS LINE HERE (To Calculate Balance) 👇
    const balanceDue = Math.max(0, invoiceGrandTotal - advanceFromReservation);
    // 👆 ------------------------------------------- 👆


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

    return res
      .status(201)
      .json({
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid guest ID" });
    }
    const guest = await Guest.findById(id);
    if (!guest) {
      return res
        .status(404)
        .json({ success: false, message: "Guest not found" });
    }
    if (guest.status === "checked-out") {
      return res
        .status(400)
        .json({ success: false, message: "Guest already checked out" });
    }

    // mark checkout timestamp
    const now = new Date();
    guest.checkOutAt = now;
    guest.checkOutTime = now.toTimeString().slice(0, 5);
    guest.status = "checked-out";

    // recalc stay duration
    const inMs = guest.checkInAt.getTime();
    const outMs = now.getTime();
    guest.stayDuration = Math.ceil((outMs - inMs) / (1000 * 60 * 60 * 24));
    await guest.save();

    // free up the room
    const room = await Room.findById(guest.room);
    if (room) {
      room.status = "available";
      await room.save();
    }
    // Change the status in reservation model
    const reservation = await Reservation.findOneAndUpdate(
      { guest: id },
      { $set: { status: "checked-out" } },
      { new: true }
    );
    // Notify Inventory module of check-out
    try {
      await axios.post(
        `${process.env.API_BASE_URL}/api/inventory/checkout`,
        { roomId: guest.room, guestId: guest._id },
        {
          headers: {
            Cookie: req.headers.cookie,
          },
        }
      );
      console.log(
        "Calling Inventory at:",
        `${process.env.API_BASE_URL}/api/inventory/checkout`
      );
    } catch (invErr) {
      console.error("Inventory check-out failed:", invErr.message);
      // Continue without blocking check-out
    }

    return res
      .status(200)
      .json({ success: true, message: "Guest checked out", data: guest });
  } catch (err) {
    console.error("checkoutGuest Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
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
    } = req.body;

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
      },
      { new: true, runValidators: true }
    );

    if (!updatedGuest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    return res.status(200).json({
      message: "Guest updated successfully",
      data: updatedGuest,
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
      return res
        .status(400)
        .json({
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
