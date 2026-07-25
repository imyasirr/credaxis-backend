const { body } = require("express-validator");

exports.completePlay = [
    body("bubblesPopped")
        .optional()
        .isInt({ min: 0, max: 500 })
        .withMessage("bubblesPopped must be a non-negative integer"),
    body("hitBomb").optional().isBoolean().withMessage("hitBomb must be boolean"),
];
