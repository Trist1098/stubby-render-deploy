const { selectByUsernameOrEmail } = require('../models/User.model');

module.exports.login = async (req, res, next) => {
    const identifier = req.body.username || req.body.identifier;
    if (!identifier || !req.body.password) {
        return res.status(400).json({ message: "Error: username/email and password are required" });
    }

    try {
        const results = await selectByUsernameOrEmail({ identifier });
        if (results.length === 0) return res.status(401).json({ message: "Invalid username or password" });

        res.locals.hash = results[0].password;
        res.locals.userId = results[0].user_id;
        res.locals.username = results[0].username;
        res.locals.user = results[0];
        res.locals.message = "Login successful";
        next();
    } catch (error) {
        next(error);
    }
};
