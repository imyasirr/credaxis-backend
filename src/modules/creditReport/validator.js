const { body, query, param } = require("express-validator");
const {
    VALID_INQUIRY_PURPOSES,
} = require("./service");

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
        .isLength({ min: 20 })
        .withMessage("consentPurpose must be at least 20 characters"),
    body("name")
        .optional()
        .trim()
        .isLength({ min: 2, max: 40 })
        .withMessage("name must be 2-40 characters"),
    body("mobile")
        .optional()
        .trim()
        .matches(/^[6-9]\d{9}$/)
        .withMessage("Valid 10-digit mobile is required"),
    body("inquiryPurpose")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(VALID_INQUIRY_PURPOSES)
        .withMessage(
            `inquiryPurpose must be one of: ${VALID_INQUIRY_PURPOSES.join(", ")}`
        ),
    body("dateOfBirth")
        .optional()
        .isISO8601()
        .withMessage("dateOfBirth must be YYYY-MM-DD"),
    body("addressType")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(["H", "O", "X"])
        .withMessage("addressType must be H, O or X"),
    body("address").optional().trim().isLength({ max: 200 }),
    body("pincode")
        .optional()
        .trim()
        .matches(/^\d{6}$/)
        .withMessage("pincode must be 6 digits"),
    body("documentType").optional().trim().isLength({ max: 20 }),
    body("documentId").optional().trim().isLength({ max: 30 }),
    body("pan")
        .optional()
        .trim()
        .matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i)
        .withMessage("Invalid PAN format"),
    body("generatePdf").optional().isBoolean(),
    body("referenceId").optional().trim().isLength({ min: 6, max: 64 }),
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

/** Admin can check any subject — name + mobile required */
exports.adminFetch = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("name is required")
        .isLength({ min: 2, max: 40 })
        .withMessage("name must be 2-40 characters"),
    body("mobile")
        .trim()
        .notEmpty()
        .withMessage("mobile is required")
        .matches(/^[6-9]\d{9}$/)
        .withMessage("Valid 10-digit mobile is required"),
    body("consent")
        .optional()
        .isBoolean()
        .withMessage("consent must be boolean"),
    body("consentPurpose")
        .optional()
        .trim()
        .isLength({ min: 20 })
        .withMessage("consentPurpose must be at least 20 characters"),
    body("inquiryPurpose")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(VALID_INQUIRY_PURPOSES)
        .withMessage(
            `inquiryPurpose must be one of: ${VALID_INQUIRY_PURPOSES.join(", ")}`
        ),
    body("dateOfBirth")
        .optional()
        .isISO8601()
        .withMessage("dateOfBirth must be YYYY-MM-DD"),
    body("addressType")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(["H", "O", "X"])
        .withMessage("addressType must be H, O or X"),
    body("address").optional().trim().isLength({ max: 200 }),
    body("pincode")
        .optional()
        .trim()
        .matches(/^\d{6}$/)
        .withMessage("pincode must be 6 digits"),
    body("documentType").optional().trim().isLength({ max: 20 }),
    body("documentId").optional().trim().isLength({ max: 30 }),
    body("pan")
        .optional()
        .trim()
        .matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i)
        .withMessage("Invalid PAN format"),
    body("generatePdf").optional().isBoolean(),
    body("referenceId").optional().trim().isLength({ min: 6, max: 64 }),
];
