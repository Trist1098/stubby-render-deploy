// https://expressjs.com/en/resources/middleware/multer.html

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = 'src/public/uploads/';
const allowedTextExtensions = /\.(txt|docx)$/i;
const allowedTextMimeTypes =
  /(text\/plain|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/octet-stream)/;
const allowedWorkCheckExtensions = /\.(txt|docx)$/i;
const allowedWorkCheckMimeTypes = allowedTextMimeTypes;
const allowedImageExtensions = /\.(jpg|jpeg|png|webp)$/i;
const allowedImageMimeTypes = /^image\/(jpeg|png|webp)$/i;

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
  const extname = allowedTextExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTextMimeTypes.test(file.mimetype);

  if (extname && mimetype) {
    callback(null, true);
  } else {
    const error = new Error('Only .txt or .docx files are allowed');
    error.status = 400;
    callback(error);
  }
};

const workCheckFileFilter = (req, file, callback) => {
  const extname = allowedWorkCheckExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedWorkCheckMimeTypes.test(file.mimetype);

  if (extname && mimetype) {
    callback(null, true);
  } else {
    const error = new Error('Only .txt or .docx files are allowed');
    error.status = 400;
    callback(error);
  }
};

const imageFileFilter = (req, file, callback) => {
  const extname = allowedImageExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedImageMimeTypes.test(file.mimetype);

  if (extname && mimetype) {
    callback(null, true);
  } else {
    const error = new Error('Only JPEG, PNG, or WebP images are allowed');
    error.status = 400;
    callback(error);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

upload.image = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

upload.memoryText = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

upload.memoryWorkCheck = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: workCheckFileFilter,
});

module.exports = upload;
