const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let storage;

// Only use Cloudinary when real credentials are provided (non-empty)
if (config.cloudinary && config.cloudinary.cloudName && config.cloudinary.apiKey) {
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  const cloudinary = require('../config/cloudinary');
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'swcmas',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1280, height: 720, crop: 'limit' }],
    },
  });
} else {
  // Fallback to local disk storage for development
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    },
  });
}

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, jpeg, png, webp) are allowed'), false);
  }
};

const parser = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter }); // 5 MB limit

module.exports = parser;
