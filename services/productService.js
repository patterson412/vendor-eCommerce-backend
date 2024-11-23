const Product = require('../models/Product');

class ProductService {
    // Create product
    async createProduct(productData) {
        try {
            return await Product.create(productData);
        } catch (error) {
            throw error;
        }
    }

    // Get product by ID
    async getProductById(productId) {
        try {
            return await Product.findById(productId).populate('userId', '-password');
        } catch (error) {
            throw error;
        }
    }

    // Get all products
    async getAllProducts(filters = {}, sort = {}, limit = 10, skip = 0) {
        try {
            return await Product.find(filters)
                .populate('userId', '-password')
                .sort(sort)
                .limit(limit)
                .skip(skip);
        } catch (error) {
            throw error;
        }
    }

    // Get products by user
    async getProductsByUser(userId) {
        try {
            return await Product.find({ userId })
                .populate('userId', '-password');
        } catch (error) {
            throw error;
        }
    }

    // Update product
    async updateProduct(productId, updateData) {
        try {
            return await Product.findByIdAndUpdate(
                productId,
                updateData,
                { new: true, runValidators: true }
            ).populate('userId', '-password');
        } catch (error) {
            throw error;
        }
    }

    // Delete product
    async deleteProduct(productId) {
        try {
            return await Product.findByIdAndDelete(productId);
        } catch (error) {
            throw error;
        }
    }

    // Search products
    async searchProducts(searchTerm) {
        try {
            return await Product.find({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } }
                ]
            }).populate('userId', '-password');
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new ProductService();