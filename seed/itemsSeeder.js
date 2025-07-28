require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./model/User');
const InventoryItem = require('./model/inventoryItem');

const seedItems = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Find an admin user for createdBy
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('No admin user found. Please seed users first.');
      process.exit(1);
    }

    // 3. Clean existing items
    const deleteResult = await InventoryItem.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing inventory items`);

    // 4. Define items to seed
    const itemsData = [
      {
        name: 'Pillow',
        category: '6880ff59f49789f4e5fb8df0', // Pillow category
        unitPrice: 200,
        quantityOnHand: 200,
        reorderLevel: 10,
        location: 'room item',
        defaultCheckInQty: 0,
        createdBy: adminUser._id
      },
      {
        name: 'Tooth Brush',
        category: '6882507f40b91d9094c9a3a6',
        unitPrice: 30,
        quantityOnHand: 200,
        reorderLevel: 10,
        location: 'room item',
        defaultCheckInQty: 1,
        createdBy: adminUser._id
      },
      {
        name: 'Tooth Paste',
        category: '6882507f40b91d9094c9a3a6',
        unitPrice: 50,
        quantityOnHand: 200,
        reorderLevel: 10,
        location: 'room item',
        defaultCheckInQty: 1,
        createdBy: adminUser._id
      },
      {
        name: 'Soap',
        category: '6882507f40b91d9094c9a3a6',
        unitPrice: 40,
        quantityOnHand: 200,
        reorderLevel: 10,
        location: 'room item',
        defaultCheckInQty: 1,
        createdBy: adminUser._id
      },
      {
        name: 'Towel',
        category: '6882507f40b91d9094c9a3a6',
        unitPrice: 100,
        quantityOnHand: 200,
        reorderLevel: 10,
        location: 'room item',
        defaultCheckInQty: 1,
        createdBy: adminUser._id
      }
    ];

    // 5. Insert into DB
    const inserted = await InventoryItem.insertMany(itemsData);
    console.log(`Seeded ${inserted.length} inventory items successfully`);
    process.exit();
  } catch (err) {
    console.error('Error seeding inventory items:', err);
    process.exit(1);
  }
};

seedItems();
