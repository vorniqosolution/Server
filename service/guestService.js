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
const PromoCode = require("../model/promoCode");
// Utils
const { checkRoomAvailability, calculateNights } = require("../utils/roomUtils");
const { updateMattressCharges } = require("../utils/invoiceUtils");

exports.createGuestService = async (data, user, headers) => {
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
        decorPackageid,
        promoCode,
    } = data;

    // Helper to throw with status code
    const throwError = (message, status = 400) => {
        const error = new Error(message);
        error.statusCode = status;
        throw error;
    };

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
    if (!checkInDate || !checkOutDate) {
        throwError("Check-in/out dates required.", 400);
    }

    const checkInMoment = new Date();
    const checkInTimeStr = checkInMoment.toTimeString().slice(0, 5);
    const checkIn = new Date(`${checkInDate}T${checkInTimeStr}:00.000`);
    const checkOut = new Date(`${checkOutDate}T00:00:00.000Z`);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
        throwError("Invalid dates.", 400);
    }
    if (checkOut <= checkIn) {
        throwError("Check-out must be after check-in.", 400);
    }

    const today = new Date();
    const checkInDay = new Date(checkInDate);
    today.setUTCHours(0, 0, 0, 0);
    checkInDay.setUTCHours(0, 0, 0, 0);

    // Block future check-in dates (use Reservations for future bookings)
    if (checkInDay.getTime() > today.getTime()) {
        throwError("Cannot check-in for a future date. Please use Reservations for future bookings.", 400);
    }

    const room = await Room.findOne({ roomNumber });
    if (!room) {
        throwError("Room not found", 404);
    }

    // Maintenance always blocks
    if (room.status === "maintenance") {
        throwError("Room is under maintenance.", 400);
    }

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
            throwError(`Room is occupied from ${new Date(overlappingGuest.checkInAt).toLocaleDateString()} to ${new Date(overlappingGuest.checkOutAt).toLocaleDateString()}.`, 400);
        }
    }

    // Capacity Check
    if (room.adults < adults) {
        throwError("Adult capacity exceeded.", 400);
    }
    const roomMaxInfants = room.infants || 0;
    if (roomMaxInfants < infants) {
        throwError("Infant capacity exceeded.", 400);
    }

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
        throwError("Room is reserved for another guest.", 400);
    }

    // --- AUTO-APPLY PROMO FROM RESERVATION ---
    if (reservationId && !promoCode) {
        const linkedRes = await Reservation.findById(reservationId);
        if (linkedRes && linkedRes.promoCode) {
            promoCode = linkedRes.promoCode;
        }
    }
    // -----------------------------------------

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
        createdBy: user.userId,
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
                createdBy: user.userId,
            });

            // Deduct Inventory
            for (const reqItem of decorPkg.inventoryRequirements) {
                if (reqItem.item) {
                    await InventoryTransaction.create({
                        item: reqItem.item._id,
                        transactionType: "usage",
                        quantity: reqItem.quantity,
                        reason: `Decor (Walk-in): ${decorPkg.title}`,
                        createdBy: user.userId,
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
                            createdBy: user.userId,
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

    // --- PROMO CODE LOGIC ---
    let promoDiscountAmt = 0;
    if (promoCode) {
        const promo = await PromoCode.findOne({
            code: promoCode.toUpperCase(),
            status: "active",
            startDate: { $lte: today },
            endDate: { $gte: today },
        });

        if (!promo) {
            throwError("Invalid or expired promo code", 400);
        }

        // Apply Promo % to Room Rent (parallel to standard discount)
        const promoPct = promo.percentage || 0;
        promoDiscountAmt = Math.round(roomTotal * (promoPct / 100));

        // Increment Usage
        await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usageCount: 1 } });
    }
    // ------------------------

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

    // Calculate Taxable Amount (Subtotal - ALL Discounts)
    // Safeguard: Total discount cannot exceed subtotal
    const totalDiscountRaw = stdDiscountAmt + discountAmtNum + promoDiscountAmt;
    const finalTotalDiscount = Math.min(totalDiscountRaw, finalSubtotal);

    const invoiceSubtotalBeforeTax = Math.max(0, finalSubtotal - finalTotalDiscount);

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
    guest.promoCode = promoCode ? promoCode.toUpperCase() : null;
    guest.promoDiscount = promoDiscountAmt;
    await guest.save();

    // --- 6. CREATE INVOICE ---
    await Invoice.create({
        invoiceNumber: `HSQ-${Date.now()}`,
        guest: guest._id,
        items: invoiceItems, // <--- Contains both Room & Decor items

        subtotal: finalSubtotal,
        discountAmount: stdDiscountAmt,
        additionaldiscount: discountAmtNum,
        promoDiscount: promoDiscountAmt,
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
        createdBy: user.userId,
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
                headers: headers
            }
        );
    } catch (invErr) {
        console.error("Auto-Inventory failed:", invErr?.message);
    }

    return { guest };
};

