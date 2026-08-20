const PromoBanner = require("./model");
const PromoBannerClick = require("./click.model");
const { formatBanner } = require("./mapper");
const { formatBannerClick } = require("./click.mapper");
const ApiError = require("../../../utils/ApiError");
const {
    getUploadPath,
    deleteUploadFile,
} = require("../../../middleware/upload.middleware");
const userRepository = require("../user/repository");
const profileRepository = require("../user/profile.repository");
const roleRepository = require("../../role/repository");
const ROLES = require("../../../constants/roles");

const SORTABLE_FIELDS = {
    title: "title",
    status: "status",
    sortOrder: "sortOrder",
    clickCount: "clickCount",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
};

const imagePathFromFile = (file) =>
    file ? getUploadPath("banners", file.filename) : null;

exports.listActive = async () => {
    const banners = await PromoBanner.find({ status: "ACTIVE" })
        .sort({ sortOrder: 1, createdAt: -1 });

    return banners.map((banner) => formatBanner(banner, { publicView: true }));
};

exports.getBanners = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.status) {
        filter.status = query.status;
    }

    if (query.search) {
        const search = query.search.trim();
        filter.$or = [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { link: { $regex: search, $options: "i" } },
        ];
    }

    const sortField =
        SORTABLE_FIELDS[query.sortBy] || SORTABLE_FIELDS.sortOrder;
    const sortDir = query.sortOrder === "desc" ? -1 : 1;

    const [banners, total] = await Promise.all([
        PromoBanner.find(filter)
            .sort({ [sortField]: sortDir, createdAt: -1 })
            .skip(skip)
            .limit(limit),
        PromoBanner.countDocuments(filter),
    ]);

    return {
        banners: banners.map((banner) => formatBanner(banner)),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
};

exports.getBannerById = async (bannerId) => {
    const banner = await PromoBanner.findById(bannerId);

    if (!banner) {
        throw new ApiError(404, "Banner not found");
    }

    return formatBanner(banner);
};

exports.createBanner = async (adminId, body, file) => {
    if (!file) {
        throw new ApiError(400, "Banner image is required");
    }

    const banner = await PromoBanner.create({
        title: body.title.trim(),
        description: body.description?.trim() || "",
        link: body.link?.trim() || "",
        image: imagePathFromFile(file),
        status: body.status || "ACTIVE",
        sortOrder:
            body.sortOrder !== undefined && body.sortOrder !== ""
                ? Number(body.sortOrder)
                : 0,
        createdBy: adminId,
    });

    return formatBanner(banner);
};

exports.updateBanner = async (bannerId, body, file) => {
    const banner = await PromoBanner.findById(bannerId);

    if (!banner) {
        throw new ApiError(404, "Banner not found");
    }

    if (body.title !== undefined) banner.title = body.title.trim();
    if (body.description !== undefined) {
        banner.description = body.description.trim();
    }
    if (body.link !== undefined) banner.link = body.link.trim();
    if (body.status !== undefined) banner.status = body.status;
    if (body.sortOrder !== undefined && body.sortOrder !== "") {
        banner.sortOrder = Number(body.sortOrder);
    }

    if (file) {
        const previousImage = banner.image;
        banner.image = imagePathFromFile(file);
        if (previousImage && previousImage !== banner.image) {
            deleteUploadFile(previousImage);
        }
    }

    await banner.save();

    return formatBanner(banner);
};

exports.deleteBanner = async (bannerId) => {
    const banner = await PromoBanner.findByIdAndDelete(bannerId);

    if (!banner) {
        throw new ApiError(404, "Banner not found");
    }

    deleteUploadFile(banner.image);
    await PromoBannerClick.deleteMany({ banner: bannerId });

    return {
        id: banner._id,
        title: banner.title,
    };
};

const buildUserSnapshot = async (userId) => {
    if (!userId) return null;

    const user = await userRepository.findById(userId);
    if (!user) return null;

    const [profile, role] = await Promise.all([
        profileRepository.findByUserId(user._id),
        user.role ? roleRepository.findById(user.role) : null,
    ]);

    const firstName = profile?.firstName || "";
    const lastName = profile?.lastName || "";
    const fullName =
        profile?.fullName || [firstName, lastName].filter(Boolean).join(" ");

    return {
        id: user._id.toString(),
        mobile: user.mobile || "",
        email: user.email || "",
        firstName,
        lastName,
        fullName,
        status: user.status || "",
        role: role?.name || "",
    };
};

const resolveClickSource = (userId, roleName) => {
    if (!userId) return "ANONYMOUS";
    if (roleName === ROLES.ADMIN) return "ADMIN";
    return "APP";
};

exports.recordClick = async ({
    bannerId,
    userId = null,
    roleName = null,
    ipAddress = "",
    userAgent = "",
    source = null,
}) => {
    const banner = await PromoBanner.findById(bannerId);
    if (!banner) {
        throw new ApiError(404, "Banner not found");
    }

    const snapshot = await buildUserSnapshot(userId);
    const clickSource =
        source || resolveClickSource(userId, snapshot?.role || roleName);

    const [click] = await Promise.all([
        PromoBannerClick.create({
            banner: banner._id,
            ipAddress: ipAddress || "",
            userAgent: String(userAgent || "").slice(0, 512),
            link: banner.link || "",
            source: clickSource,
            user: userId || null,
            ...(snapshot ? { userSnapshot: snapshot } : {}),
        }),
        PromoBanner.updateOne({ _id: banner._id }, { $inc: { clickCount: 1 } }),
    ]);

    return formatBannerClick(click);
};

exports.listClicks = async (bannerId, query = {}) => {
    const banner = await PromoBanner.findById(bannerId).select("_id title");
    if (!banner) {
        throw new ApiError(404, "Banner not found");
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = { banner: bannerId };

    if (query.search) {
        const search = query.search.trim();
        filter.$or = [
            { ipAddress: { $regex: search, $options: "i" } },
            { link: { $regex: search, $options: "i" } },
            { "userSnapshot.mobile": { $regex: search, $options: "i" } },
            { "userSnapshot.email": { $regex: search, $options: "i" } },
            { "userSnapshot.fullName": { $regex: search, $options: "i" } },
            { "userSnapshot.firstName": { $regex: search, $options: "i" } },
        ];
    }

    if (query.source) {
        filter.source = query.source;
    }

    const [clicks, total] = await Promise.all([
        PromoBannerClick.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        PromoBannerClick.countDocuments(filter),
    ]);

    return {
        banner: {
            id: banner._id,
            title: banner.title,
        },
        clicks: clicks.map(formatBannerClick),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
};

