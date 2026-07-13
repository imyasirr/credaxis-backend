const crypto = require("crypto");

exports.generateOtp = (length = 6) => {
    const max = 10 ** length;
    const otp = crypto.randomInt(0, max);
    return String(otp).padStart(length, "0");
};

exports.getOtpExpiry = (minutes = 5) => {
    return new Date(Date.now() + minutes * 60 * 1000);
};
