const InventoryCategory = require("../model/inventoryCategory");
const InventoryItem = require("../model/inventoryItem");
const InventoryTransaction = require("../model/inventoryTransaction");
const Room = require("../model/room");
const Guest = require("../model/guest");
const mongoose = require("mongoose");

exports.createCategory = async (req, res) => {
  const { name, description } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Category name is required and must be a non-empty string.",
    });
  }
  if (description && typeof description !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Description must be a string." });
  }
  try {
    const cat = await InventoryCategory.create({
      name: name.trim(),
      description: description?.trim(),
      createdBy: req.user.userId,
    });
    res.status(201).json({
      success: true,
      message: "Category created successfully.",
      data: cat,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Category name must be unique." });
    }
    res
      .status(500)
      .json({ success: false, message: "Server error creating category." });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const cats = await InventoryCategory.find().sort("name");
    res.status(200).json({
      success: true,
      message: "Categories fetched successfully.",
      data: cats,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error fetching categories." });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (name && typeof name !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Name must be a string." });
  }
  try {
    const cat = await InventoryCategory.findByIdAndUpdate(
      id,
      {
        ...(name && { name: name.trim() }),
        ...(description && { description: description.trim() }),
      },
      { new: true, runValidators: true }
    );
    if (!cat)
      return res
        .status(404)
        .json({ success: false, message: "Category not found." });
    res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: cat,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category ID." });
    }
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Category name must be unique." });
    }
    res
      .status(500)
      .json({ success: false, message: "Server error updating category." });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const cat = await InventoryCategory.findByIdAndDelete(id);
    if (!cat)
      return res
        .status(404)
        .json({ success: false, message: "Category not found." });
    res
      .status(200)
      .json({ success: true, message: "Category deleted successfully." });
  } catch (err) {
    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category ID." });
    }
    res
      .status(500)
      .json({ success: false, message: "Server error deleting category." });
  }
};

// --- Item CRUD ---
exports.createItem = async (req, res) => {
  const {
    name,
    category,
    unitPrice,
    quantityOnHand,
    reorderLevel,
    location,
    defaultCheckInQty,
  } = req.body;
  // input validation
  if (!name || typeof name !== "string")
    return res
      .status(400)
      .json({ success: false, message: "Item name is required." });
  if (!mongoose.Types.ObjectId.isValid(category))
    return res
      .status(400)
      .json({ success: false, message: "Invalid category ID." });
  if (typeof unitPrice !== "number" || unitPrice < 0)
    return res
      .status(400)
      .json({
        success: false,
        message: "Unit price must be a non-negative number.",
      });
  if (typeof quantityOnHand !== "number" || quantityOnHand < 0)
    return res
      .status(400)
      .json({
        success: false,
        message: "Quantity on hand must be a non-negative number.",
      });
  if (typeof reorderLevel !== "number" || reorderLevel < 0)
    return res
      .status(400)
      .json({
        success: false,
        message: "Reorder level must be a non-negative number.",
      });
  if (
    defaultCheckInQty != null &&
    (typeof defaultCheckInQty !== "number" || defaultCheckInQty < 0)
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message: "defaultCheckInQty must be a non-negative number.",
      });
  }
  try {
    const item = await InventoryItem.create({
      name: name.trim(),
      category,
      unitPrice,
      quantityOnHand,
      reorderLevel,
      location: location?.trim(),
      defaultCheckInQty: defaultCheckInQty || 0,
      createdBy: req.user.userId,
    });
    res
      .status(201)
      .json({
        success: true,
        message: "Item created successfully.",
        data: item,
      });
  } catch (err) {
    if (err.name === "ValidationError")
      return res.status(400).json({ success: false, message: err.message });
    if (err.name === "CastError")
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    res
      .status(500)
      .json({ success: false, message: "Server error creating item." });
  }
};

exports.getItems = async (req, res) => {
  try {
    const items = await InventoryItem.find().populate("category");
    res.status(200).json({
      success: true,
      message: "Items fetched successfully.",
      data: items,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error fetching items." });
  }
};

exports.updateItem = async (req, res) => {
  const { id } = req.params;
  const { name, category, unitPrice, reorderLevel, location, defaultCheckInQty } = req.body;
  try {
    const updates = {};
    if (name) updates.name = name.trim();
    if (category) updates.category = category;
    if (unitPrice != null) updates.unitPrice = unitPrice;
    if (reorderLevel != null) updates.reorderLevel = reorderLevel;
    if (location) updates.location = location.trim();
    if (defaultCheckInQty != null) updates.defaultCheckInQty = defaultCheckInQty;
    const item = await InventoryItem.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: "Item not found." });
    res.status(200).json({ success: true, message: "Item updated successfully.", data: item });
  } catch (err) {
    if (err.name === "ValidationError") return res.status(400).json({ success: false, message: err.message });
    if (err.name === "CastError") return res.status(400).json({ success: false, message: "Invalid ID format." });
    res.status(500).json({ success: false, message: "Server error updating item." });
  }
};

