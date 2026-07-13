const profileService = require("./profile.service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getMyProfile = asyncHandler(async (req, res) => {
    const profile = await profileService.getMyProfile(req.user.id);

    return response.success(res, "Profile fetched successfully", profile);
});

exports.completeProfile = asyncHandler(async (req, res) => {
    const profile = await profileService.completeProfile(
        req.user.id,
        req.body,
        req.file
    );

    return response.success(
        res,
        "Profile completed successfully",
        profile,
        201
    );
});

exports.updateProfile = asyncHandler(async (req, res) => {
    const profile = await profileService.updateProfile(
        req.user.id,
        req.body,
        req.file
    );

    return response.success(res, "Profile updated successfully", profile);
});

exports.deleteAvatar = asyncHandler(async (req, res) => {
    const profile = await profileService.deleteAvatar(req.user.id);

    return response.success(res, "Avatar deleted successfully", profile);
});
