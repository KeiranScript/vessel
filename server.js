const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const multer = require('multer');
const fs = require('fs');
const mime = require('mime-types');
const crypto = require('crypto');

// Initialize Express
const app = express();
const port = 3002;

// Set up session
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000 // Cookie expires in a week
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport
passport.use(new DiscordStrategy({
    clientID: '1266891949357400166',
    clientSecret: 'upAZE4EddFMdGlX7XWLVJrZudKldbcur',
    callbackURL: 'http://localhost:3002/callback',
    scope: ['identify']
  },
  function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user ? req.user.id : 'guest';
    const dir = path.join(__dirname, 'uploads', userId);

    // Ensure user directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(5).toString('hex'); // 5 bytes * 2 hex chars/byte = 10 chars
    cb(null, randomName + path.extname(file.originalname)); // Append random string to filename
  }
});

const upload = multer({ storage });

// Route for the home page
app.get('/', (req, res) => {
  if (!req.isAuthenticated()) {
    // Redirect to Discord login if not authenticated
    res.redirect('/auth/discord');
  } else {
    const userId = req.user.id;
    const userUploadsDir = path.join(__dirname, 'uploads', userId);

    fs.readdir(userUploadsDir, (err, files) => {
      if (err) {
        console.error('Error reading user uploads:', err);
        return res.status(500).send('Error reading uploads');
      }

      // Filter out directories and count files
      const fileCount = files.filter(file => fs.statSync(path.join(userUploadsDir, file)).isFile()).length;

      res.render('index', {
        title: 'Vessel',
        profileImage: `https://cdn.discordapp.com/avatars/${userId}/${req.user.avatar}.png`,
        name: req.user.username,
        description: `${fileCount} uploads` // Pass the file count to the description
      });
    });
  }
});

// Discord login route
app.get('/auth/discord', passport.authenticate('discord'));

// Discord callback route
app.get('/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/');
  });

// Logout route
app.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) {
      // Handle error, if any
      return res.status(500).send('Logout failed');
    }
    // Clear cookies
    res.clearCookie('connect.sid'); // Clear session cookie
    res.redirect('/'); // Redirect to home page
  });
});

// Upload route
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Unauthorized');
  }

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

// Delete route
app.post('/delete', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Unauthorized');
  }

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

app.get('/gallery', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/discord');
  }

  const userId = req.user ? req.user.id : 'guest';
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

    res.render('gallery', { files: fileDetails });
  });
});

app.get('/about', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/discord');
  }

  // Retrieve statistics
  const uploadsDir = path.join(__dirname, 'uploads');
  let totalUploads = 0;
  let totalStorage = 0;
  let registeredUsers = 0;

  // Calculate total uploads and storage
  fs.readdir(uploadsDir, (err, usersDirs) => {
    if (err) return res.status(500).send('Error reading uploads directory');

    registeredUsers = usersDirs.length;
    usersDirs.forEach(userDir => {
      const userDirPath = path.join(uploadsDir, userDir);
      fs.readdir(userDirPath, (err, files) => {
        if (err) return res.status(500).send('Error reading user directory');

        files.forEach(file => {
          totalUploads++;
          totalStorage += fs.statSync(path.join(userDirPath, file)).size / (1024 * 1024 * 1024); // Convert bytes to GB
        });

        // Send response once all directories have been processed
        if (userDir === usersDirs[usersDirs.length - 1]) {
          res.render('about', {
            title: 'Image Host',
            totalUploads: totalUploads,
            releaseDate: '2024-07-01', // Example release date
            registeredUsers: registeredUsers,
            totalStorage: totalStorage.toFixed(2) // Format to 2 decimal places
          });
        }
      });
    });
  });
});

app.get('/motd', (req, res) => {
  fs.readFile(path.join(__dirname, 'motd.txt'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading MOTD file:', err);
      return res.status(500).send('Error reading MOTD file');
    }
    res.send(data);
  });
});

// Serve user uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
