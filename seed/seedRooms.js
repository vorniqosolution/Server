// scripts/seedRooms.js
require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../model/room');

const rooms = [
  { roomNumber: '411', bedType: 'Two Bed', category: 'Duluxe-Plus', view: 'Lobby Facing', rate: 28000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '605', bedType: 'Two Bed', category: 'Duluxe-Plus', view: 'Lobby Facing', rate: 28000, owner: 'Reception', isPubliclyVisible: false },

  { roomNumber: '311', publicDescription: 'sjfhlhksdh', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception', isPubliclyVisible: true },
  { roomNumber: '312', publicDescription: 'sjfhlhksdh', bedType: 'Studio',    category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception', isPubliclyVisible: true },
  { roomNumber: '313', publicDescription: 'sjfhlhksdh', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception', isPubliclyVisible: true },  
  { roomNumber: '409', publicDescription: 'sjfhlhksdh', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception', isPubliclyVisible: true },
  { roomNumber: '410', publicDescription: 'sjfhlhksdh', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception', isPubliclyVisible: true },
  { roomNumber: '508', publicDescription: 'sjfhlhksdh', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception', isPubliclyVisible: true },
  { roomNumber: '607', publicDescription: 'sjfhlhksdh', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception', isPubliclyVisible: true },  

  { roomNumber: '309', bedType: 'One Bed',  category: 'Deluxe',       view: 'Lobby Facing',    rate: 18000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '407', bedType: 'One Bed',  category: 'Deluxe',       view: 'Lobby Facing',    rate: 18000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '412', bedType: 'One Bed',  category: 'Deluxe',       view: 'Lobby Facing',    rate: 18000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '509', bedType: 'One Bed',  category: 'Deluxe',       view: 'Lobby Facing',    rate: 18000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '506', bedType: 'One Bed',  category: 'Deluxe',       view: 'Lobby Facing',    rate: 18000, owner: 'Reception', isPubliclyVisible: false },

  { roomNumber: '609', bedType: 'One Bed',  category: 'Deluxe',       view: 'Corner',          rate: 20000, owner: 'Reception', isPubliclyVisible: false },

  { roomNumber: '303', bedType: 'One Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '304', bedType: 'One Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '402', bedType: 'Two Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '404', bedType: 'Two Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '603', bedType: 'Two Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '604', bedType: 'Two Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception', isPubliclyVisible: false },

  { roomNumber: '503', bedType: 'One Bed',  category: 'Presidential', view: 'Valley View',     rate: 30000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '504', bedType: 'Two Bed',  category: 'Presidential', view: 'Valley View',     rate: 30000, owner: 'Reception', isPubliclyVisible: false },
  { roomNumber: '505', bedType: 'One Bed',  category: 'Presidential', view: 'Valley View',     rate: 30000, owner: 'Reception', isPubliclyVisible: false },
];

async function seed() {
  try {
    // 2. Connect
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-mgmt', {
      useNewUrlParser: false,
      useUnifiedTopology: false
    });
    console.log('🗄️  Connected to MongoDB');

    // 3. (Optional) clear existing
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
