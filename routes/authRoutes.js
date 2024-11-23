const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { userService, productService, productImageService, favouriteService } = require('../services');

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(email, password);

    try {
        const user = await userService.getUserByEmail(email);

        if (!user) {
            return res.status(404).json({ msg: 'user does not exist' });
        }

        bcrypt.compare(password, user.password, async (err, isMatch) => {
            if (err) {
                console.log('Error in bcrypt.compare:', err);
                return res.status(401).json({ message: 'Authentication failed' });
            }

            if (!isMatch) {
                console.log('Password does not match');
                return res.status(401).json({ message: "Incorrect username or password" });
            }

            console.log('Authentication successful');

            const token = jwt.sign({ id: user._id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development' });
            return res.status(200).json({ msg: 'Login successful' });
        });


    } catch (error) {
        console.error('Error logging in user:', error);
        return res.status(500).json({ msg: 'Internal server error' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    return res.status(200).json({ msg: 'Logout successful' });
});

module.exports = router;