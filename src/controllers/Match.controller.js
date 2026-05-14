const model = require('../models/Match.model');

module.exports.getAllRequests = async (req, res, next) => {
    try {
        const data = { user_id: res.locals.userId };
        const results = await model.selectAllByUser(data);
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};

module.exports.getSentRequests = async (req, res, next) => {
    try {
        const data = { sender_id: res.locals.userId };
        const results = await model.selectBySender(data);
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};

module.exports.getReceivedRequests = async (req, res, next) => {
    try {
        const data = { receiver_id: res.locals.userId };
        const results = await model.selectByReceiver(data);
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};

module.exports.getActiveMatches = async (req, res, next) => {
    try {
        const data = { user_id: res.locals.userId };
        const results = await model.selectActiveMatches(data);
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};

module.exports.sendRequest = async (req, res, next) => {
    const { receiver_id, module, time_slot, location, type, message } = req.body;
    
    if (!receiver_id) {
        return res.status(400).json({ message: "receiver_id is required" });
    }

    try {
        const data = {
            sender_id: res.locals.userId,
            receiver_id,
            module_id: req.body.module_id || null,
            topic: req.body.topic || null,
            time_slot: time_slot || null,
            location: location || null,
            type: type || 'one-on-one',
            message: message || null
        };

        const result = await model.insertRequest(data);
        res.status(201).json({
            request_id: result.request_id,
            message: "Match request sent successfully"
        });
    } catch (error) {
        next(error);
    }
};

module.exports.getRequestById = async (req, res, next) => {
    try {
        const data = { id: req.params.id };
        const results = await model.selectById(data);
        
        if (results.length === 0) {
            return res.status(404).json({ message: "Request not found" });
        }
        
        res.status(200).json(results[0]);
    } catch (error) {
        next(error);
    }
};

module.exports.updateRequestStatus = async (req, res, next) => {
    const { status } = req.body;
    
    if (!status) {
        return res.status(400).json({ message: "status is required" });
    }

    try {
        const data = {
            id: req.params.id,
            status
        };

        const result = await model.updateStatus(data);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Request not found" });
        }
        
        res.status(200).json({ message: "Request status updated successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports.autoMatch = async (req, res, next) => {
    try {
        const data = { user_id: res.locals.userId };
        const results = await model.autoMatch(data);
        res.status(200).json({
            message: "Auto-match completed",
            matches: results
        });
    } catch (error) {
        next(error);
    }
};

module.exports.getSharedModules = async (req, res, next) => {
    try {
        const data = { 
            user1_id: res.locals.userId,
            user2_id: req.params.targetId
        };
        const results = await model.selectSharedModules(data);
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};
