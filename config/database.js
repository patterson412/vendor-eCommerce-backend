const mongoose = require('mongoose');
const config = require('./config');

const dropAllCollections = async () => {
    try {
        const collections = await mongoose.connection.db.collections();

        for (let collection of collections) {
            await collection.drop();
            console.log(`Dropped collection: ${collection.collectionName}`);
        }

        console.log('All collections have been dropped successfully');
    } catch (error) {
        console.error('Error dropping collections:', error);
        throw error;
    }
};

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.db.uri, {
            serverApi: {
                version: '1',
                strict: true,
                deprecationErrors: true,
            }
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Drop all collections and rebuild
        await dropAllCollections();

        // Ping to confirm connection
        await mongoose.connection.db.admin().command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // Handle connection events
        mongoose.connection.on('error', err => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        // Handle application termination
        process.on('SIGINT', async () => {
            try {
                await mongoose.connection.close();
                console.log('MongoDB connection closed through app termination');
                process.exit(0);
            } catch (err) {
                console.error('Error during MongoDB disconnect:', err);
                process.exit(1);
            }
        });

    } catch (error) {
        console.error('Error connecting to MongoDB:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;