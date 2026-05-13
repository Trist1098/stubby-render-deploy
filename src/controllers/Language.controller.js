const model = require('../models/Language.model');

module.exports.getAllLanguages = async (req, res, next) => {
    try {
        const results = await model.selectAllLanguages();
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};
