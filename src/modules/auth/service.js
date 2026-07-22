const mongoose = require("mongoose");

const userRepository = require("../user/repository");
const userProfileRepository = require("../user/profile.repository");
const roleRepository = require("../role/repository");
const walletRepository = require("../wallet/repository");
const coinService = require("../coins/service");
const otpRepository = require("./otp.repository");

const ApiError = require("../../utils/ApiError");
const MESSAGES = require("../../constants/messages");
const ROLES = require("../../constants/roles");
const { generateAccessToken } = require("../../utils/jwt");
const { generateOtp, getOtpExpiry } = require("../../utils/generateOtp");
const {
    formatAuthUser,
    formatAuthPayload,
    getAuthRedirect,
} = require("../user/mapper");
const partnerService = require("../partner/service");
const userReferralService = require("../user/referral.service");
const {
    generateUserReferralCode,
} = require("../../utils/generateReferralCode");
const {
    canAuthenticate,
    STATUS_MESSAGES,
    getAllowedActions,
} = require("../../constants/userStatusPolicy");

const assertUserCanAuth = (user) => {
    if (!user) return;
    if (user.isDeleted) {
        throw new ApiError(403, STATUS_MESSAGES.INACTIVE);
    }
    if (!canAuthenticate(user.status)) {
        const err = new ApiError(
            403,
            STATUS_MESSAGES[user.status] || "Account access denied"
        );
        err.accountStatus = user.status;
        err.allowedActions = getAllowedActions(user.status);
        throw err;
    }
};

/** Active user for auth, or null. Soft-deleted rows that still hold the mobile are released. */
const resolveAuthUserByMobile = async (mobile) => {
    const user = await userRepository.findByMobile(mobile);
    if (user) return user;

    const deleted = await userRepository.findDeletedByMobile(mobile);
    if (deleted) {
        await userRepository.releaseDeletedIdentity(deleted);
    }
    return null;
};

const createUserAccount = async (mobile, session) => {
    const defaultRole = await roleRepository.getUserRole();

    if (!defaultRole) {
        throw new ApiError(500, "Default role not found. Run role seeder first.");
    }

    const referralCode = await generateUserReferralCode();

    const user = await userRepository.create(
        {
            mobile,
            role: defaultRole._id,
            isMobileVerified: true,
            referralCode,
        },
        session
    );

    const profile = await userProfileRepository.create(
        { user: user._id },
        session
    );

    await walletRepository.create(
        {
            user: user._id,
            walletNumber:
                "WAL" + Date.now() + Math.floor(Math.random() * 1000),
        },
        session
    );

    await coinService.getOrCreateWallet(user._id, session);

    return { user, profile, role: defaultRole };
};

const OTP_RESEND_COOLDOWN_MS = 15 * 1000;

const sendOtp = async (mobile, purpose, userId = null) => {
    const existing = await otpRepository.findLatest(mobile, purpose);
    const lastSent = existing?.lastSentAt || existing?.updatedAt || existing?.createdAt;

    if (lastSent) {
        const elapsed = Date.now() - new Date(lastSent).getTime();
        if (elapsed < OTP_RESEND_COOLDOWN_MS) {
            const retryAfterSeconds = Math.ceil(
                (OTP_RESEND_COOLDOWN_MS - elapsed) / 1000
            );
            const error = new ApiError(
                429,
                `Please wait ${retryAfterSeconds} seconds before requesting another OTP`
            );
            error.retryAfterSeconds = retryAfterSeconds;
            throw error;
        }
    }

    const otp = generateOtp();

    await otpRepository.upsertOtp({
        userId,
        mobile,
        purpose,
        otp,
        expiresAt: getOtpExpiry(5),
    });

    // TODO: integrate SMS provider
    console.log(`OTP for ${mobile} (${purpose}): ${otp}`);

    const payload = {
        redirectTo: "otp",
        mobile,
    };

    if (process.env.NODE_ENV !== "production") {
        payload.otp = otp;
    }

    return payload;
};

