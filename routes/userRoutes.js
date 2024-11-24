const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { userService, productService, productImageService, favouriteService } = require('../services');


router.get('/me', auth, async (req, res) => {
    const user = req.user;
    res.status(200).json({ name: user.name, email: user.email, role: user.role });
});

module.exports = router;