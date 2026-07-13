const userProfileRepository = require("./userProfile.repository");
const ApiError = require("../../utils/ApiError");
const { formatProfile } = require("./user.mapper");
const {
    getAvatarPath,
    deleteAvatarFile,
} = require("../../middleware/upload.middleware");

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
    const profile = await userProfileRepository.findByUserId(userId);

    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    return formatProfile(profile);
};

exports.completeProfile = async (userId, body, avatarFile) => {
    const profile = await userProfileRepository.findByUserId(userId);

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

    const updated = await userProfileRepository.updateByUserId(userId, data);

    return formatProfile(updated);
};

exports.updateProfile = async (userId, body, avatarFile) => {
    const profile = await userProfileRepository.findByUserId(userId);

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

    const updated = await userProfileRepository.updateByUserId(userId, data);

    return formatProfile(updated);
};

exports.deleteAvatar = async (userId) => {
    const profile = await userProfileRepository.findByUserId(userId);

    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    if (!profile.avatar) {
        throw new ApiError(400, "No avatar to delete");
    }

    deleteAvatarFile(profile.avatar);

    const updated = await userProfileRepository.updateByUserId(userId, {
        avatar: null,
    });

    return formatProfile(updated);
};
