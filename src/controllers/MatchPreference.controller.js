const model = require('../models/MatchPreference.model');

module.exports.getPreferences = async (req, res, next) => {
    const userId = res.locals.userId;
    try {
        const result = await model.selectByUserId({ userId });
        if (!result) {
            return res.status(200).json({
                selected_modules: [],
                availability_days: [],
                selected_modes: [],
                selected_times: [],
                style: 'discussion',
                duration: 60,
                priority: 50,
                gender_pref: 'any',
                partner_level: 'same',
                additional_details: '',
                auto_match_enabled: false,
                selected_languages: []
            });
        }
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

module.exports.updatePreferences = async (req, res, next) => {
    const userId = res.locals.userId;
    const data = { ...req.body, userId };
    try {
        const result = await model.upsert(data);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
