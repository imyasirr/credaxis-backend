const path = require("path");
const fs = require("fs");
const multer = require("multer");

const ApiError = require("../utils/ApiError");

const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const DOC_MIME = [...IMAGE_MIME, "application/pdf"];

const ensureDir = (folder) => {
    const uploadDir = path.join(__dirname, "../../public/uploads", folder);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    return uploadDir;
};

const createUploader = ({ folder, fieldName, multiple = false, maxCount = 1 }) => {
    const uploadDir = ensureDir(folder);

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
            const userId = req.user?.id || "anon";
            cb(null, `${userId}-${file.fieldname}-${Date.now()}${ext}`);
        },
    });

    const fileFilter = (req, file, cb) => {
        if (IMAGE_MIME.includes(file.mimetype)) {
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

            if (err.code === "LIMIT_UNEXPECTED_FILE") {
                next(
                    new ApiError(
                        400,
                        `Unexpected file field "${err.field}". Use the documented field names.`
                    )
                );
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

// Partner docs — accepts camelCase + snake_case field names,
// and PDF for PAN/GST documents.
module.exports.uploadPartnerDocs = (() => {
    const uploadDir = ensureDir("partner");

    const FIELD_ALIASES = {
        shopPhoto: ["shopPhoto", "shop_photo"],
        panDocument: ["panDocument", "pan_document", "panDoc"],
        gstDocument: ["gstDocument", "gst_document", "gstDoc"],
    };

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
            const userId = req.user?.id || "anon";
            const canonical =
                Object.keys(FIELD_ALIASES).find((key) =>
                    FIELD_ALIASES[key].includes(file.fieldname)
                ) || file.fieldname;
            cb(null, `${userId}-${canonical}-${Date.now()}${ext}`);
        },
    });

    const fileFilter = (req, file, cb) => {
        const isDocField =
            FIELD_ALIASES.panDocument.includes(file.fieldname) ||
            FIELD_ALIASES.gstDocument.includes(file.fieldname);

        const allowed = isDocField ? DOC_MIME : IMAGE_MIME;

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
            return;
        }

        cb(
            new ApiError(
                400,
                isDocField
                    ? "PAN/GST document must be JPEG, PNG, WebP or PDF"
                    : "Shop photo must be JPEG, PNG or WebP"
            )
        );
    };

    const upload = multer({
        storage,
        fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    });

    const fieldConfig = Object.values(FIELD_ALIASES)
        .flat()
        .map((name) => ({ name, maxCount: 1 }));

    return (req, res, next) => {
        upload.fields(fieldConfig)(req, res, (err) => {
            if (err) {
                if (err instanceof ApiError) {
                    return next(err);
                }
                if (err.code === "LIMIT_FILE_SIZE") {
                    return next(
                        new ApiError(400, "Each file must be under 5MB")
                    );
                }
                if (err.code === "LIMIT_UNEXPECTED_FILE") {
                    return next(
                        new ApiError(
                            400,
                            `Unexpected file field "${err.field}". Allowed: shopPhoto, panDocument, gstDocument`
                        )
                    );
                }
                return next(new ApiError(400, err.message));
            }

            // Normalize snake_case aliases → canonical camelCase keys
            const normalized = {};
            const files = req.files || {};

            Object.entries(FIELD_ALIASES).forEach(([canonical, aliases]) => {
                for (const alias of aliases) {
                    if (files[alias]?.[0]) {
                        normalized[canonical] = [files[alias][0]];
                        break;
                    }
                }
            });

            req.files = normalized;

            // Normalize common snake_case body fields for validators
            if (req.body) {
                const bodyAliases = {
                    business_name: "businessName",
                    business_type: "businessType",
                    owner_name: "ownerName",
                    pan_number: "panNumber",
                    gst_number: "gstNumber",
                };

                Object.entries(bodyAliases).forEach(([from, to]) => {
                    if (
                        req.body[from] !== undefined &&
                        req.body[to] === undefined
                    ) {
                        req.body[to] = req.body[from];
                    }
                });
            }

            next();
        });
    };
})();
