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
const { createGuestService, checkoutGuestService, extendStayService } = require("../service/guestService");


exports.createGuest = async (req, res) => {
  try {
    const result = await createGuestService(req.body, req.user, {
      Cookie: req.headers.cookie,
      Authorization: req.headers.authorization,
    });
    return res.status(201).json({
      success: true,
      message: "Guest checked in successfully",
      data: result,
    });
  } catch (err) {
    console.error("createGuest Error:", err);
    const statusCode = err.statusCode || 500;
    if (statusCode < 500) {
      return res.status(statusCode).json({ success: false, message: err.message });
    }
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
    const reservation = await Reservation.findOne({ guest: guest._id });

    res.status(200).json({
      data: {
        guest,
        invoice: invoice || null,
        reservation: reservation || null,
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
    const result = await checkoutGuestService(id, req.user);
    return res.status(200).json({
      success: true,
      message: "Guest checked out",
      data: result,
    });
  } catch (err) {
    console.error("checkoutGuest Error:", err);
    const statusCode = err.statusCode || 500;
    if (statusCode < 500) {
      return res.status(statusCode).json({ success: false, message: err.message });
    }
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
    const result = await extendStayService(id, req.body);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error("extendStay Error:", err);
    const statusCode = err.statusCode || 500;
    if (statusCode < 500) {
      return res.status(statusCode).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.getCheckedOutGuestsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and End date are required. Format: YYYY-MM-DD",
      });
    }

    // Construct dates using UTC+5 offset explicitly
    const start = new Date(`${startDate}T00:00:00.000+05:00`);
    const end = new Date(`${endDate}T23:59:59.999+05:00`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    const guests = await Guest.find({
      status: "checked-out",
      checkOutAt: { $gte: start, $lte: end },
    })
      .select("fullName checkInAt checkOutAt room status")
      .populate("room", "roomNumber category")
      .sort({ checkOutAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: guests.length,
      data: guests,
    });
  } catch (err) {
    console.error("getCheckedOutGuestsByDateRange Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
