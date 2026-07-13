const adminService = require("./admin.service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");
const MESSAGES = require("../../constants/messages");

exports.login = asyncHandler(async (req, res) => {
    const data = await adminService.login(req.body.email, req.body.password);
    return response.success(res, MESSAGES.LOGIN_SUCCESS, data);
});

exports.getDashboard = asyncHandler(async (req, res) => {
    const data = await adminService.getDashboard();
    return response.success(res, "Dashboard fetched successfully", data);
});

exports.getUsers = asyncHandler(async (req, res) => {
    const data = await adminService.getUsers(req.query);
    return response.success(res, "Users fetched successfully", data);
});

exports.getUserById = asyncHandler(async (req, res) => {
    const data = await adminService.getUserById(req.params.id);
    return response.success(res, "User fetched successfully", data);
});

exports.updateUserStatus = asyncHandler(async (req, res) => {
    const data = await adminService.updateUserStatus(
        req.params.id,
        req.body.status
    );
    return response.success(res, "User status updated", data);
});

exports.updateUser = asyncHandler(async (req, res) => {
    const data = await adminService.updateUser(req.params.id, req.body);
    return response.success(res, "User updated successfully", data);
});

exports.deleteUser = asyncHandler(async (req, res) => {
    const data = await adminService.deleteUser(req.params.id);
    return response.success(res, "User deleted successfully", data);
});

exports.getMe = asyncHandler(async (req, res) => {
    const data = await adminService.getMe(req.user.id);
    return response.success(res, "Admin profile fetched", data);
});

exports.getRoles = asyncHandler(async (req, res) => {
    const data = await adminService.getRoles();
    return response.success(res, "Roles fetched successfully", data);
});
