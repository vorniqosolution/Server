// scripts/seedRooms.js
require('dotenv').config();           // if you use a .env file
const mongoose = require('mongoose');
const Room = require('../model/room'); // adjust path if needed

// 1. Define your rooms
// (These are the ones you marked in the images,
//  mapped into bedType / category / view / rate / owner)
const rooms = [
  { roomNumber: '411', bedType: 'Two Bed', category: 'Duluxe-Plus', view: 'Lobby Facing', rate: 28000, owner: 'Reception' },
  { roomNumber: '605', bedType: 'Two Bed', category: 'Duluxe-Plus', view: 'Lobby Facing', rate: 28000, owner: 'Reception' },

  { roomNumber: '305', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception' },
  { roomNumber: '311', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception' },
  { roomNumber: '312', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception' },
  { roomNumber: '313', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception' },
  { roomNumber: '409', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception' },
  { roomNumber: '410', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception' },
  { roomNumber: '508', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception' },
  { roomNumber: '607', bedType: 'Studio',   category: 'Standard',     view: 'Lobby Facing',    rate: 14000, owner: 'Reception' },

  { roomNumber: '309', bedType: 'One Bed',  category: 'Deluxe',       view: 'Lobby Facing',    rate: 18000, owner: 'Reception' },
  { roomNumber: '407', bedType: 'One Bed',  category: 'Deluxe',       view: 'Lobby Facing',    rate: 18000, owner: 'Reception' },
  { roomNumber: '412', bedType: 'One Bed',  category: 'Deluxe',       view: 'Lobby Facing',    rate: 18000, owner: 'Reception' },
  { roomNumber: '506', bedType: 'One Bed',  category: 'Deluxe',       view: 'Lobby Facing',    rate: 18000, owner: 'Reception' },
  { roomNumber: '509', bedType: 'One Bed',  category: 'Deluxe',       view: 'Lobby Facing',    rate: 18000, owner: 'Reception' },

  { roomNumber: '609', bedType: 'One Bed',  category: 'Deluxe',       view: 'Corner',          rate: 20000, owner: 'Reception' },

  { roomNumber: '303', bedType: 'One Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception' },
  { roomNumber: '304', bedType: 'One Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception' },
  { roomNumber: '402', bedType: 'One Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception' },
  { roomNumber: '404', bedType: 'One Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception' },
  { roomNumber: '603', bedType: 'One Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception' },
  { roomNumber: '604', bedType: 'One Bed',  category: 'Executive',    view: 'Valley View',     rate: 25000, owner: 'Reception' },

  { roomNumber: '503', bedType: 'One Bed',  category: 'Presidential', view: 'Valley View',     rate: 30000, owner: 'Reception' },
  { roomNumber: '504', bedType: 'One Bed',  category: 'Presidential', view: 'Valley View',     rate: 30000, owner: 'Reception' },
  { roomNumber: '505', bedType: 'One Bed',  category: 'Presidential', view: 'Valley View',     rate: 30000, owner: 'Reception' },
];

async function seed() {
  try {
    // 2. Connect
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-mgmt', {
      useNewUrlParser: true,
      useUnifiedTopology: true
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
