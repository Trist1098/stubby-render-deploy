const { selectUserModules } = require('../models/UserModule.model');

module.exports.getUserModules = async (req, res, next) => {
    try {
        const results = await selectUserModules({ user_id: res.locals.userId });
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};
