const Favourite = require('../models/Favourite');

class FavouriteService {
    // Add to favourites
    async addToFavourites(userId, productId) {
        try {
            const existing = await Favourite.findOne({ userId, productId });
            if (existing) {
                throw new Error('Product already in favourites');
            }
            return await Favourite.create({ userId, productId });
        } catch (error) {
            throw error;
        }
    }

    // Remove from favourites
    async removeFromFavourites(userId, productId) {
        try {
            return await Favourite.findOneAndDelete({ userId, productId });
        } catch (error) {
            throw error;
        }
    }

    // Toggle favourite status
    async toggleFavourite(userId, productId) {
        try {
            const existing = await Favourite.findOne({ userId, productId });

            if (existing) {
                await Favourite.findByIdAndDelete(existing._id);
                return { isFavourited: false, message: 'Removed from favourites' };
            }

            await Favourite.create({ userId, productId });
            return { isFavourited: true, message: 'Added to favourites' };
        } catch (error) {
            throw error;
        }
    }

    // Get all favourites for a user
    async getUserFavourites(userId) {
        try {
            return await Favourite.find({ userId })
                .populate({
                    path: 'productId',
                    populate: {
                        path: 'userId',
                        select: '-password'
                    }
                });
        } catch (error) {
            throw error;
        }
    }

    // Check if product is favourited by user
    async isProductFavourited(userId, productId) {
        try {
            const favourite = await Favourite.findOne({ userId, productId });
            return !!favourite;
        } catch (error) {
            throw error;
        }
    }

    // Get favourite count for a product
    async getProductFavouriteCount(productId) {
        try {
            return await Favourite.countDocuments({ productId });
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new FavouriteService();