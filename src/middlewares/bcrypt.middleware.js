//////////////////////////////////////////////////////
// REQUIRE BCRYPT MODULE
//////////////////////////////////////////////////////
const bcrypt = require("bcrypt");

//////////////////////////////////////////////////////
// SET SALT ROUNDS
//////////////////////////////////////////////////////
const saltRounds = 10;

//////////////////////////////////////////////////////
// MIDDLEWARE FUNCTION FOR COMPARING PASSWORD
//////////////////////////////////////////////////////
module.exports.comparePassword = async (req, res, next) => {
    try {
        const isMatch = await bcrypt.compare(req.body.password, res.locals.hash);
        if (isMatch) {
            next();
        } else {
            res.status(401).json({
                message: "Wrong password",
            });
        }
    } catch (error) {
        console.error("Error bcrypt:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

//////////////////////////////////////////////////////
// MIDDLEWARE FUNCTION FOR HASHING PASSWORD
//////////////////////////////////////////////////////
module.exports.hashPassword = async (req, res, next) => {
    if (req.body.password === undefined || req.body.password === "") {
        return next();
    }

    try {
        const hash = await bcrypt.hash(req.body.password, saltRounds);
        res.locals.hash = hash;
        next();
    } catch (error) {
        console.error("Error bcrypt:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
