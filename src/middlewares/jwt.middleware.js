//////////////////////////////////////////////////////
// REQUIRE DOTENV MODULE
//////////////////////////////////////////////////////
require("dotenv").config();

//////////////////////////////////////////////////////
// REQUIRE JWT MODULE
//////////////////////////////////////////////////////
const jwt = require("jsonwebtoken");

//////////////////////////////////////////////////////
// SET JWT CONFIGURATION
//////////////////////////////////////////////////////
const secretKey = process.env.JWT_SECRET_KEY || "stubby_default_secret";
const tokenDuration = process.env.JWT_EXPIRES_IN || "1h";
const tokenAlgorithm = process.env.JWT_ALGORITHM || "HS256";

//////////////////////////////////////////////////////
// MIDDLEWARE FUNCTION FOR GENERATING JWT TOKEN
//////////////////////////////////////////////////////
module.exports.generateToken = (req, res, next) => {
    const payload = {
        userId: res.locals.userId,
        timestamp: new Date()
    };

    const options = {
        algorithm: tokenAlgorithm,
        expiresIn: tokenDuration,
    };

    const callback = (error, token) => {
        if (error) {
            console.error("Error jwt:", error);
            res.status(500).json({ message: "Internal server error" });
        } else {
            res.locals.token = token;
            next();
        }
    };

    jwt.sign(payload, secretKey, options, callback);
};

//////////////////////////////////////////////////////
// MIDDLEWARE FUNCTION FOR SENDING JWT TOKEN
//////////////////////////////////////////////////////
module.exports.sendToken = (req, res, next) => {
    // Security: never send the password hash back to the client!
    if (res.locals.user) delete res.locals.user.password;

    res.status(200).json({
        message: res.locals.message,
        token: res.locals.token,
        user_id: res.locals.userId,
        username: res.locals.username,
        user: res.locals.user
    });
};

//////////////////////////////////////////////////////
// MIDDLEWARE FUNCTION FOR VERIFYING JWT TOKEN
//////////////////////////////////////////////////////
module.exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);

    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }

    const callback = (error, decoded) => {
        if (error) {
            return res.status(401).json({ error: "Invalid token" });
        }

        res.locals.userId = decoded.userId;
        res.locals.tokenTimestamp = decoded.timestamp;

        // Generate fresh token on each verified request
        const newPayload = {
            userId: decoded.userId,
            timestamp: new Date()
        };

        const options = {
            algorithm: tokenAlgorithm,
            expiresIn: tokenDuration,
        };

        const newToken = jwt.sign(newPayload, secretKey, options);
        res.setHeader('X-New-Token', newToken);

        next();
    };

    jwt.verify(token, secretKey, callback);
};
