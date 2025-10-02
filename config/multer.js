// config/multer.js (NEW VERSION - HOLDS IN MEMORY FOR S3)
const multer = require('multer');

// 1. Use memoryStorage to hold the file as a buffer in RAM.
//    This is the key change. We are no longer saving to disk.
const storage = multer.memoryStorage();

// 2. The file filter is still useful to validate the file type before processing.
const fileFilter = (req, file, cb) => {
  // Accept images only
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false);
  }
};

// 3. Create the multer instance with the new storage configuration.
const upload = multer({
  storage: storage, // Use memoryStorage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file (you can keep your limit)
  },
  fileFilter: fileFilter
});

module.exports = upload;