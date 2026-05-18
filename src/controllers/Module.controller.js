const { selectAllModules, selectByDiploma } = require('../models/Module.model');

module.exports.getAllModules = async (req, res, next) => {
    try {
        const results = await selectAllModules();
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};

module.exports.getModulesByDiploma = async (req, res, next) => {
    const diploma_id = req.params.diplomaId;
    if (!diploma_id) {
        return res.status(400).json({ message: "Error: diplomaId is required" });
    }
    try {
        const results = await selectByDiploma({ diploma_id });
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};