const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const multer = require('multer');
const crypto = require('crypto');

// Utility function to ensure directory exists
function ensureDirectoryExists(dir) {
  try {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.error(`Error creating directory ${dir}:`, err);
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user ? req.user.id : 'guest';
    const dir = path.join(__dirname, 'public', 'uploads', userId);

    console.log(`Destination directory: ${dir}`);

    ensureDirectoryExists(dir);

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(5).toString('hex'); // 5 bytes * 2 hex chars/byte = 10 chars
    cb(null, randomName + path.extname(file.originalname)); // Append random string to filename
  }
});

const upload = multer({ storage });

// Middleware to check authentication
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// Route to get user info
router.get('/user', ensureAuthenticated, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    avatar: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
  });
});

// Route to upload file
router.post('/upload', ensureAuthenticated, upload.single('file'), (req, res) => {
  const file = req.file;
  if (file) {
    const userId = req.user.id;
    const userUploadsDir = path.join(__dirname, 'uploads', userId);

    // Get the updated file count
    fs.readdir(userUploadsDir, (err, files) => {
      if (err) return res.status(500).send('Error reading user uploads');

      const fileCount = files.filter(file => fs.statSync(path.join(userUploadsDir, file)).isFile()).length;

      res.json({ 
        filename: file.filename,
        url: `${req.protocol}://${req.get('host')}/uploads/${userId}/${file.filename}`,
        mimetype: file.mimetype,
        fileCount: fileCount // Send the updated file count
      });
    });
  } else {
    res.status(400).send('No file uploaded');
  }
});

// Route to delete file
router.post('/delete', ensureAuthenticated, (req, res) => {
  const { url } = req.body; // Extract the URL from the request body

  if (!url) {
    return res.status(400).send('Invalid request');
  }

  // Extract file name from URL
  const fileName = path.basename(url);
  const filePath = path.join(__dirname, 'uploads', req.user.id, fileName);

  fs.unlink(filePath, err => {
    if (err) {
      console.error('Error deleting file:', err);
      return res.status(500).send('Error deleting file');
    }
    res.sendStatus(200);
  });
});

// Route to get user uploads
router.get('/uploads', ensureAuthenticated, (req, res) => {
  const userId = req.user.id;
  const uploadDir = path.join(__dirname, 'uploads', userId);

  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.status(500).send('Error reading files');

    const fileDetails = files.map(file => {
      const filePath = path.join(uploadDir, file);
      const fileUrl = `/uploads/${userId}/${file}`;
      const fileType = mime.lookup(filePath) || 'unknown'; // Use mime.lookup
      return {
        name: file,
        url: fileUrl,
        type: fileType
      };
    });

    res.json({ files: fileDetails });
  });
});

module.exports = router;

