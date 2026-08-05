const profileRepository = require("./profile.repository");
const userRepository = require("./repository");
const referralService = require("./referral.service");
const ApiError = require("../../../utils/ApiError");
const { formatProfile } = require("./mapper");
const {
    getAvatarPath,
    deleteAvatarFile,
} = require("../../../middleware/upload.middleware");
const { generateUserReferralCode } = require("../../../utils/generateReferralCode");

const buildProfileData = (body, avatarFile) => {
    const data = {};

    if (body.firstName !== undefined) data.firstName = body.firstName.trim();
    if (body.lastName !== undefined) data.lastName = body.lastName.trim();
    if (body.gender !== undefined) data.gender = body.gender;
    if (body.dob !== undefined) data.dob = body.dob || null;
    if (body.address !== undefined) data.address = body.address.trim();
    if (body.city !== undefined) data.city = body.city.trim();
    if (body.state !== undefined) data.state = body.state.trim();
    if (body.country !== undefined) data.country = body.country.trim();
    if (body.pincode !== undefined) data.pincode = body.pincode.trim();

    if (avatarFile) {
        data.avatar = getAvatarPath(avatarFile.filename);
    }

    return data;
};

exports.getMyProfile = async (userId) => {
    const profile = await profileRepository.findByUserId(userId);
    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    const user = await userRepository.findById(userId);
    if (user && !user.referralCode) {
        user.referralCode = await generateUserReferralCode();
        await user.save();
    }

    const [referral, kyc] = await Promise.all([
        referralService.getMyReferralInfo(userId),
        require("../kyc/service").getMyKyc(userId),
    ]);

    const {
        getPartnerAccess,
        formatPartnerAccount,
    } = require("../partner/access");
    const partnerAccount = formatPartnerAccount(
        await getPartnerAccess(userId)
    );

    return {
        ...formatProfile(profile),
        mobile: user?.mobile || "",
        countryCode: user?.countryCode || "+91",
        referral,
        kyc,
        partnerAccount,
    };
};

exports.completeProfile = async (userId, body, avatarFile) => {
    const profile = await profileRepository.findByUserId(userId);
    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    if (profile.isProfileComplete) {
        throw new ApiError(400, "Profile already completed. Use update instead.");
    }

    if (!body.firstName?.trim()) {
        throw new ApiError(400, "First name is required to complete profile");
    }

    const data = buildProfileData(body, avatarFile);
    data.isProfileComplete = true;

    const updated = await profileRepository.updateByUserId(userId, data);
    return formatProfile(updated);
};

exports.updateProfile = async (userId, body, avatarFile) => {
    const profile = await profileRepository.findByUserId(userId);
    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    const data = buildProfileData(body, avatarFile);

    if (avatarFile && profile.avatar) {
        deleteAvatarFile(profile.avatar);
    }

    if (Object.keys(data).length === 0) {
        throw new ApiError(400, "No profile data provided");
    }

    if (data.firstName || data.lastName) {
        data.isProfileComplete = true;
    }

    const updated = await profileRepository.updateByUserId(userId, data);
    return formatProfile(updated);
};

exports.deleteAvatar = async (userId) => {
    const profile = await profileRepository.findByUserId(userId);
    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    if (!profile.avatar) {
        throw new ApiError(400, "No avatar to delete");
    }

    deleteAvatarFile(profile.avatar);

    const updated = await profileRepository.updateByUserId(userId, {
        avatar: null,
    });
    return formatProfile(updated);
};

exports.getMyReferralLink = async (userId, roleName) => {
    return referralService.getMyReferralInfo(userId, roleName);
};

exports.getMyReferrals = async (userId, query, roleName) => {
    return referralService.getMyReferrals(userId, query, roleName);
};

const soft = async (fn, fallback = null) => {
    try {
        return await fn();
    } catch {
        return fallback;
    }
};

/**
 * Home-screen aggregate: profile + wallet + coins + mandates +
 * notifications + KYC + credit + rewards + games + partner + referral.
 */
