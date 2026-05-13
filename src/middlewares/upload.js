// https://expressjs.com/en/resources/middleware/multer.html

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = 'src/public/uploads/';
const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt/;
const allowedMimeTypes =
  /image\/(jpeg|png|gif|webp)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain/;

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, uploadDir);
  },
  filename: function (req, file, callback) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    callback(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, callback) => {
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMimeTypes.test(file.mimetype);

  if (extname && mimetype) {
    callback(null, true);
  } else {
    callback(new Error('Only images and documents are allowed'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

module.exports = upload;
