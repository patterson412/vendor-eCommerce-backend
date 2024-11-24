const ProductImage = require('../models/ProductImage');

class ProductImageService {
    // Add image to product
    async addProductImage(imageData) {
        try {
            return await ProductImage.create(imageData);
        } catch (error) {
            throw error;
        }
    }

    // Get all images for a product
    async getProductImages(productId) {
        try {
            return await ProductImage.find({ productId });
        } catch (error) {
            throw error;
        }
    }

    // Get primary image for a product
    async getPrimaryImage(productId) {
        try {
            return await ProductImage.findOne({
                productId,
                isPrimary: true
            });
        } catch (error) {
            throw error;
        }
    }

    // Set primary image
    async setPrimaryImage(productId, imageId) {
        const session = await ProductImage.startSession();
        session.startTransaction();

        try {
            // Remove primary flag from all images of this product
            await ProductImage.updateMany(
                { productId },
                { isPrimary: false },
                { session }
            );

            // Set new primary image
            const updatedImage = await ProductImage.findByIdAndUpdate(
                imageId,
                { isPrimary: true },
                { new: true, session }
            );

            await session.commitTransaction();
            return updatedImage;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Delete image
    async deleteImage(imageId) {
        try {
            return await ProductImage.findByIdAndDelete(imageId);
        } catch (error) {
            throw error;
        }
    }

    // Delete all images for a product
    async deleteProductImages(productId) {
        try {
            return await ProductImage.deleteMany({ productId });
        } catch (error) {
            throw error;
        }
    }

    async updateImage(imageId, imageData) {
        try {
            return await ProductImage.findByIdAndUpdate(imageId, imageData, { new: true });
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new ProductImageService();