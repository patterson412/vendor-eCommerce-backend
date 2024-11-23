const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    isPrimary: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for faster queries
productImageSchema.index({ productId: 1 });
productImageSchema.index({ productId: 1, isPrimary: 1 });

const ProductImage = mongoose.model('ProductImage', productImageSchema);
module.exports = ProductImage;