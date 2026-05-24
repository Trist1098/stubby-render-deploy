const model = require('../models/Match.model');
const userModel = require('../models/User.model');

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
      offset: parseInt(offset),
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
      offset: parseInt(offset),
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

module.exports.getProfileMatches = async (req, res, next) => {
  const profileUserId = Number(req.params.userId);
  if (!profileUserId || Number.isNaN(profileUserId)) {
    return res.status(400).json({ message: 'A valid userId is required' });
  }

  try {
    const profileUser = await userModel.selectPublicUserById({ userId: profileUserId });
    if (!profileUser) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    if (profileUser.is_private && profileUserId !== Number(res.locals.userId)) {
      return res.status(403).json({ message: 'This profile is private' });
    }

    const results = await model.selectProfileMatches({ user_id: profileUserId });
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};

module.exports.sendRequest = async (req, res, next) => {
  const { receiver_id, time_slot, location, type, message } = req.body;

  if (!receiver_id) {
    return res.status(400).json({ message: 'receiver_id is required' });
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
      message: message || null,
    };

    const result = await model.insertRequest(data);
    res.status(201).json({
      request_id: result.request_id,
      message: 'Match request sent successfully',
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
      return res.status(404).json({ message: 'Request not found' });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports.updateRequestStatus = async (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'status is required' });
  }

  try {
    const data = {
      id: req.params.id,
      status,
    };

    const result = await model.updateStatus(data);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Request not found' });
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
          const meetingUrl = isOnline
            ? `/api/chats/call/${matchReq.request_id || req.params.id}`
            : null;
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
            notes: matchReq.message || '',
          });
        }
      } catch (err) {
        console.error('Error creating auto calendar event:', err);
      }
    }

    res.status(200).json({ message: 'Request status updated successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports.autoMatch = async (req, res, next) => {
  try {
    const userId = res.locals.userId;
    const data = { user_id: userId };
    let results = await model.autoMatch(data);

    // Fetch current user's preferences
    const matchPrefModel = require('../models/MatchPreference.model');
    const userModel = require('../models/User.model');
    const myPref = await matchPrefModel.selectByUserId({ userId });
    const myProfile = await userModel.selectByUserId({ userId });

    if (myPref) {
      const parseJson = (val) => {
        if (!val) return [];
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val;
      };

      const myDays = parseJson(myPref.availability_days);
      const myModes = parseJson(myPref.selected_modes);
      const myTimes = parseJson(myPref.selected_times);
      const myLangs = parseJson(myPref.selected_languages);
      const myStyle = (myPref.style || '').toLowerCase().trim();

      results.forEach((partner) => {
        let score = 0;

        // 1. Modules overlap (Max 40 points)
        const sharedCount = parseInt(partner.shared_modules_count) || 0;
        if (sharedCount >= 3) {
          score += 40;
        } else if (sharedCount === 2) {
          score += 32;
        } else if (sharedCount === 1) {
          score += 20;
        }

        // 2. Days overlap (Max 20 points)
        const partnerDays = parseJson(partner.availability_days);
        if (myDays.length === 0 || partnerDays.length === 0) {
          score += 15; // default moderate score if either hasn't set days
        } else {
          const intersectDays = myDays.filter((d) => partnerDays.includes(d));
          if (intersectDays.length >= 2) {
            score += 20;
          } else if (intersectDays.length === 1) {
            score += 10;
          }
        }

        // 3. Modes overlap (Max 15 points)
        const partnerModes = parseJson(partner.selected_modes);
        if (myModes.length === 0 || partnerModes.length === 0) {
          score += 10;
        } else {
          const intersectModes = myModes.filter((m) => partnerModes.includes(m));
          if (intersectModes.length > 0) {
            score += 15;
          }
        }

        // 4. Times overlap (Max 10 points)
        const partnerTimes = parseJson(partner.selected_times);
        if (myTimes.length === 0 || partnerTimes.length === 0) {
          score += 7;
        } else {
          const intersectTimes = myTimes.filter((t) => partnerTimes.includes(t));
          if (intersectTimes.length > 0) {
            score += 10;
          }
        }

        // 5. Languages overlap (Max 5 points)
        const partnerLangs = parseJson(partner.selected_languages);
        if (myLangs.length === 0 || partnerLangs.length === 0) {
          score += 3;
        } else {
          const intersectLangs = myLangs.filter((l) => partnerLangs.includes(l));
          if (intersectLangs.length > 0) {
            score += 5;
          }
        }

        // 6. Style overlap (Max 5 points)
        const partnerStyle = (partner.style || '').toLowerCase().trim();
        if (!myStyle || !partnerStyle) {
          score += 3;
        } else if (
          myStyle === partnerStyle ||
          myStyle.includes(partnerStyle) ||
          partnerStyle.includes(myStyle)
        ) {
          score += 5;
        } else {
          score += 2;
        }

        // 7. Academic / course overlap (Max 5 points)
        if (partner.diploma_id && myProfile && partner.diploma_id === myProfile.diploma_id) {
          score += 5;
        }

        partner.match_percentage = Math.min(Math.max(score, 20), 100);
      });

      // Sort results by match_percentage DESC
      results.sort((a, b) => b.match_percentage - a.match_percentage);
    } else {
      // Default calculation if no user preference profile exists
      results.forEach((partner) => {
        const sharedCount = parseInt(partner.shared_modules_count) || 0;
        partner.match_percentage = Math.min(sharedCount * 25, 100);
      });
    }

    res.status(200).json({
      message: 'Auto-match completed',
      matches: results,
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getSharedModules = async (req, res, next) => {
  try {
    const data = {
      user1_id: res.locals.userId,
      user2_id: req.params.targetId,
    };
    const results = await model.selectSharedModules(data);
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};
