const { body, query, param } = require("express-validator");

const normalizeMobile = (req) => {
    const mobile = String(req.body.mobile || req.body.phone || "").trim();
    if (mobile) req.body.mobile = mobile;
    return mobile;
};

exports.fetch = [
    body("forSelf")
        .optional()
        .isBoolean()
        .withMessage("forSelf must be boolean"),
    body("consent")
        .optional()
        .isBoolean()
        .withMessage("consent must be boolean"),
    body("consentPurpose")
        .optional()
        .trim()
        .isLength({ min: 20, max: 50 })
        .withMessage("consentPurpose must be 20-50 characters"),
    body("name")
        .optional()
        .trim()
        .isLength({ min: 2, max: 40 })
        .withMessage("name must be 2-40 characters"),
    body("email")
        .optional({ values: "falsy" })
        .trim()
        .isEmail()
        .withMessage("Valid email is required")
        .normalizeEmail(),
    body("pan")
        .optional({ values: "falsy" })
        .trim()
        .matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i)
        .withMessage("Invalid PAN format"),
    body("mobile").optional({ values: "falsy" }).trim(),
    body("phone").optional({ values: "falsy" }).trim(),
    body().custom((_, { req }) => {
        const mobile = normalizeMobile(req);
        if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
            throw new Error("Valid 10-digit mobile/phone is required");
        }
        // Someone-else check requires phone in body
        if (req.body.forSelf === false && !/^[6-9]\d{9}$/.test(mobile)) {
            throw new Error(
                "Valid 10-digit mobile/phone is required when checking someone else"
            );
        }
        return true;
    }),
    body().custom((_, { req }) => {
        if (req.body.forSelf === false) {
            if (!String(req.body.name || "").trim()) {
                throw new Error("Name is required when checking someone else");
            }
            if (!String(req.body.email || "").trim()) {
                throw new Error("Email is required when checking someone else");
            }
            const pan = String(req.body.pan || "").trim().toUpperCase();
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
                throw new Error("Valid PAN is required when checking someone else");
            }
            req.body.pan = pan;
        }
        return true;
    }),
    body("generatePdf").optional().isBoolean(),
    body("referenceId").optional().trim().isLength({ min: 6, max: 64 }),
    body("paymentId")
        .notEmpty()
        .withMessage("paymentId is required")
        .bail()
        .isMongoId()
        .withMessage("Invalid paymentId"),
    body("payment_id").optional().isMongoId(),
];

exports.listMine = [
    query("limit").optional().isInt({ min: 1, max: 50 }),
];

exports.reportId = [
    param("id").isMongoId().withMessage("Invalid report id"),
];

exports.adminList = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status")
        .optional()
        .isIn(["PENDING", "SUCCESS", "FAILED", "NOT_FOUND"]),
    query("mobile").optional().trim(),
    query("pan").optional().trim(),
    query("name").optional().trim(),
    query("email").optional().trim(),
    query("userId").optional().isMongoId(),
    query("subjectType").optional().isIn(["SELF", "OTHER"]),
    query("source").optional().isIn(["USER", "ADMIN"]),
    query("minScore").optional().isInt({ min: 0, max: 999 }),
    query("maxScore").optional().isInt({ min: 0, max: 999 }),
];

exports.adminUserChecklist = [
    param("userId").isMongoId().withMessage("Invalid user id"),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
];

/** Admin — only name, email, pan, phone */
exports.adminFetch = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Name is required")
        .isLength({ min: 2, max: 40 })
        .withMessage("Name must be 2-40 characters"),
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Valid email is required")
        .normalizeEmail(),
    body("pan")
        .trim()
        .notEmpty()
        .withMessage("PAN is required")
        .matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i)
        .withMessage("Invalid PAN format"),
    body("mobile").optional({ values: "falsy" }).trim(),
    body("phone").optional({ values: "falsy" }).trim(),
    body().custom((_, { req }) => {
        const mobile = normalizeMobile(req);
        if (!/^[6-9]\d{9}$/.test(mobile)) {
            throw new Error("Valid 10-digit mobile/phone is required");
        }
        return true;
    }),
    body("consent")
        .optional()
        .isBoolean()
        .withMessage("consent must be boolean"),
    body("consentPurpose")
        .optional()
        .trim()
        .isLength({ min: 20, max: 50 })
        .withMessage("consentPurpose must be 20-50 characters"),
    body("generatePdf").optional().isBoolean(),
    body("referenceId").optional().trim().isLength({ min: 6, max: 64 }),
];
