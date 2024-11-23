const User = require('../models/User');

class UserService {
    // Create new user
    async createUser(userData) {
        try {
            return await User.create(userData);
        } catch (error) {
            throw error;
        }
    }

    // Get user by ID
    async getUserById(userId) {
        try {
            return await User.findById(userId).select('-password');
        } catch (error) {
            throw error;
        }
    }

    // Get user by email
    async getUserByEmail(email) {
        try {
            return await User.findOne({ email });
        } catch (error) {
            throw error;
        }
    }

    // Update user
    async updateUser(userId, updateData) {
        try {
            return await User.findByIdAndUpdate(
                userId,
                updateData,
                { new: true, runValidators: true }
            ).select('-password');
        } catch (error) {
            throw error;
        }
    }

    // Delete user
    async deleteUser(userId) {
        try {
            return await User.findByIdAndDelete(userId);
        } catch (error) {
            throw error;
        }
    }

    // Search users
    async searchUsers(searchTerm) {
        try {
            return await User.find({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { email: { $regex: searchTerm, $options: 'i' } }
                ]
            }).select('-password');
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new UserService();