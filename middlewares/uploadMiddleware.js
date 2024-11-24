const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');

// Multer setup for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,
    },
    fileFilter: function (req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
}).array('images', 3);

async function saveImageWithWatermark(file) {
    const filename = Date.now() + path.extname(file.originalname);
    const filepath = path.join('uploads', filename);

    const watermark = await sharp('images/watermark.png')
        .resize(200, 200, { fit: 'inside' })
        .toBuffer();

    await sharp(file.buffer)
        .resize(1200, 800, { fit: 'inside' }) // Resize image
        .composite([{ input: watermark, gravity: 'southeast' }])
        .toFile(filepath);

    return filename;
}

async function saveFile(file) {
    const filename = Date.now() + path.extname(file.originalname);
    const filepath = path.join('uploads', filename);

    await fs.writeFile(filepath, file.buffer);

    return filename;
}

module.exports = {
    upload,
    saveImageWithWatermark,
    saveFile
};