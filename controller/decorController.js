const Invoice = require("../model/invoice");
const Guest = require("../model/guest");
const Reservation = require("../model/reservationmodel");
const DecorOrder = require("../model/decorOrder");
const DecorPackage = require("../model/decorPackage");
const InventoryItem = require("../model/inventoryItem");
const InventoryTransaction = require("../model/inventoryTransaction");
const { uploadImageToS3, deleteImageFromS3 } = require("../service/imageUploadService"); 

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

const parseRequirements = (reqData) => {
    if (!reqData) return [];
    try {
        // If it's already an object/array (rare in form-data but possible), return it
        if (typeof reqData === 'object') return reqData;
        // Otherwise, parse the string
        return JSON.parse(reqData);
    } catch (e) {
        throw new Error("Invalid format for inventoryRequirements. Must be valid JSON string.");
    }
};

exports.createPackage = async (req, res) => {
  try {
    const { title, description, price, inventoryRequirements, isCustom } = req.body;

    // --- A. Upload Images to S3 ---
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
        // We use the new S3 helper with the "images/decor" folder
        const uploadPromises = req.files.map(file => uploadImageToS3(file, "images/decor"));
        imageUrls = await Promise.all(uploadPromises);
    }

    // --- B. Parse & Validate Inventory (THE FIX IS HERE) ---
    let parsedRequirements = [];
    if (inventoryRequirements) {
        // USE THE HELPER FUNCTION HERE
        parsedRequirements = parseRequirements(inventoryRequirements); 
        
        // NOW we check if it is an array
        if (!Array.isArray(parsedRequirements)) {
            return res.status(400).json({ message: "Inventory requirements must be a list (array)." });
        }
        
        for (const reqItem of parsedRequirements) {
            if (!reqItem.item || !reqItem.quantity) {
                return res.status(400).json({ message: "Ingredients need Item ID and Quantity." });
            }
        }
    }

    // --- C. Save to Database ---
    const newPackage = await DecorPackage.create({
      title,
      description,
      price,
      images: imageUrls,
      inventoryRequirements: parsedRequirements, // Save the parsed array, not the string
      isCustom: isCustom === 'true' || isCustom === true,
      createdBy: req.user.userId,
    });

    res.status(201).json({ success: true, data: newPackage });

  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "Title already exists." });
    console.error("Create Decor Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, inventoryRequirements, keepOldImages } = req.body;

    const oldPackage = await DecorPackage.findById(id);
    if (!oldPackage) return res.status(404).json({ message: "Package not found" });

    const updates = {};
    if (title) updates.title = title;
    if (description) updates.description = description;
    if (price) updates.price = price;

    // USE THE HELPER FUNCTION HERE TOO
    if (inventoryRequirements) {
        updates.inventoryRequirements = parseRequirements(inventoryRequirements);
    }

    // Handle Images
    if (req.files && req.files.length > 0) {
        const uploadPromises = req.files.map(file => uploadImageToS3(file, "images/decor"));
        const newImageUrls = await Promise.all(uploadPromises);
        
        if (keepOldImages === 'true') {
             updates.$push = { images: { $each: newImageUrls } };
        } else {
             // Delete old images first
             if (oldPackage.images && oldPackage.images.length > 0) {
                 for (const oldUrl of oldPackage.images) {
                     await deleteImageFromS3(oldUrl); 
                 }
             }
             updates.images = newImageUrls;
        }
    }

    const updatedPackage = await DecorPackage.findByIdAndUpdate(
      id, updates, { new: true, runValidators: true }
    ).populate("inventoryRequirements.item");

    res.status(200).json({ success: true, message: "Updated successfully", data: updatedPackage });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. SAFETY CHECK: Is this package used in any existing orders?
    const usageCount = await DecorOrder.countDocuments({ package: id });

    if (usageCount > 0) {
      // Soft Delete (Archive)
      const archivedPackage = await DecorPackage.findByIdAndUpdate(
        id, 
        { isActive: false }, 
        { new: true }
      );

      if (!archivedPackage) return res.status(404).json({ message: "Package not found" });

      return res.status(200).json({
        success: true,
        type: "archived",
        message: `Package archived. It is linked to ${usageCount} past orders, so we hid it instead of deleting it.`
      });

    } else {
      // Hard Delete
      const deletedPackage = await DecorPackage.findByIdAndDelete(id);
      
      if (!deletedPackage) return res.status(404).json({ message: "Package not found" });

      return res.status(200).json({
        success: true,
        type: "deleted",
        message: "Package permanently deleted."
      });
    }

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

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

