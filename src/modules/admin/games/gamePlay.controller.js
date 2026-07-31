const userGamePlayService = require("../../games/userGamePlay.service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");
const { body } = require("express-validator");

exports.grantPlays = asyncHandler(async (req, res) => {
    const data = await userGamePlayService.grantPlays({
        userId: req.body.userId,
        mobile: req.body.mobile,
        gameType: req.body.gameType,
        plays: req.body.plays,
        expiresAt: req.body.expiresAt,
        note: req.body.note,
        source: "ADMIN",
        grantedBy: req.user.id,
    });
    return response.success(res, "Game plays granted", data, 201);
});

exports.grantPlaysValidators = [
    body("userId").optional().isMongoId(),
    body("mobile")
        .optional()
        .matches(/^[6-9]\d{9}$/),
    body("gameType")
        .exists()
        .isString()
        .customSanitizer((v) => String(v || "").toUpperCase())
        .isIn(["WHEEL", "SCRATCH", "SHUFFLE", "BUBBLE"]),
    body("plays").optional().isInt({ min: 1, max: 100 }),
    body("expiresAt").optional({ nullable: true }).isISO8601(),
    body("note").optional().isString().isLength({ max: 300 }),
    body().custom((value) => {
        if (!value.userId && !value.mobile) {
            throw new Error("userId or mobile is required");
        }
        return true;
    }),
];
