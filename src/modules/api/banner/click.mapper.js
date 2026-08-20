exports.formatBannerClick = (click) => {
    if (!click) return null;

    const data = click.toObject ? click.toObject() : click;
    const snapshot = data.userSnapshot || null;

    return {
        id: data._id,
        bannerId: data.banner,
        ipAddress: data.ipAddress || "",
        userAgent: data.userAgent || "",
        link: data.link || "",
        source: data.source || "APP",
        user: snapshot
            ? {
                  id: snapshot.id || (data.user ? String(data.user) : null),
                  mobile: snapshot.mobile || "",
                  email: snapshot.email || "",
                  firstName: snapshot.firstName || "",
                  lastName: snapshot.lastName || "",
                  fullName: snapshot.fullName || "",
                  status: snapshot.status || "",
                  role: snapshot.role || "",
              }
            : null,
        createdAt: data.createdAt,
    };
};
