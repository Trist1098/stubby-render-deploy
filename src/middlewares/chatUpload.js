const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    callback(null, uploadDir);
  },
  filename: function (req, file, callback) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    callback(null, 'chat-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, callback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|txt|doc|docx|xls|xlsx|ppt|pptx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    callback(null, true);
  } else {
    const error = new Error('Unsupported file type');
    error.status = 400;
    callback(error);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter,
});

module.exports.uploadChatFile = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) return res.status(400).json({ message: error.message });
    next();
  });
};
