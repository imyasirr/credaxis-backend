const path = require("path");
const fs = require("fs");
const multer = require("multer");

const ApiError = require("../utils/ApiError");

const createUploader = ({ folder, fieldName, multiple = false, maxCount = 1 }) => {
    const uploadDir = path.join(__dirname, "../../public/uploads", folder);

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${req.user.id}-${file.fieldname}-${Date.now()}${ext}`);
        },
    });

    const fileFilter = (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
            return;
        }

        cb(new ApiError(400, "Only JPEG, PNG and WebP images are allowed"));
    };

    const upload = multer({
        storage,
        fileFilter,
        limits: { fileSize: 2 * 1024 * 1024 },
    });

    return (req, res, next) => {
        const handler = multiple
            ? upload.fields(maxCount)
            : upload.single(fieldName);

        handler(req, res, (err) => {
            if (!err) {
                next();
                return;
            }

            if (err instanceof ApiError) {
                next(err);
                return;
            }

            if (err.code === "LIMIT_FILE_SIZE") {
                next(new ApiError(400, "Image size must be under 2MB"));
                return;
            }

            next(new ApiError(400, err.message));
        });
    };
};

module.exports.createUploader = createUploader;

module.exports.getUploadPath = (folder, filename) => {
    return `/uploads/${folder}/${filename}`;
};

module.exports.deleteUploadFile = (filePath) => {
    if (!filePath) {
        return;
    }

    const relative = filePath.replace(/^\/uploads\//, "");
    const fileLocation = path.join(__dirname, "../../public/uploads", relative);

    if (fs.existsSync(fileLocation)) {
        fs.unlinkSync(fileLocation);
    }
};

// Avatar upload (existing profile flow)
module.exports.uploadAvatar = createUploader({
    folder: "avatars",
    fieldName: "avatar",
});

module.exports.getAvatarPath = (filename) => {
    return module.exports.getUploadPath("avatars", filename);
};

module.exports.deleteAvatarFile = module.exports.deleteUploadFile;

// KYC documents upload
module.exports.uploadKycDocs = createUploader({
    folder: "kyc",
    multiple: true,
    maxCount: [
        { name: "panImage", maxCount: 1 },
        { name: "aadhaarFront", maxCount: 1 },
        { name: "aadhaarBack", maxCount: 1 },
        { name: "selfie", maxCount: 1 },
    ],
});

module.exports.uploadPartnerDocs = createUploader({
    folder: "partner",
    multiple: true,
    maxCount: [
        { name: "shopPhoto", maxCount: 1 },
        { name: "gstDocument", maxCount: 1 },
        { name: "panDocument", maxCount: 1 },
    ],
});
