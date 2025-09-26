 const express = require("express");
const router = express.Router();

const { 
    publicApiLimiter, 
    createReservationLimiter,
    reservationValidationRules,
    handleValidationErrors
} = require('../middleware/securityMiddleware');

const { 
    getPublicAvailableRooms,
    getPublicCategories,
    createPublicReservation,
    getPublicRoomsByCategory,
   getPublicCategoryDetails
} = require("../controller/publicController");


router.get('/available-rooms', publicApiLimiter, getPublicAvailableRooms);

router.get('/categories', publicApiLimiter, getPublicCategories);

router.get('/categories/:categoryName', publicApiLimiter, getPublicRoomsByCategory);

router.get('/:categoryName/details', publicApiLimiter, getPublicCategoryDetails);



router.post('/reservations',
    createReservationLimiter,
    reservationValidationRules,
    handleValidationErrors,
    createPublicReservation
);

module.exports = router;