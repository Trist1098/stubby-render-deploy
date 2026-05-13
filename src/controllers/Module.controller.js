const model = require('../models/Module.model');

module.exports.getAllModules = async (req, res, next) => {
    try {
        const results = await model.selectAllModules();
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};