const express = require("express");

const authController = require("./auth.controller");
const authValidator = require("./auth.validator");
const validate = require("../../middleware/validation.middleware");

const router = express.Router();

router.post(
    "/mobile",
    authValidator.mobileAuth,
    validate,
    authController.mobileAuth
);

router.post(
    "/verify-otp",
    authValidator.verifyOtp,
    validate,
    authController.verifyOtp
);

module.exports = router;
