require('dotenv').config();

module.exports = {
    // Database
    db: {
        uri: process.env.MONGODB_URI,
    },

    // Server
    server: {
        port: process.env.PORT || 8080,
        env: process.env.NODE_ENV || 'development'
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    },

    // File Upload
    upload: {
        maxSize: process.env.MAX_FILE_SIZE || 50 * 1024 * 1024, // 50MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif']
    }
};