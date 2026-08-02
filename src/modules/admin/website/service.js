const WebsitePage = require("../../website/page.model");
const WebsiteMedia = require("../../website/media.model");
const ApiError = require("../../../utils/ApiError");
const { deleteUploadFile } = require("../../../middleware/upload.middleware");

class AdminWebsiteService {
    // ── PAGE MANAGEMENT ──────────────────────────────────────────

    /**
     * Get paginated & searchable list of website pages
     */
    async getAllPages({ search, isPublished, page = 1, limit = 20 }) {
        const query = { status: true };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { slug: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
            ];
        }

        if (isPublished !== undefined && isPublished !== "") {
            query.isPublished = isPublished === "true" || isPublished === true;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [pages, total] = await Promise.all([
            WebsitePage.find(query)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            WebsitePage.countDocuments(query),
        ]);

        return {
            pages,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit)),
            },
        };
    }

    /**
     * Get page details by ID
     */
    async getPageById(id) {
        const page = await WebsitePage.findById(id).lean();
        if (!page) {
            throw new ApiError(404, "Page not found");
        }
        return page;
    }

    /**
     * Create a new website page
     */
    async createPage(data, userId) {
        const existing = await WebsitePage.findOne({
            slug: data.slug.toLowerCase(),
        });
        if (existing) {
            throw new ApiError(400, `Page with slug '${data.slug}' already exists`);
        }

        const page = await WebsitePage.create({
            ...data,
            slug: data.slug.toLowerCase(),
            createdBy: userId,
            updatedBy: userId,
        });

        return page;
    }

    /**
     * Update page metadata, SEO, or full object
     */
    async updatePage(id, data, userId) {
        const page = await WebsitePage.findById(id);
        if (!page) {
            throw new ApiError(404, "Page not found");
        }

        if (data.slug && data.slug.toLowerCase() !== page.slug) {
            const existing = await WebsitePage.findOne({
                slug: data.slug.toLowerCase(),
                _id: { $ne: id },
            });
            if (existing) {
                throw new ApiError(400, `Page with slug '${data.slug}' already exists`);
            }
            page.slug = data.slug.toLowerCase();
        }

        if (data.name !== undefined) page.name = data.name;
        if (data.description !== undefined) page.description = data.description;
        if (data.isPublished !== undefined) page.isPublished = data.isPublished;
        if (data.status !== undefined) page.status = data.status;
        if (data.sections !== undefined) page.sections = data.sections;
        if (data.seo !== undefined) {
            page.seo = {
                ...page.seo?.toObject(),
                ...data.seo,
            };
        }

        page.updatedBy = userId;
        await page.save();

        return page;
    }

    /**
     * Delete a page (hard delete or soft status set to false)
     */
    async deletePage(id) {
        const page = await WebsitePage.findByIdAndDelete(id);
        if (!page) {
            throw new ApiError(404, "Page not found");
        }
        return { message: "Page deleted successfully", id };
    }

    // ── SECTION MANAGEMENT ──────────────────────────────────────────

    /**
     * Replace all sections in a page
     */
    async updatePageSections(id, sections, userId) {
        const page = await WebsitePage.findById(id);
        if (!page) {
            throw new ApiError(404, "Page not found");
        }

        page.sections = sections;
        page.updatedBy = userId;
        await page.save();

        return page;
    }

    /**
     * Add or update a single section in a page by section key
     */
    async upsertSection(id, sectionData, userId) {
        const page = await WebsitePage.findById(id);
        if (!page) {
            throw new ApiError(404, "Page not found");
        }

        const index = page.sections.findIndex((s) => s.key === sectionData.key);
        if (index > -1) {
            // Update existing section
            page.sections[index] = {
                ...page.sections[index].toObject(),
                ...sectionData,
            };
        } else {
            // Add new section
            page.sections.push(sectionData);
        }

        page.updatedBy = userId;
        await page.save();

        return page;
    }

    /**
     * Remove a section by key from a page
     */
    async deleteSection(id, sectionKey, userId) {
        const page = await WebsitePage.findById(id);
        if (!page) {
            throw new ApiError(404, "Page not found");
        }

        const initialCount = page.sections.length;
        page.sections = page.sections.filter((s) => s.key !== sectionKey);

        if (page.sections.length === initialCount) {
            throw new ApiError(404, `Section '${sectionKey}' not found on this page`);
        }

        page.updatedBy = userId;
        await page.save();

        return page;
    }

    /**
     * Reorder sections of a page
     * sectionOrders: [{ key: 'hero', order: 1 }, { key: 'features', order: 2 }]
     */
    async reorderSections(id, sectionOrders, userId) {
        const page = await WebsitePage.findById(id);
        if (!page) {
            throw new ApiError(404, "Page not found");
        }

        const orderMap = new Map();
        sectionOrders.forEach((item) => orderMap.set(item.key, item.order));

        page.sections.forEach((section) => {
            if (orderMap.has(section.key)) {
                section.order = orderMap.get(section.key);
            }
        });

        page.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
        page.updatedBy = userId;
        await page.save();

        return page;
    }

    // ── MEDIA MANAGEMENT ──────────────────────────────────────────

    /**
     * Get paginated media files list
     */
    async getAllMedia({ search, folder = "website", page = 1, limit = 30 }) {
        const query = { status: true };
        if (folder) query.folder = folder;

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { fileName: { $regex: search, $options: "i" } },
                { alt: { $regex: search, $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [media, total] = await Promise.all([
            WebsiteMedia.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            WebsiteMedia.countDocuments(query),
        ]);

        return {
            media,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit)),
            },
        };
    }

    /**
     * Save uploaded media record in database
     */
    async createMedia({ file, body }, userId) {
        if (!file) {
            throw new ApiError(400, "No media file uploaded");
        }

        const media = await WebsiteMedia.create({
            title: body?.title || file.originalname,
            fileName: file.filename,
            url: `/uploads/website/${file.filename}`,
            alt: body?.alt || "",
            mimeType: file.mimetype,
            size: file.size,
            folder: body?.folder || "website",
            uploadedBy: userId,
        });

        return media;
    }

    /**
     * Delete media record and remove physical file
     */
    async deleteMedia(id) {
        const media = await WebsiteMedia.findById(id);
        if (!media) {
            throw new ApiError(404, "Media file not found");
        }

        deleteUploadFile(media.url);
        await media.deleteOne();

        return { message: "Media deleted successfully", id };
    }

    // ── DEFAULT PAGE SEEDER ───────────────────────────────────────

    /**
     * Seed standard website pages into MongoDB if they don't exist
     */
    async seedDefaultPages(userId = null) {
        const defaultPages = [
            {
                name: "Home Page",
                slug: "home",
                description: "Main marketing homepage for CredAxis",
                isPublished: true,
                seo: {
                    metaTitle: "CredAxis - Your Gateway to Smart Financial Growth & Rewards",
                    metaDescription: "Experience instant credit line, rewards, game zones, UPI payments, and hassle-free financial solutions with CredAxis.",
                    keywords: ["CredAxis", "Credit Card", "Loans", "Rewards", "UPI Credit"],
                },
                sections: [
                    {
                        key: "hero",
                        title: "Unlock Instant Credit & Elevate Your Financial Freedom",
                        subtitle: "Smart Financial Platform",
                        description: "Get instant access to digital credit lines, earn rewards on every spend, and experience seamless payments across India.",
                        image: "/uploads/website/hero-banner.png",
                        order: 1,
                        status: true,
                        buttons: [
                            { text: "Apply Now", link: "/credit-cards", target: "_self" },
                            { text: "Download App", link: "/#download", target: "_self" },
                        ],
                    },
                    {
                        key: "features",
                        title: "Why Choose CredAxis?",
                        subtitle: "Designed for modern India",
                        description: "All-in-one financial ecosystem built for speed, security, and maximum benefits.",
                        order: 2,
                        status: true,
                        items: [
                            { icon: "Zap", title: "Instant Approval", description: "Zero documentation hassle, instant digital sanction." },
                            { icon: "Gift", title: "Reward Coins", description: "Earn coins on every transaction and redeem for cash vouchers." },
                            { icon: "ShieldCheck", title: "100% Secure", description: "RBI Compliant bank partners & enterprise-grade encryption." },
                            { icon: "CreditCard", title: "UPI On Credit", description: "Scan any QR code and pay directly using your credit limit." },
                        ],
                    },
                    {
                        key: "credit_cards_preview",
                        title: "Handpicked Premium Credit Cards",
                        subtitle: "Tailored for your lifestyle",
                        description: "Compare and select cards with high rewards, airport lounge access, and zero annual fee offers.",
                        order: 3,
                        status: true,
                    },
                    {
                        key: "loans_overview",
                        title: "Flexible Loan Solutions",
                        subtitle: "Competitive rates & quick disbursal",
                        description: "From personal emergencies to business expansion, get loans tailored to your needs.",
                        order: 4,
                        status: true,
                    },
                    {
                        key: "download_app",
                        title: "Manage Everything on the Go",
                        subtitle: "Download the CredAxis Mobile App",
                        description: "Available on Android and iOS. Track credit score, play games for coins, and make instant payments.",
                        order: 5,
                        status: true,
                    },
                ],
            },
            {
                name: "About Us",
                slug: "about-us",
                description: "About CredAxis company, mission, and leadership",
                isPublished: true,
                seo: {
                    metaTitle: "About Us - CredAxis",
                    metaDescription: "Learn more about CredAxis vision, mission, partners, and our commitment to financial inclusion.",
                    keywords: ["About CredAxis", "Financial Inclusion", "CredAxis Team"],
                },
                sections: [
                    {
                        key: "about_hero",
                        title: "Empowering Millions with Seamless Digital Credit",
                        subtitle: "Our Story",
                        description: "CredAxis is built to bridge the gap between aspirations and financial access through technology and trust.",
                        order: 1,
                        status: true,
                    },
                    {
                        key: "mission_vision",
                        title: "Our Mission & Vision",
                        order: 2,
                        status: true,
                        items: [
                            { title: "Our Mission", description: "To make credit accessible, transparent, and rewarding for every Indian." },
                            { title: "Our Vision", description: "To build India's most trusted AI-powered digital financial ecosystem." },
                        ],
                    },
                ],
            },
            {
                name: "Credit Cards",
                slug: "credit-cards",
                description: "Credit card products and comparison",
                isPublished: true,
                seo: {
                    metaTitle: "Credit Cards - Compare & Apply Online | CredAxis",
                    metaDescription: "Explore top credit cards with zero annual fees, cashback, and exclusive travel rewards.",
                    keywords: ["Credit Cards", "Cashback Card", "Zero Fee Card"],
                },
                sections: [
                    {
                        key: "cards_hero",
                        title: "Find the Perfect Credit Card for You",
                        subtitle: "Instant Digital Approval",
                        description: "Choose from lifetime free cards, cashback powerhouses, and luxury travel cards.",
                        order: 1,
                        status: true,
                    },
                ],
            },
            {
                name: "Loans",
                slug: "loans",
                description: "Instant personal and business loans",
                isPublished: true,
                seo: {
                    metaTitle: "Instant Loans - Low Interest Rates | CredAxis",
                    metaDescription: "Apply for instant personal, business, or gold loans with flexible repayment tenures.",
                    keywords: ["Instant Loan", "Personal Loan", "Business Loan"],
                },
                sections: [
                    {
                        key: "loans_hero",
                        title: "Instant Loans Up to ₹10 Lakhs",
                        subtitle: "Minimal Documentation",
                        description: "Get funds transferred directly to your bank account within minutes.",
                        order: 1,
                        status: true,
                    },
                ],
            },
            {
                name: "Insurance",
                slug: "insurance",
                description: "Health, life, and motor insurance products",
                isPublished: true,
                seo: {
                    metaTitle: "Insurance Solutions - Health, Life & Vehicle | CredAxis",
                    metaDescription: "Protect what matters most with comprehensive insurance plans at affordable premiums.",
                    keywords: ["Health Insurance", "Life Insurance", "Motor Insurance"],
                },
                sections: [
                    {
                        key: "insurance_hero",
                        title: "Complete Protection for You & Your Family",
                        subtitle: "Comprehensive Coverage",
                        description: "Compare health, life, and vehicle insurance policies from top insurers in India.",
                        order: 1,
                        status: true,
                    },
                ],
            },
            {
                name: "FAQ",
                slug: "faq",
                description: "Frequently Asked Questions",
                isPublished: true,
                seo: {
                    metaTitle: "Frequently Asked Questions - CredAxis Support",
                    metaDescription: "Find answers to all your questions about CredAxis credit lines, mandates, coins, and security.",
                    keywords: ["CredAxis FAQ", "Credit Help", "Mandates FAQ"],
                },
                sections: [
                    {
                        key: "faq_list",
                        title: "Frequently Asked Questions",
                        subtitle: "Got questions? We've got answers.",
                        order: 1,
                        status: true,
                    },
                ],
            },
            {
                name: "Support",
                slug: "support",
                description: "Customer support and contact details",
                isPublished: true,
                seo: {
                    metaTitle: "Customer Support & Contact Us | CredAxis",
                    metaDescription: "Need help? Reach out to CredAxis 24/7 customer care team via email, phone, or chat.",
                    keywords: ["CredAxis Support", "Customer Care", "Contact CredAxis"],
                },
                sections: [
                    {
                        key: "support_hero",
                        title: "We are Here to Help You 24/7",
                        subtitle: "Dedicated Customer Care",
                        description: "Have a query or feedback? Get in touch with our support specialists.",
                        order: 1,
                        status: true,
                    },
                ],
            },
            {
                name: "Privacy Policy",
                slug: "privacy-policy",
                description: "CredAxis Privacy Policy document",
                isPublished: true,
                seo: {
                    metaTitle: "Privacy Policy - CredAxis",
                    metaDescription: "Read CredAxis privacy policy and how we protect and process user data.",
                    keywords: ["Privacy Policy", "Data Safety"],
                },
                sections: [
                    {
                        key: "privacy_content",
                        title: "Privacy Policy",
                        description: "Your privacy is important to us. This document outlines how CredAxis collects, uses, and safeguards your personal information.",
                        order: 1,
                        status: true,
                    },
                ],
            },
            {
                name: "Terms & Conditions",
                slug: "terms-and-conditions",
                description: "CredAxis Terms and Conditions document",
                isPublished: true,
                seo: {
                    metaTitle: "Terms & Conditions - CredAxis",
                    metaDescription: "Terms of service and usage conditions for CredAxis platform and services.",
                    keywords: ["Terms and Conditions", "Terms of Service"],
                },
                sections: [
                    {
                        key: "terms_content",
                        title: "Terms & Conditions",
                        description: "By accessing or using CredAxis services, you agree to comply with and be bound by the following terms and conditions.",
                        order: 1,
                        status: true,
                    },
                ],
            },
        ];

        const seededPages = [];
        for (const item of defaultPages) {
            const page = await WebsitePage.findOneAndUpdate(
                { slug: item.slug },
                {
                    $setOnInsert: {
                        ...item,
                        createdBy: userId,
                        updatedBy: userId,
                    },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            seededPages.push(page);
        }

        return seededPages;
    }
}

module.exports = new AdminWebsiteService();
