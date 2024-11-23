const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    }
}, {
    timestamps: true
});

// Compound index for faster queries and to ensure unique combinations
favouriteSchema.index({ userId: 1, productId: 1 }, { unique: true });

const Favourite = mongoose.model('Favourite', favouriteSchema);
module.exports = Favourite;
