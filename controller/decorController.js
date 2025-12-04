const Invoice = require("../model/invoice");
const Guest = require("../model/guest");
const Reservation = require("../model/reservationmodel");
const DecorOrder = require("../model/decorOrder");
const DecorPackage = require("../model/decorPackage");
const InventoryItem = require("../model/inventoryItem");
const InventoryTransaction = require("../model/inventoryTransaction");

// --- HELPER: Validation (Inventory Only) ---
const validateDecorRequest = async (packageId, forceCreate) => {
  const decorPkg = await DecorPackage.findById(packageId).populate(
    "inventoryRequirements.item"
  );

  if (!decorPkg) throw new Error("Decor Package not found");
  if (!decorPkg.isActive)
    throw new Error("This package is currently unavailable");

  // INVENTORY CHECK (Soft Warning)
  for (const requirement of decorPkg.inventoryRequirements) {
    const stockAvailable = requirement.item.quantityOnHand;
    const stockNeeded = requirement.quantity;

    if (stockAvailable < stockNeeded && !forceCreate) {
      throw new Error(
        `WARNING_STOCK: Not enough ${requirement.item.name}. Available: ${stockAvailable}, Needed: ${stockNeeded}`
      );
    }
  }

  return decorPkg;
};

// --- ADMIN: Create Package ---
exports.createPackage = async (req, res) => {
  try {
    const { title, description, price, inventoryRequirements } = req.body;

    const newPackage = await DecorPackage.create({
      title,
      description,
      price,
      inventoryRequirements: inventoryRequirements || [],
      createdBy: req.user.userId,
    });

    res.status(201).json({ success: true, data: newPackage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- ADMIN: Get Packages ---
exports.getPackages = async (req, res) => {
  try {
    const packages = await DecorPackage.find({ isActive: true }).populate(
      "inventoryRequirements.item",
      "name quantityOnHand"
    );
    res.status(200).json({ success: true, data: packages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- GET GUESTS WITH ACTIVE DECOR ---
exports.getActiveDecorOrders = async (req, res) => {
  try {
    // 1. Find all orders that have a Guest ID attached
    const allOrders = await DecorOrder.find({ guest: { $ne: null } })
      .populate({
        path: 'guest',
        match: { status: 'checked-in' }, // <--- KEY FILTER: Only currently active guests
        select: 'fullName room status phone',
        populate: { 
            path: 'room', 
            select: 'roomNumber' 
        }
      })
      .populate('package', 'title description price images')
      .sort({ createdAt: -1 });

    // 2. Filter out nulls
    // (Mongoose .populate returns 'null' if the 'match' condition fails, 
    // so we filter those out to leave only the active ones)
    const activeOrders = allOrders.filter(order => order.guest !== null);

    res.status(200).json({ 
        success: true, 
        count: activeOrders.length, 
        data: activeOrders 
    });

  } catch (err) {
    console.error("Get Active Decor Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- RECEPTIONIST: Create Order (Simplified) ---
exports.createOrder = async (req, res) => {
  try {
    const { packageId, guestId, reservationId, instructions, forceCreate } =
      req.body;

    let decorPkg;

    // 1. Validation Phase
    try {
      decorPkg = await validateDecorRequest(packageId, forceCreate);
    } catch (err) {
      if (err.message.startsWith("WARNING_")) {
        return res.status(409).json({
          success: false,
          type: "warning",
          message: err.message.replace("WARNING_STOCK: ", ""),
          requiresConfirmation: true,
        });
      }
      throw err;
    }

    // 2. Creation Phase
    const orderData = {
      package: packageId,
      price: decorPkg.price,
      instructions,
      createdBy: req.user.userId,
    };

    if (guestId) orderData.guest = guestId;
    if (reservationId) orderData.reservation = reservationId;

    const order = await DecorOrder.create(orderData);

    res
      .status(201)
      .json({ success: true, message: "Decor order placed.", data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.completeAndBillOrder = async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : null;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });

    const { orderId } = req.body;
    const order = await DecorOrder.findById(orderId).populate('package');

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status === 'billed') return res.status(400).json({ message: "Already billed" });

    // --- LOGGING START ---
    console.log("--- DEBUGGING BILLING ---");
    console.log("Order ID:", order._id);
    console.log("Reservation ID in Order:", order.reservation);
    console.log("Guest ID in Order (Before Fix):", order.guest);
    // ---------------------

    // SMART FIX: HANDLE ORPHANED RESERVATION ORDERS
    if (order.reservation && !order.guest) {
        const reservation = await Reservation.findById(order.reservation);
        
        if (reservation && reservation.status === 'checked-in' && reservation.guest) {
            console.log("Fixing link... Found Guest ID:", reservation.guest);
            order.guest = reservation.guest;
            await order.save(); 
        } else {
            return res.status(400).json({ 
                success: false, 
                message: "Cannot bill: Reservation is not checked-in yet." 
            });
        }
    }

    // --- LOGGING THE SEARCH ---
    console.log("Searching Invoice for Guest ID:", order.guest);
    console.log("Looking for status: 'pending'");
    // --------------------------

    const invoice = await Invoice.findOne({ guest: order.guest, status: 'pending' });
    
    // --- LOGGING THE RESULT ---
    console.log("Invoice Found?", invoice ? "YES" : "NO");
    if (invoice) console.log("Invoice ID:", invoice._id);
    // --------------------------
    
    if (invoice) {
        // ... (Existing Logic: Push items, Recalculate, Save) ...
        const decorPkg = await DecorPackage.findById(order.package).populate("inventoryRequirements.item");
        
        // 1. DEDUCT INVENTORY
        for (const requirement of decorPkg.inventoryRequirements) {
            if (!requirement.item) continue;
            await InventoryTransaction.create({
                item: requirement.item._id,
                transactionType: "usage",
                quantity: requirement.quantity,
                reason: `Decor Package: ${decorPkg.title}`,
                createdBy: userId
            });
            await InventoryItem.findByIdAndUpdate(requirement.item._id, { 
                $inc: { quantityOnHand: -requirement.quantity } 
            });
        }

        // 2. UPDATE INVOICE
        invoice.items.push({
            description: `Decor Service: ${decorPkg.title}`,
            quantity: 1,
            unitPrice: order.price,
            total: order.price
        });

        invoice.subtotal += order.price;
        const serviceTax = Math.round((order.price * invoice.taxRate) / 100);
        invoice.taxAmount += serviceTax;
        invoice.grandTotal = invoice.subtotal + invoice.taxAmount - invoice.discountAmount - (invoice.additionaldiscount || 0);
        
        await invoice.save();
    } else {
        return res.status(404).json({ message: "Active Invoice not found. Guest is checked in but has no pending invoice." });
    }

    // 3. FINALIZE
    order.status = 'billed';
    await order.save();

    res.status(200).json({ success: true, message: "Stock deducted & Invoice updated." });

  } catch (err) {
    console.error("Billing Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