const validateOtp = async (mobile, otp, purpose) => {
    const otpRecord = await otpRepository.findValid(mobile, purpose);

    if (!otpRecord) {
        throw new ApiError(400, MESSAGES.OTP_INVALID);
    }

    if (otpRecord.attempts >= 5) {
        throw new ApiError(400, "Too many attempts. Request a new OTP.");
    }

    if (otpRecord.otp !== otp) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        throw new ApiError(400, MESSAGES.OTP_INVALID);
    }

    otpRecord.isVerified = true;
    await otpRecord.save();

    return otpRecord;
};

exports.mobileAuth = async (mobile) => {
    const existingUser = await resolveAuthUserByMobile(mobile);
    assertUserCanAuth(existingUser);

    const purpose = existingUser ? "LOGIN" : "REGISTER";

    const payload = await sendOtp(
        mobile,
        purpose,
        existingUser?._id || null
    );

    return {
        ...payload,
        isNewUser: !existingUser,
    };
};

exports.verifyOtp = async (mobile, otp, { partnerCode, referralCode } = {}) => {
    if (partnerCode && referralCode) {
        throw new ApiError(
            400,
            "Use either partnerCode or referralCode, not both"
        );
    }

    let user = await resolveAuthUserByMobile(mobile);
    assertUserCanAuth(user);

    const purpose = user ? "LOGIN" : "REGISTER";

    await validateOtp(mobile, otp, purpose);

    let isNewUser = false;
    let profile;
    let role;

    if (!user) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const created = await createUserAccount(mobile, session);
            user = created.user;
            profile = created.profile;
            role = created.role;
            isNewUser = true;
            await session.commitTransaction();
        } catch (error) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            throw error;
        } finally {
            session.endSession();
        }

        // Referral / partner link AFTER commit (must not abort the create txn)
        if (partnerCode) {
            const code = String(partnerCode).trim().toUpperCase();
            if (code.startsWith("USR")) {
                throw new ApiError(
                    400,
                    "USR codes are user referral codes — send as referralCode, not partnerCode"
                );
            }
            const linked = await partnerService.linkReferral(
                partnerCode,
                user._id
            );
            if (!linked) {
                throw new ApiError(400, "Invalid or inactive partner code");
            }
            user = await userRepository.findById(user._id);
        } else if (referralCode) {
            const code = String(referralCode).trim().toUpperCase();
            if (code.startsWith("PRT")) {
                throw new ApiError(
                    400,
                    "PRT codes are partner codes — send as partnerCode, not referralCode"
                );
            }
            const linked = await userReferralService.linkUserReferral(
                referralCode,
                user._id
            );
            if (!linked) {
                throw new ApiError(400, "Invalid or inactive referral code");
            }
            user = await userRepository.findById(user._id);
        }

        try {
            const rewardRuleService = require("../rewards/rewardRule.service");
            await rewardRuleService.applyTrigger("USER_SIGNUP", user._id);
        } catch (err) {
            console.error("USER_SIGNUP reward rules failed:", err.message);
        }
    } else {
        user.isMobileVerified = true;
        user.lastLogin = new Date();
        if (!user.referralCode) {
            user.referralCode = await generateUserReferralCode();
        }
        await user.save();

        profile = await userProfileRepository.findOne({ user: user._id });
        role = await roleRepository.findById(user.role);

        // Old approve flow set role=PARTNER — restore USER (partner = Partner.status)
        if (role?.name === ROLES.PARTNER) {
            const { getPartnerAccess } = require("../partner/access");
            const access = await getPartnerAccess(user._id);
            if (access.isApproved) {
                const userRole = await roleRepository.getUserRole();
                if (userRole) {
                    await userRepository.update(user._id, {
                        role: userRole._id,
                    });
                    role = userRole;
                    user.role = userRole._id;
                }
            }
        }
    }

    const referral = await userReferralService.getMyReferralInfo(user._id);
    const {
        getPartnerAccess,
        formatPartnerAccount,
    } = require("../partner/access");
    const partnerAccount = formatPartnerAccount(
        await getPartnerAccess(user._id)
    );

    return formatAuthPayload({
        isNewUser,
        redirectTo: getAuthRedirect(profile),
        token: generateAccessToken({
            id: user._id,
            role: role.name,
        }),
        user: formatAuthUser(user, profile, role, referral, partnerAccount),
    });
};
