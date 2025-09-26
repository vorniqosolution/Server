const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

exports.publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: "Too many requests from this IP, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

exports.createReservationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message:
    "Too many reservation attempts from this IP, please try again after an hour.",
  standardHeaders: true,
  legacyHeaders: false,
});

exports.reservationValidationRules = [
    body('fullName').trim().notEmpty().withMessage('Full name is required.').escape(),
    body('address').trim().notEmpty().withMessage('Address is required.').escape(),
    body('phone').trim().notEmpty().withMessage('Phone number is required.'),
    body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
    body('cnic').trim().notEmpty().withMessage('CNIC is required.'),
    body('roomId').isMongoId().withMessage('A valid room ID is required.'),
    body('checkInDate').isDate().withMessage('Invalid check-in date format.').toDate(),
    body('checkOutDate').isDate().withMessage('Invalid check-out date format.').toDate(),
    body('expectedArrivalTime').trim().escape(),
    body('specialRequest').trim().escape(),
    body('promoCode').trim().escape(),
    body('checkOutDate').custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.checkInDate)) {
            throw new Error('Check-out date must be after check-in date.');
        }
        return true;
    }),
];

exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