exports.checkoutGuestService = async (guestId, user) => {
    if (!mongoose.Types.ObjectId.isValid(guestId)) {
        const error = new Error("Invalid guest ID");
        error.statusCode = 400;
        throw error;
    }

    const guest = await Guest.findById(guestId);
    if (!guest) {
        const error = new Error("Guest not found");
        error.statusCode = 404;
        throw error;
    }
    if (guest.status === "checked-out") {
        const error = new Error("Guest already checked out");
        error.statusCode = 400;
        throw error;
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
        { guest: guestId },
        { $set: { status: "checked-out" } },
        { new: true }
    );

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
            const originalPromoDiscount = getNum(invoice.promoDiscount); // NEW: Scale promo too
            const extraDiscount = getNum(invoice.additionaldiscount); // Flat amount, doesn't scale
            const taxRate = getNum(invoice.taxRate);

            // A. Scale the Room Price & % Discount
            const newSubtotal = Math.round(originalSubtotal * ratio);
            const newStdDiscount = Math.round(originalStdDiscount * ratio);
            const newPromoDiscount = Math.round(originalPromoDiscount * ratio); // NEW

            // B. Calculate New Tax & Total
            // Formula: (Room - StdDisc - FlatDisc - PromoDisc) * Tax
            const taxableAmount = Math.max(0, newSubtotal - newStdDiscount - extraDiscount - newPromoDiscount);
            const newTaxAmount = Math.round((taxableAmount * taxRate) / 100);
            const newGrandTotal = taxableAmount + newTaxAmount;

            // C. Update Invoice Fields
            roomLine.quantity = actualNights;
            roomLine.total = newSubtotal; // Update line item total

            invoice.subtotal = newSubtotal;
            invoice.discountAmount = newStdDiscount;
            invoice.promoDiscount = newPromoDiscount; // NEW
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

    // 5. Notify Inventory
    try {
        await axios.post(
            `${process.env.API_BASE_URL}/api/inventory/checkout`,
            { roomId: guest.room, guestId: guest._id }
        );
    } catch (invErr) {
        console.error("Inventory check-out failed:", invErr.message);
    }

    return { guest, refundDue };
};

