exports.formatBanner = (banner, { publicView = false } = {}) => {
    if (!banner) return null;

    const data = banner.toObject ? banner.toObject() : banner;

    const mapped = {
        id: data._id,
        title: data.title,
        description: data.description || "",
        link: data.link || "",
        image: data.image,
        sortOrder: data.sortOrder ?? 0,
    };

    if (!publicView) {
        mapped.status = data.status;
        mapped.createdBy = data.createdBy || null;
        mapped.createdAt = data.createdAt;
        mapped.updatedAt = data.updatedAt;
    }

    return mapped;
};
