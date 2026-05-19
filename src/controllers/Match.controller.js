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
        const { limit, offset } = req.query;
        const data = { 
            sender_id: res.locals.userId,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };
        const results = await model.selectBySender(data);
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};

module.exports.getReceivedRequests = async (req, res, next) => {
    try {
        const { limit, offset } = req.query;
        const data = { 
            receiver_id: res.locals.userId,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };
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
            is_online: req.body.is_online || false,
            type: type || 'one-on-one',
            co_participants: req.body.co_participants || [],
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
        const result = await model.selectById(data);
        
        if (!result) {
            return res.status(404).json({ message: "Request not found" });
        }
        
        res.status(200).json(result);
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

        // If the request was accepted, automatically schedule a calendar event
        if (status === 'Accepted') {
            try {
                const matchReq = await model.selectById({ id: req.params.id });
                if (matchReq) {
                    let dateStr = '2026-05-18';
                    let startStr = '16:00';
                    let endStr = '17:00';
                    
                    if (matchReq.time_slot) {
                        let tsString = '';
                        if (matchReq.time_slot instanceof Date) {
                            const yr = matchReq.time_slot.getFullYear();
                            const mo = String(matchReq.time_slot.getMonth() + 1).padStart(2, '0');
                            const dy = String(matchReq.time_slot.getDate()).padStart(2, '0');
                            const hr = String(matchReq.time_slot.getHours()).padStart(2, '0');
                            const mn = String(matchReq.time_slot.getMinutes()).padStart(2, '0');
                            tsString = `${yr}-${mo}-${dy} ${hr}:${mn}`;
                        } else {
                            tsString = String(matchReq.time_slot);
                        }

                        // Normalize ISO format e.g. "2026-05-18T14:00:00.000Z"
                        if (tsString.includes('T')) {
                            tsString = tsString.replace('T', ' ');
                        }

                        const parts = tsString.split(' ');
                        let rawDate = parts[0] || '';
                        let rawTime = parts[1] || '';

                        if (rawTime.includes(':')) {
                            const timeParts = rawTime.split(':');
                            if (timeParts[0] && timeParts[1]) {
                                rawTime = `${timeParts[0]}:${timeParts[1]}`;
                            }
                        }

                        // Normalize rawDate (handle DD/MM/YYYY or similar)
                        const dParts = rawDate.split(/[-/]/);
                        if (dParts.length === 3) {
                            if (dParts[2].length === 4) {
                                // e.g. "18/05/2026" -> "2026-05-18"
                                dateStr = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
                            } else if (dParts[0].length === 4) {
                                // e.g. "2026/05/18" -> "2026-05-18"
                                dateStr = `${dParts[0]}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
                            } else {
                                dateStr = rawDate;
                            }
                        } else {
                            dateStr = rawDate;
                        }

                        if (rawTime && rawTime.includes(':')) {
                            const [h, m] = rawTime.split(':');
                            startStr = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
                            const nextHour = (parseInt(h) + 1) % 24;
                            endStr = `${nextHour.toString().padStart(2, '0')}:${m.padStart(2, '0')}`;
                        }
                    }
                    
                    const homeModel = require('../models/Home.model');
                    const isOnline = matchReq.is_online || false;
                    const meetingUrl = isOnline ? `/api/chats/call/${matchReq.request_id || req.params.id}` : null;
                    await homeModel.createCalendarEvent({
                        creator_id: res.locals.userId || 1,
                        request_id: matchReq.request_id || req.params.id,
                        partner_id: matchReq.sender_id,
                        co_participants: matchReq.co_participants || [],
                        module_id: matchReq.module_id || null,
                        name: matchReq.type === 'group' ? 'Group Study' : 'Match Session',
                        topic: matchReq.topic || '',
                        location: matchReq.location || 'Online',
                        is_online: isOnline,
                        meeting_url: meetingUrl,
                        event_date: dateStr,
                        booking_time: `${startStr} - ${endStr}`,
                        type: matchReq.type === 'group' ? 'Group Study' : 'Match Session',
                        status: 'Confirmed',
                        notes: matchReq.message || ''
                    });
                }
            } catch (err) {
                console.error("Error creating auto calendar event:", err);
            }
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
