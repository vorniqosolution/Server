require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../model/room');

const commonDescription = "Experience luxury and comfort with our premium amenities and scenic views.";

const rooms = [
  // ============================================================
  // FLOOR 3 (10 Rooms)
  // ============================================================
  { roomNumber: '301', bedType: 'One Bed', category: 'Executive', view: 'Valley View', rate: 25000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '302', bedType: 'One Bed', category: 'Executive', view: 'Valley View', rate: 25000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '303', bedType: 'One Bed', category: 'Executive', view: 'Valley View', rate: 25000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '304', bedType: 'One Bed', category: 'Executive', view: 'Valley View', rate: 25000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },

  { roomNumber: '305', bedType: 'One Bed', category: 'Deluxe', view: 'Lobby Facing', rate: 18000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '306', bedType: 'One Bed', category: 'Deluxe', view: 'Lobby Facing', rate: 18000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '307', bedType: 'One Bed', category: 'Deluxe', view: 'Lobby Facing', rate: 18000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },

  { roomNumber: '309', bedType: 'One Bed', category: 'Deluxe', view: 'Lobby Facing', rate: 18000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },

  { roomNumber: '311', publicDescription: commonDescription, bedType: 'Studio', category: 'Standard', view: 'Lobby Facing', rate: 14000, owner: 'Reception', isPubliclyVisible: true, status: 'available' },
  { roomNumber: '312', publicDescription: commonDescription, bedType: 'Studio', category: 'Standard', view: 'Lobby Facing', rate: 14000, owner: 'Reception', isPubliclyVisible: true, status: 'occupied' }, // MATCHED: Occupied in CSV
  { roomNumber: '313', publicDescription: commonDescription, bedType: 'Studio', category: 'Standard', view: 'Lobby Facing', rate: 14000, owner: 'Reception', isPubliclyVisible: true, status: 'available' },

  // ============================================================
  // FLOOR 4 (11 Rooms)
  // ============================================================
  { roomNumber: '401', bedType: 'One Bed', category: 'Presidential', view: 'Corner', rate: 30000, owner: 'admin', isPubliclyVisible: true, adults: 2, infants: 2, status: 'available' },
  { roomNumber: '402', bedType: 'Two Bed', category: 'Executive', view: 'Valley View', rate: 25000, owner: 'Reception', isPubliclyVisible: false, status: 'occupied' }, // MATCHED: Occupied in CSV
  { roomNumber: '403', bedType: 'One Bed', category: 'Executive', view: 'Valley View', rate: 25000, owner: 'admin', isPubliclyVisible: true, adults: 2, infants: 0, status: 'available' },
  { roomNumber: '404', bedType: 'Two Bed', category: 'Executive', view: 'Valley View', rate: 25000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },

  { roomNumber: '405', bedType: 'One Bed', category: 'Deluxe', view: 'Lobby Facing', rate: 18000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '406', bedType: 'One Bed', category: 'Deluxe', view: 'Lobby Facing', rate: 18000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '407', bedType: 'One Bed', category: 'Deluxe', view: 'Lobby Facing', rate: 18000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },

  { roomNumber: '409', publicDescription: commonDescription, bedType: 'Studio', category: 'Standard', view: 'Lobby Facing', rate: 14000, owner: 'Reception', isPubliclyVisible: true, status: 'available' },
  { roomNumber: '410', publicDescription: commonDescription, bedType: 'Studio', category: 'Standard', view: 'Lobby Facing', rate: 14000, owner: 'Reception', isPubliclyVisible: true, status: 'occupied' }, // MATCHED: Occupied in CSV

  { roomNumber: '411', bedType: 'Two Bed', category: 'Duluxe-Plus', view: 'Lobby Facing', rate: 28000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '412', bedType: 'One Bed', category: 'Deluxe', view: 'Lobby Facing', rate: 18000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },

  // ============================================================
  // FLOOR 5 (8 Rooms)
  // ============================================================
  { roomNumber: '501', bedType: 'One Bed', category: 'Presidential', view: 'Valley View', rate: 30000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '502', bedType: 'One Bed', category: 'Presidential', view: 'Valley View', rate: 30000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '503', bedType: 'One Bed', category: 'Presidential', view: 'Valley View', rate: 30000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '504', bedType: 'Two Bed', category: 'Presidential', view: 'Valley View', rate: 30000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '505', bedType: 'One Bed', category: 'Presidential', view: 'Valley View', rate: 30000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },

  { roomNumber: '506', bedType: 'One Bed', category: 'Deluxe', view: 'Lobby Facing', rate: 18000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '508', publicDescription: commonDescription, bedType: 'Studio', category: 'Standard', view: 'Lobby Facing', rate: 14000, owner: 'Reception', isPubliclyVisible: true, status: 'available' },
  { roomNumber: '509', bedType: 'One Bed', category: 'Deluxe', view: 'Lobby Facing', rate: 20000, owner: 'admin', isPubliclyVisible: false, adults: 2, infants: 0, status: 'available' },

  // ============================================================
  // FLOOR 6 (7 Rooms)
  // ============================================================
  { roomNumber: '601', bedType: 'One Bed', category: 'Presidential', view: 'Valley View', rate: 30000, owner: 'admin', isPubliclyVisible: true, adults: 4, infants: 2, status: 'occupied' }, // MATCHED: Occupied in CSV
  { roomNumber: '602', bedType: 'Two Bed', category: 'Executive', view: 'Valley View', rate: 25000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '603', bedType: 'Two Bed', category: 'Executive', view: 'Valley View', rate: 25000, owner: 'Reception', isPubliclyVisible: false, status: 'occupied' }, // MATCHED: Occupied in CSV
  { roomNumber: '604', bedType: 'Two Bed', category: 'Executive', view: 'Valley View', rate: 25000, owner: 'Reception', isPubliclyVisible: false, status: 'occupied' }, // MATCHED: Occupied in CSV

  { roomNumber: '605', bedType: 'Two Bed', category: 'Duluxe-Plus', view: 'Lobby Facing', rate: 28000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
  { roomNumber: '607', publicDescription: commonDescription, bedType: 'Studio', category: 'Standard', view: 'Lobby Facing', rate: 14000, owner: 'Reception', isPubliclyVisible: true, status: 'available' },
  { roomNumber: '609', bedType: 'One Bed', category: 'Deluxe', view: 'Corner', rate: 20000, owner: 'Reception', isPubliclyVisible: false, status: 'available' },
];

async function seed() {
  try {
    // 2. Connect
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-mgmt', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('🗄️  Connected to MongoDB');

    // 3. Clear existing rooms
    await Room.deleteMany({});
    console.log('🧹  Cleared existing rooms');

    // 4. Insert seed data
    const docs = await Room.insertMany(rooms);
    console.log(`✅  Seeded ${docs.length} rooms`);

  } catch (err) {
    console.error('❌  Seed error:', err);
  } finally {
    // 5. Disconnect
    await mongoose.disconnect();
    console.log('🔌  Disconnected from MongoDB');
  }
}

seed();