const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const crypto = require('crypto');
const DiscordStrategy = require('passport-discord').Strategy;
const fs = require('fs');

// Import API routes
const apiRoutes = require('./api');

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

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

const apiKeyTimestamps = new Map(); // Store last regeneration timestamps

function canRegenerateApiKey(userId) {
    const lastTimestamp = apiKeyTimestamps.get(userId);
    const currentTime = Date.now();
    const sixHoursInMs = 6 * 60 * 60 * 1000;

    if (!lastTimestamp || (currentTime - lastTimestamp) >= sixHoursInMs) {
        apiKeyTimestamps.set(userId, currentTime);
        return true;
    }
    return false;
}

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

// Use API routes
app.use('/api', apiRoutes);

// Other routes
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
    let processedDirs = 0;

    usersDirs.forEach(userDir => {
      const userDirPath = path.join(uploadsDir, userDir);
      fs.readdir(userDirPath, (err, files) => {
        if (err) return res.status(500).send('Error reading user directory');

        files.forEach(file => {
          totalUploads++;
          totalStorage += fs.statSync(path.join(userDirPath, file)).size / (1024 * 1024 * 1024); // Convert bytes to GB
        });

        // Send response once all directories have been processed
        processedDirs++;
        if (processedDirs === usersDirs.length) {
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

app.get('/dashboard', ensureAuthenticated, (req, res) => {
    const userId = req.user.id;
    const userUploadsDir = path.join(__dirname, 'uploads', userId);

    fs.readdir(userUploadsDir, (err, files) => {
        if (err) {
            console.error('Error reading user uploads:', err);
            return res.status(500).send('Error reading uploads');
        }

        // Filter out directories and count files
        const fileCount = files.filter(file => fs.statSync(path.join(userUploadsDir, file)).isFile()).length;

        // Generate a dummy API key for example purposes (you should implement actual key generation and storage)
        const apiKey = '12345-abcde';

        res.render('dashboard', {
            title: 'Dashboard',
            profileImage: `https://cdn.discordapp.com/avatars/${userId}/${req.user.avatar}.png`,
            name: req.user.username,
            description: `${fileCount} uploads`,
            apiKey: apiKey
        });
    });
});

app.post('/api/generate-api-key', ensureAuthenticated, (req, res) => {
    const userId = req.user.id;

    if (canRegenerateApiKey(userId)) {
        const apiKey = crypto.randomBytes(16).toString('hex');

        // Save the generated API key to your database or user session as needed

        res.json({ apiKey: apiKey });
    } else {
        res.status(429).json({ message: 'API key regeneration is allowed once every 6 hours.' });
    }
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

