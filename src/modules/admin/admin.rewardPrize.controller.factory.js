const createRewardPrizeController = (service) => ({
    getPrizes: async (req, res, next) => {
        try {
            const data = await service.getPrizes(req.query);
            return res.status(200).json({
                success: true,
                message: "Prizes fetched successfully",
                data,
            });
        } catch (error) {
            next(error);
        }
    },

    getPrizeTypes: async (req, res, next) => {
        try {
            const data = service.getPrizeTypes();
            return res.status(200).json({
                success: true,
                message: "Prize types fetched",
                data,
            });
        } catch (error) {
            next(error);
        }
    },

    getPrizeById: async (req, res, next) => {
        try {
            const data = await service.getPrizeById(req.params.id);
            return res.status(200).json({
                success: true,
                message: "Prize fetched successfully",
                data,
            });
        } catch (error) {
            next(error);
        }
    },

    createPrize: async (req, res, next) => {
        try {
            const data = await service.createPrize(req.user.id, req.body);
            return res.status(200).json({
                success: true,
                message: "Prize created successfully",
                data,
            });
        } catch (error) {
            next(error);
        }
    },

    updatePrize: async (req, res, next) => {
        try {
            const data = await service.updatePrize(req.params.id, req.body);
            return res.status(200).json({
                success: true,
                message: "Prize updated successfully",
                data,
            });
        } catch (error) {
            next(error);
        }
    },

    deletePrize: async (req, res, next) => {
        try {
            const data = await service.deletePrize(req.params.id);
            return res.status(200).json({
                success: true,
                message: "Prize deleted successfully",
                data,
            });
        } catch (error) {
            next(error);
        }
    },
});

module.exports = createRewardPrizeController;
