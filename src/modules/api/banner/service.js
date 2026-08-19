const PromoBanner = require("./model");
const { formatBanner } = require("./mapper");
const ApiError = require("../../../utils/ApiError");
const {
    getUploadPath,
    deleteUploadFile,
} = require("../../../middleware/upload.middleware");

const SORTABLE_FIELDS = {
    title: "title",
    status: "status",
    sortOrder: "sortOrder",
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

    return {
        id: banner._id,
        title: banner.title,
    };
};
