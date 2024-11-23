const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const cors = require('cors');
const connectDB = require('./config/database');
const config = require('./config/config');
const fs = require('fs');
const seedData = require('./seedData');

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = config.server.port;

// Middlewares
app.use(cors({
    origin: 'http://localhost:3000', // frontend URL
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Basic error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});


// Server initialization
const startServer = async () => {
    try {
        // Connect to database
        await connectDB();

        // Seeding sample data
        await seedData();

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Start the server
        app.listen(PORT, () => {
            console.log(`✨ Server is running on port ${PORT}`);
            console.log(`🌍 Environment: ${config.server.port || 'development'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();