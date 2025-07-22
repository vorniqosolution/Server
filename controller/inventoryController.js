const InventoryCategory = require("../model/inventoryCategory");
const InventoryItem = require("../model/inventoryItem");
const InventoryTransaction = require("../model/inventoryTransaction");
const Room = require("../model/room");
const Guest = require("../model/guest");

// --- Category CRUD ---
exports.createCategory = async (req, res) => {
    try {
        // 1. Authentication check
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ 
                message: "Authentication required. Please login first." 
            });
        }

        // 2. Request body validation
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ 
                message: "Request body cannot be empty." 
            });
        }

        // 3. Required field validation
        if (!req.body.name || req.body.name.trim() === '') {
            return res.status(400).json({ 
                message: "Category name is required and cannot be empty." 
            });
        }

        // 4. Name length validation
        if (req.body.name.length > 100) {
            return res.status(400).json({ 
                message: "Category name cannot exceed 100 characters." 
            });
        }

        // 5. Description length validation (if provided)
        if (req.body.description && req.body.description.length > 500) {
            return res.status(400).json({ 
                message: "Description cannot exceed 500 characters." 
            });
        }

        // 6. Check for invalid fields
        const allowedFields = ['name', 'description'];
        const invalidFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
        if (invalidFields.length > 0) {
            return res.status(400).json({ 
                message: `Invalid fields: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}` 
            });
        }

        // 7. Create category
        const cat = await InventoryCategory.create({
            ...req.body,
            createdBy: req.user.userId
        });

        res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: cat
        });

    } catch (err) {
        console.error('Create category error:', err);

        // 8. Handle specific MongoDB errors
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ 
                message: "Validation failed", 
                errors: validationErrors 
            });
        }

        // 9. Handle duplicate key error (unique constraint)
        if (err.code === 11000) {
            const duplicateField = Object.keys(err.keyPattern)[0];
            return res.status(409).json({ 
                message: `A category with this ${duplicateField} already exists.` 
            });
        }

        // 10. Handle cast errors (invalid ObjectId)
        if (err.name === 'CastError') {
            return res.status(400).json({ 
                message: "Invalid data format provided." 
            });
        }

        // 11. Handle database connection errors
        if (err.name === 'MongoNetworkError') {
            return res.status(503).json({ 
                message: "Database connection error. Please try again later." 
            });
        }

        // 12. Handle timeout errors
        if (err.name === 'MongoTimeoutError') {
            return res.status(504).json({ 
                message: "Request timeout. Please try again." 
            });
        }

        // 13. Generic server error
        res.status(500).json({ 
            message: "Internal server error. Please try again later.",
            ...(process.env.NODE_ENV === 'development' && { error: err.message })
        });
    }
};

