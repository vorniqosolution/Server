// config/scheduler.js
const schedule = require('node-schedule');
const reservationController = require('../controller/reservationcontroller');

const setupSchedulers = () => {
  // Daily job to update room statuses
  const dailyRoomStatusUpdateJob = schedule.scheduleJob('0 0 * * *', async function() {
    console.log('--- Running daily room status update job ---');
    try {
      const result = await reservationController.updateRoomStatuses();
      console.log(`--- Daily room status update job finished. Updated: ${result.updated || 0} ---`);
    } catch (error) {
      console.error('Error executing scheduled room status update:', error);
    }
  });

  console.log('Daily room status update scheduler initialized.');

  // You can add more scheduled jobs here later if needed
};

module.exports = setupSchedulers;