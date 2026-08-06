/**
 * One-time setup for Play Store review demo account.
 * Uses PLAY_REVIEW_MOBILE from .env (same as auth bypass).
 *
 * Usage: npm run seed:play-review
 */
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../modules/api/user/model");
const UserProfile = require("../modules/api/user/profile.model");
const Wallet = require("../modules/api/wallet/model");
const Role = require("../modules/role/model");
const ROLES = require("../constants/roles");
const coinService = require("../modules/api/coins/service");
const walletService = require("../modules/api/wallet/service");
const userGamePlayService = require("../modules/api/games/userGamePlay.service");
const { getPlayReviewConfig } = require("../utils/playReviewAuth");
const { generateUserReferralCode } = require("../utils/generateReferralCode");

async function seed() {
    const cfg = getPlayReviewConfig();
    if (!cfg) {
        console.error(
            "Set PLAY_REVIEW_MOBILE (10 digits) and PLAY_REVIEW_OTP (6 digits) in .env first."
        );
        process.exit(1);
    }

    await connectDB();

    const userRole = await Role.findOne({ name: ROLES.USER });
    if (!userRole) {
        console.error("USER role missing. Run: npm run seed:roles");
        process.exit(1);
    }

    let user = await User.findOne({ mobile: cfg.mobile, isDeleted: false });

    if (!user) {
        const referralCode = await generateUserReferralCode();
        user = await User.create({
            mobile: cfg.mobile,
            role: userRole._id,
            isMobileVerified: true,
            status: "ACTIVE",
            referralCode,
        });
        console.log("Created play review user:", cfg.mobile);
    } else {
        user.status = "ACTIVE";
        user.isMobileVerified = true;
        await user.save();
        console.log("Updated play review user:", cfg.mobile);
    }

    let profile = await UserProfile.findOne({ user: user._id });
    if (!profile) {
        profile = await UserProfile.create({ user: user._id });
    }
    profile.firstName = profile.firstName || "Play";
    profile.lastName = profile.lastName || "Reviewer";
    profile.fullName = "Play Store Reviewer";
    profile.city = profile.city || "Mumbai";
    profile.state = profile.state || "Maharashtra";
    profile.country = profile.country || "India";
    profile.isProfileComplete = true;
    await profile.save();

    let wallet = await Wallet.findOne({ user: user._id });
    if (!wallet) {
        await Wallet.create({
            user: user._id,
            walletNumber: "WAL" + Date.now(),
        });
    }

    await coinService.getOrCreateWallet(user._id);

    try {
        await walletService.creditMoney(user._id, {
            amount: 500,
            description: "Play Store review demo balance",
            referenceId: "PLAY_REVIEW_SEED",
            notify: false,
        });
    } catch (err) {
        if (!/duplicate|already/i.test(err.message)) {
            console.warn("Wallet credit skipped:", err.message);
        }
    }

    try {
        await coinService.creditCoins(user._id, {
            amount: 500,
            source: "ADMIN",
            referenceId: "PLAY_REVIEW_SEED",
            description: "Play Store review demo coins",
            notify: false,
        });
    } catch (err) {
        console.warn("Coins credit skipped:", err.message);
    }

    for (const gameType of ["WHEEL", "SCRATCH", "SHUFFLE", "BUBBLE"]) {
        await userGamePlayService.grantPlays({
            userId: user._id,
            gameType,
            plays: 5,
            note: "Play Store review demo",
            source: "ADMIN",
        });
    }

    console.log("\nPlay review account ready:");
    console.log("  Mobile:", cfg.mobile);
    console.log("  OTP:   ", cfg.otp, "(from PLAY_REVIEW_OTP)");
    console.log("  Profile complete, wallet ₹500, 500 coins, 5 plays per game");
    console.log(
        "\nAdd to Play Console → App access:\n",
        `Phone: ${cfg.mobile}\nOTP: ${cfg.otp}\n`
    );

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