exports.getCategories = async (req, res) => {
    try {
        // 1. Authentication check
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ 
                message: "Authentication required. Please login first." 
            });
        }

        // 2. Query parameters validation
        const { page = 1, limit = 10, search } = req.query;
        
        if (page < 1 || limit < 1) {
            return res.status(400).json({ 
                message: "Page and limit must be positive numbers." 
            });
        }

        if (limit > 100) {
            return res.status(400).json({ 
                message: "Limit cannot exceed 100 items per page." 
            });
        }

        // 3. Build query
        let query = {};
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        // 4. Execute query with pagination
        const cats = await InventoryCategory.find(query)
            .sort("name")
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('createdBy', 'name email');

        const total = await InventoryCategory.countDocuments(query);

        res.status(200).json({
            success: true,
            data: cats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error('Get categories error:', err);

        // Handle specific errors
        if (err.name === 'MongoNetworkError') {
            return res.status(503).json({ 
                message: "Database connection error. Please try again later." 
            });
        }

        if (err.name === 'MongoTimeoutError') {
            return res.status(504).json({ 
                message: "Request timeout. Please try again." 
            });
        }

        res.status(500).json({ 
            message: "Internal server error. Please try again later.",
            ...(process.env.NODE_ENV === 'development' && { error: err.message })
        });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        // 1. Authentication check
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ 
                message: "Authentication required. Please login first." 
            });
        }

        // 2. ID validation
        if (!req.params.id) {
            return res.status(400).json({ 
                message: "Category ID is required." 
            });
        }

        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ 
                message: "Invalid category ID format." 
            });
        }

        // 3. Request body validation
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ 
                message: "Request body cannot be empty." 
            });
        }

        // 4. Field validation
        const allowedFields = ['name', 'description'];
        const updateFields = Object.keys(req.body);
        const invalidFields = updateFields.filter(field => !allowedFields.includes(field));
        
        if (invalidFields.length > 0) {
            return res.status(400).json({ 
                message: `Invalid fields: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}` 
            });
        }

        // 5. Name validation (if provided)
        if (req.body.name !== undefined) {
            if (!req.body.name || req.body.name.trim() === '') {
                return res.status(400).json({ 
                    message: "Category name cannot be empty." 
                });
            }
            if (req.body.name.length > 100) {
                return res.status(400).json({ 
                    message: "Category name cannot exceed 100 characters." 
                });
            }
        }

        // 6. Description validation (if provided)
        if (req.body.description && req.body.description.length > 500) {
            return res.status(400).json({ 
                message: "Description cannot exceed 500 characters." 
            });
        }

        // 7. Check if category exists
        const existingCategory = await InventoryCategory.findById(req.params.id);
        if (!existingCategory) {
            return res.status(404).json({ 
                message: "Category not found." 
            });
        }

        // 8. Permission check (optional - only creator can update)
        if (existingCategory.createdBy.toString() !== req.user.userId) {
            return res.status(403).json({ 
                message: "You don't have permission to update this category." 
            });
        }

        // 9. Update category
        const cat = await InventoryCategory.findByIdAndUpdate(
            req.params.id, 
            { ...req.body }, 
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: cat
        });

    } catch (err) {
        console.error('Update category error:', err);

        // Handle specific errors
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ 
                message: "Validation failed", 
                errors: validationErrors 
            });
        }

        if (err.code === 11000) {
            const duplicateField = Object.keys(err.keyPattern)[0];
            return res.status(409).json({ 
                message: `A category with this ${duplicateField} already exists.` 
            });
        }

        if (err.name === 'CastError') {
            return res.status(400).json({ 
                message: "Invalid category ID format." 
            });
        }

        if (err.name === 'MongoNetworkError') {
            return res.status(503).json({ 
                message: "Database connection error. Please try again later." 
            });
        }

        res.status(500).json({ 
            message: "Internal server error. Please try again later.",
            ...(process.env.NODE_ENV === 'development' && { error: err.message })
        });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        console.log('Delete request received for ID:', req.params.id);
        console.log('User:', req.user);

        // Simple validation
        if (!req.params.id) {
            console.log('No ID provided');
            return res.status(400).json({ 
                message: "Category ID is required." 
            });
        }

        // Try to find and delete
        console.log('Attempting to delete category...');
        const deletedCategory = await InventoryCategory.findByIdAndDelete(req.params.id);
        console.log('Delete result:', deletedCategory);
        
        if (!deletedCategory) {
            console.log('Category not found');
            return res.status(404).json({ 
                message: "Category not found." 
            });
        }

        console.log('Category deleted successfully');
        res.status(200).json({
            success: true,
            message: "Category deleted successfully"
        });

    } catch (err) {
        console.error('Delete category error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack
        });
        
        res.status(500).json({ 
            message: "Error deleting category",
            error: err.message,
            errorName: err.name
        });
    }
};

// --- Item CRUD ---
exports.createItem = async (req, res) => {
    try {
        const item = await InventoryItem.create({ ...req.body, createdBy: req.user.id });
        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getItems = async (req, res) => {
    const items = await InventoryItem.find().populate("category");
    res.json(items);
};

exports.updateItem = async (req, res) => {
    try {
        const item = await InventoryItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(item);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        await InventoryItem.findByIdAndDelete(req.params.id);
        res.status(204).end();
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// --- Transactions ---
exports.createTransaction = async (req, res) => {
    try {
        const tx = await InventoryTransaction.create({ ...req.body, createdBy: req.user.id });
        // update item quantityOnHand
        await InventoryItem.findByIdAndUpdate(tx.item, {
            $inc: { quantityOnHand: tx.transactionType === "issue" || tx.transactionType === "usage" ? -tx.quantity : tx.quantity }
        });
        res.status(201).json(tx);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// --- Integrations: Room Check-in / Check-out ---
exports.handleRoomCheckin = async (req, res) => {
    // req.body: { roomId, guestId, defaultItems: [{ itemId, qty }] }
    const { roomId, guestId, defaultItems } = req.body;
    try {
        const txs = [];
        for (let { itemId, qty } of defaultItems) {
            const tx = await InventoryTransaction.create({
                item: itemId,
                room: roomId,
                guest: guestId,
                transactionType: "issue",
                quantity: qty,
                createdBy: req.user.id
            });
            await InventoryItem.findByIdAndUpdate(itemId, { $inc: { quantityOnHand: -qty } });
            txs.push(tx);
        }
        res.status(200).json(txs);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.handleRoomCheckout = async (req, res) => {
    // req.body: { roomId, guestId }
    const { roomId, guestId } = req.body;
    try {
        // fetch issued vs current stock logic here (example stub)
        // compute usedQty by comparing initial allocation and remaining qty
        // for each used item, create 'usage' tx and post to Guest
        res.status(200).json({ message: "Checkout integration executed" });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};