const walletService = require("./wallet.service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getMyWallet = asyncHandler(async (req, res) => {
    const wallet = await walletService.getMyWallet(req.user.id);
    return response.success(res, "Wallet fetched successfully", wallet);
});

exports.getTransactions = asyncHandler(async (req, res) => {
    const data = await walletService.getTransactions(req.user.id, req.query);
    return response.success(res, "Transactions fetched successfully", data);
});

exports.addMoney = asyncHandler(async (req, res) => {
    const data = await walletService.addMoney(req.user.id, req.body);
    return response.success(res, "Money added successfully", data, 201);
});

exports.getBeneficiaries = asyncHandler(async (req, res) => {
    const data = await walletService.getBeneficiaries(req.user.id);
    return response.success(res, "Beneficiaries fetched successfully", data);
});

exports.addBeneficiary = asyncHandler(async (req, res) => {
    const data = await walletService.addBeneficiary(req.user.id, req.body);
    return response.success(res, "Beneficiary added successfully", data, 201);
});

exports.updateBeneficiary = asyncHandler(async (req, res) => {
    const data = await walletService.updateBeneficiary(
        req.user.id,
        req.params.id,
        req.body
    );
    return response.success(res, "Beneficiary updated successfully", data);
});

exports.deleteBeneficiary = asyncHandler(async (req, res) => {
    const data = await walletService.deleteBeneficiary(
        req.user.id,
        req.params.id
    );
    return response.success(res, "Beneficiary deleted successfully", data);
});
