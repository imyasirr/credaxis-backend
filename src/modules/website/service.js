const WebsitePage = require("./page.model");
const ApiError = require("../../utils/ApiError");

class WebsiteService {
    /**
     * Get list of published pages with SEO metadata
     */
    async getPages() {
        const pages = await WebsitePage.find({
            isPublished: true,
            status: true,
        })
            .select("name slug description seo isPublished updatedAt")
            .sort({ name: 1 })
            .lean();

        return pages;
    }

    /**
     * Get a single published page by slug with active sections
     */
    async getPageBySlug(slug) {
        const page = await WebsitePage.findOne({
            slug: slug.toLowerCase(),
            isPublished: true,
            status: true,
        }).lean();

        if (!page) {
            throw new ApiError(404, `Page '${slug}' not found or unavailable`);
        }

        // Filter active sections and sort by order
        if (Array.isArray(page.sections)) {
            page.sections = page.sections
                .filter((s) => s.status !== false)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
        }

        return page;
    }

    /**
     * Get a specific section of a published page
     */
    async getPageSection(slug, sectionKey) {
        const page = await this.getPageBySlug(slug);

        const section = page.sections?.find((s) => s.key === sectionKey);
        if (!section) {
            throw new ApiError(
                404,
                `Section '${sectionKey}' not found on page '${slug}'`
            );
        }

        return section;
    }
}

module.exports = new WebsiteService();