exports.extendStayService = async (guestId, data) => {
    const { newCheckoutDate, additionalDiscount = 0, applyStandardDiscount = true } = data;

    if (!mongoose.Types.ObjectId.isValid(guestId)) {
        const error = new Error("Invalid guest ID");
        error.statusCode = 400;
        throw error;
    }

    if (!newCheckoutDate) {
        const error = new Error("New checkout date is required");
        error.statusCode = 400;
        throw error;
    }

    const guest = await Guest.findById(guestId).populate("room");
    if (!guest) {
        const error = new Error("Guest not found");
        error.statusCode = 404;
        throw error;
    }

    if (guest.status === "checked-out") {
        const error = new Error("Cannot extend stay for checked-out guest");
        error.statusCode = 400;
        throw error;
    }

    const currentCheckout = new Date(guest.checkOutAt);
    const newCheckout = new Date(`${newCheckoutDate}T00:00:00.000Z`); // UTC midnight

    if (isNaN(newCheckout.getTime())) {
        const error = new Error("Invalid date format");
        error.statusCode = 400;
        throw error;
    }

    if (newCheckout <= currentCheckout) {
        const error = new Error("New checkout date must be after current checkout date");
        error.statusCode = 400;
        throw error;
    }

    // Check room availability for the extended period
    const isAvailable = await checkRoomAvailability(
        guest.room._id,
        currentCheckout, // Start checking from old checkout
        newCheckout,     // Until new checkout
        guestId          // Exclude this guest from collision check (though logic usually checks others)
    );

    if (!isAvailable) {
        const error = new Error("Room is not available for the requested extension period");
        error.statusCode = 400;
        throw error;
    }

    // CALCULATIONS
    const originalNights = guest.stayDuration;
    // Calculate ADDITIONAL nights only
    const additionalNights = Math.ceil((newCheckout - currentCheckout) / (1000 * 60 * 60 * 24));
    const newTotalNights = originalNights + additionalNights;

    // Update Guest
    guest.checkOutAt = newCheckout;
    guest.stayDuration = newTotalNights;
    await guest.save();

    // Calculate Costs for EXTENSION only
    const nightlyRate = guest.room.rate;
    const additionalRentBeforeDiscount = nightlyRate * additionalNights;
    let discountInfo = {};

    // Update Invoice
    const invoice = await Invoice.findOne({ guest: guestId });
    if (invoice) {
        // Determine the standard discount % from the EXISTING invoice if possible
        let stdDiscountPct = 0;
        if (invoice.discountAmount > 0 && invoice.subtotal > 0) {
            // Reverse engineer: (discount / subtotal) * 100
            // NOTE: This is an approximation if multiple discounts exist, but consistent with original logic
            // Original logic tried to deduce it from the first item (Room Rent)
            const roomItem = invoice.items.find(i => i.description.includes("Room Rent"));
            if (roomItem) {
                const originalRoomTotal = roomItem.total;
                const originalStdDiscount = invoice.discountAmount;
                if (originalStdDiscount > 0) {
                    stdDiscountPct = (originalStdDiscount / originalRoomTotal) * 100;
                }
            }
        }

        // Apply standard discount only if flag is true
        const extendedStdDiscount = applyStandardDiscount
            ? Math.round(additionalRentBeforeDiscount * (stdDiscountPct / 100))
            : 0;

        // Apply Promo Discount if guest used one
        let extendedPromoDiscount = 0;
        let promoPct = 0;
        if (guest.promoCode) {
            const promo = await PromoCode.findOne({ code: guest.promoCode });
            if (promo) {
                promoPct = promo.percentage;
                extendedPromoDiscount = Math.round(additionalRentBeforeDiscount * (promoPct / 100));
            }
        }

        // Use user-provided additional discount (sanitize it)
        const extendedAddlDiscount = Math.max(0, Math.round(Number(additionalDiscount) || 0));

        // Net additional rent after discounts
        const netAdditionalRent = Math.max(0, additionalRentBeforeDiscount - extendedStdDiscount - extendedAddlDiscount - extendedPromoDiscount);

        // Store discount info for response
        discountInfo = {
            stdDiscountPct: applyStandardDiscount ? Math.round(stdDiscountPct * 100) / 100 : 0,
            stdDiscountAmt: extendedStdDiscount,
            promoDiscountAmt: extendedPromoDiscount,
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
        invoice.promoDiscount = (invoice.promoDiscount || 0) + extendedPromoDiscount;

        // Recalculate totals - subtotal is GROSS (before discounts)
        invoice.subtotal = (invoice.subtotal || 0) + additionalRentBeforeDiscount;

        // Calculate total discounts
        const totalDiscounts = (invoice.discountAmount || 0) + (invoice.additionaldiscount || 0) + (invoice.promoDiscount || 0);

        // Grand total = subtotal - all discounts + tax
        const subtotalAfterDiscounts = Math.max(0, invoice.subtotal - totalDiscounts);
        invoice.taxAmount = Math.round(subtotalAfterDiscounts * (invoice.taxRate / 100));
        invoice.grandTotal = subtotalAfterDiscounts + invoice.taxAmount;

        // Recalculate balance due
        const paidAmount = invoice.advanceAdjusted || guest.advancePayment || 0;
        invoice.balanceDue = Math.max(0, invoice.grandTotal - paidAmount);

        await invoice.save();
    }

    return {
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
    };
};
