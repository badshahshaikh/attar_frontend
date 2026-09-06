const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const valid = new Set(['image/jpeg', 'image/png', 'image/webp']).has(file.mimetype);
        if (valid) callback(null, true);
        else callback(new Error('Only image files are allowed'));
    },
});

module.exports = { upload };