exports.getDashboard = async (userId) => {
    const {
        getAllowedActions,
        STATUS_MESSAGES,
    } = require("../../../constants/userStatusPolicy");
    const {
        getPartnerAccess,
        formatPartnerAccount,
    } = require("../partner/access");
    const { formatKycSummary } = require("../kyc/mapper");
    const { formatWallet } = require("../wallet/mapper");
    const walletRepository = require("../wallet/repository");
    const coinService = require("../coins/service");
    const notificationService = require("../notification/service");
    const rewardsService = require("../rewards/service");
    const creditReportRepository = require("../creditReport/repository");
    const Mandate = require("../mandate/mandate.model");
    const { formatMandate } = require("../mandate/mapper");
    const userGamePlayService = require("../games/userGamePlay.service");
    const Kyc = require("../kyc/model");

    const slimMandate = (doc) => {
        const m = formatMandate(doc);
        if (!m) return null;
        return {
            id: m.id,
            rocketpayId: m.rocketpayId,
            state: m.state,
            frequency: m.frequency,
            mode: m.mode,
            customerName: m.customerName,
            customerMobile: m.customerMobile,
            approvalAmount: m.approvalAmount,
            startDate: m.startDate,
            endDate: m.endDate,
            checkoutUrl: m.checkoutUrl,
            auth: m.auth
                ? {
                      checkoutUrl: m.auth.checkoutUrl,
                      shareUrl: m.auth.shareUrl,
                      qr: m.auth.qr,
                      medium: m.auth.medium,
                  }
                : null,
            createdAt: m.createdAt,
        };
    };

    const profile = await profileRepository.findByUserId(userId);
    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    const user = await userRepository.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.referralCode) {
        user.referralCode = await generateUserReferralCode();
        await user.save();
    }

    const [
        referral,
        partnerAccess,
        kycDoc,
        walletDoc,
        coins,
        notifications,
        rewards,
        latestCredit,
        mandateAgg,
        recentMandates,
        games,
    ] = await Promise.all([
        soft(() => referralService.getMyReferralInfo(userId), null),
        soft(() => getPartnerAccess(userId), null),
        soft(() => Kyc.findOne({ user: userId }), null),
        soft(() => walletRepository.findByUserId(userId), null),
        soft(() => coinService.getMyCoins(userId), null),
        soft(() => notificationService.getUnreadCount(userId), {
            unreadCount: 0,
        }),
        soft(() => rewardsService.getMyRewardStats(userId), {
            total: 0,
            pendingCount: 0,
            claimedCount: 0,
            expiredCount: 0,
            cancelledCount: 0,
            usableCount: 0,
        }),
        soft(
            () => creditReportRepository.findLatestByUserId(userId),
            null
        ),
        soft(
            () =>
                Mandate.aggregate([
                    { $match: { user: user._id } },
                    { $group: { _id: "$state", count: { $sum: 1 } } },
                ]),
            []
        ),
        soft(
            () =>
                Mandate.find({ user: userId })
                    .sort({ createdAt: -1 })
                    .limit(3),
            []
        ),
        soft(() => userGamePlayService.getMyGames(userId), {
            games: [],
            totalAvailablePlays: 0,
        }),
    ]);

    const byState = {};
    let mandateTotal = 0;
    for (const row of mandateAgg || []) {
        const key = row._id || "UNKNOWN";
        byState[key] = row.count;
        mandateTotal += row.count;
    }

    const profileData = formatProfile(profile);

    return {
        user: {
            id: user._id,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            fullName: profileData.fullName,
            mobile: user.mobile || "",
            email: user.email || "",
            countryCode: user.countryCode || "+91",
            avatar: profileData.avatar,
            gender: profileData.gender,
            dob: profileData.dob,
            address: profileData.address,
            city: profileData.city,
            state: profileData.state,
            country: profileData.country,
            pincode: profileData.pincode,
            status: user.status,
            statusMessage: STATUS_MESSAGES[user.status] || null,
            allowedActions: getAllowedActions(user.status),
            isMobileVerified: Boolean(user.isMobileVerified),
            isEmailVerified: Boolean(user.isEmailVerified),
            isProfileComplete: profileData.isProfileComplete,
            createdAt: user.createdAt,
        },
        profile: profileData,
        partnerAccount: formatPartnerAccount(partnerAccess),
        kyc: {
            ...formatKycSummary(kycDoc),
            canSubmit: !kycDoc || kycDoc.status === "REJECTED",
        },
        wallet: formatWallet(walletDoc),
        coins,
        rewards,
        notifications: {
            unreadCount: notifications?.unreadCount || 0,
        },
        credit: latestCredit
            ? (() => {
                  const { formatCreditReport } = require("../creditReport/mapper");
                  const c = formatCreditReport(latestCredit);
                  return {
                      id: c.id,
                      score: c.score,
                      scoreName: c.scoreName,
                      status: c.status,
                      pan: c.pan,
                      pdfPath: c.pdfPath,
                      pdfUrl: c.pdfUrl,
                      createdAt: c.createdAt,
                  };
              })()
            : null,
        mandates: {
            total: mandateTotal,
            byState,
            activatedCount: byState.ACTIVATED || 0,
            createdCount: byState.CREATED || 0,
            recent: (recentMandates || []).map(slimMandate).filter(Boolean),
        },
        games,
        referral,
    };
};