exports.deleteItem = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await InventoryItem.findByIdAndDelete(id);
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Item not found." });
    res
      .status(200)
      .json({ success: true, message: "Item deleted successfully." });
  } catch (err) {
    if (err.name === "CastError")
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    res
      .status(500)
      .json({ success: false, message: "Server error deleting item." });
  }
};

// --- Transactions ---
exports.createTransaction = async (req, res) => {
  try {
    // Validate required fields
    const { item, transactionType, quantity } = req.body;

    if (!item || !transactionType || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Item, transaction type, and quantity are required",
      });
    }

    if (typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive number",
      });
    }

    // Check if item exists and has enough inventory for issue/usage
    const inventoryItem = await InventoryItem.findById(item);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    if (
      (transactionType === "issue" || transactionType === "usage") &&
      inventoryItem.quantityOnHand < quantity
    ) {
      return res.status(400).json({
        success: false,
        message: "Insufficient inventory",
      });
    }

    // Create transaction without using sessions for now
    const tx = await InventoryTransaction.create({
      ...req.body,
      createdBy: req.user.userId,
    });

    // Update item quantity
    const quantityChange =
      transactionType === "issue" || transactionType === "usage"
        ? -quantity
        : quantity;

    await InventoryItem.findByIdAndUpdate(item, {
      $inc: { quantityOnHand: quantityChange },
    });

    res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: tx,
    });
  } catch (err) {
    console.error("Transaction error:", err); // Add detailed logging

    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    }

    res.status(500).json({
      success: false,
      message: `Error creating transaction: ${err.message}`, // Include error message
    });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.room)  filter.room  = req.query.room;
    if (req.query.guest) filter.guest = req.query.guest;

    const txs = await InventoryTransaction
      .find(filter)
      .populate('item')
      .populate('room')
      .populate('guest');

    return res.status(200).json({ success: true, data: txs });
  } catch (err) {
    console.error('getTransactions Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching transactions.'
    });
  }
};

// --- Integrations: Room Check-in / Check-out ---
exports.handleRoomCheckin = async (req, res) => {
  const { roomId, guestId } = req.body;
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(guestId)) {
    return res.status(400).json({ success: false, message: "Invalid room or guest ID." });
  }
  try {
    // Dynamically fetch items to auto-issue based on backend setting
    const defaultItems = await InventoryItem.find({ defaultCheckInQty: { $gt: 0 } });
    if (!defaultItems.length) {
      return res.status(200).json({ success: true, message: "No default items configured for check-in.", data: [] });
    }
    const txs = await Promise.all(defaultItems.map(async item => {
      const qty = item.defaultCheckInQty;
      const tx = await InventoryTransaction.create({
        item:      item._id,
        room:      roomId,
        guest:     guestId,
        transactionType: "issue",
        quantity:  qty,
        createdBy: req.user.userId
      });
      // update stock
      await InventoryItem.findByIdAndUpdate(item._id, { $inc: { quantityOnHand: -qty } });
      return tx;
    }));
    res.status(200).json({ success: true, message: "Default items issued on check-in.", data: txs });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error on check-in integration." });
  }
};

exports.handleRoomCheckout = async (req, res) => {
  const { roomId, guestId } = req.body;
  // 1. Validate incoming IDs
  if (!mongoose.Types.ObjectId.isValid(roomId) ||
      !mongoose.Types.ObjectId.isValid(guestId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid room or guest ID.'
    });
  }

  try {
    // 2. Fetch all 'issue' and 'return' transactions for this room & guest
    const [issuedTxs, returnTxs] = await Promise.all([
      InventoryTransaction.find({ room: roomId, guest: guestId, transactionType: 'issue' }),
      InventoryTransaction.find({ room: roomId, guest: guestId, transactionType: 'return' })
    ]);

    // 3. Aggregate quantities per item
    const issuedMap = {};
    for (const tx of issuedTxs) {
      const key = tx.item.toString();
      issuedMap[key] = (issuedMap[key] || 0) + tx.quantity;
    }
    const returnMap = {};
    for (const tx of returnTxs) {
      const key = tx.item.toString();
      returnMap[key] = (returnMap[key] || 0) + tx.quantity;
    }

    // 4. Compute net usage and record 'usage' transactions
    const usageTxs = [];
    for (const itemId in issuedMap) {
      const netUsed = issuedMap[itemId] - (returnMap[itemId] || 0);
      if (netUsed > 0) {
        // Create usage transaction
        const usageTx = await InventoryTransaction.create({
          item:            itemId,
          room:            roomId,
          guest:           guestId,
          transactionType: 'usage',
          quantity:        netUsed,
          createdBy:       req.user.userId
        });
        // Decrement the global stock for that item
        await InventoryItem.findByIdAndUpdate(itemId, {
          $inc: { quantityOnHand: -netUsed }
        });
        usageTxs.push(usageTx);
      }
    }

    // 5. Return the new usage transactions
    return res.status(200).json({
      success: true,
      message: 'Checkout integration executed successfully.',
      data:    usageTxs
    });

  } catch (err) {
    console.error('handleRoomCheckout Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error on check-out integration.'
    });
  }
};