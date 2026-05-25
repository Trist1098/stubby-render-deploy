const model = require('../models/Match.model');
const userModel = require('../models/User.model');
const friendModel = require('../models/Friend.model');
const chatModel = require('../models/Chat.model');
const homeModel = require('../models/Home.model');

const FINAL_REQUEST_STATUSES = ['Accepted', 'Declined', 'Cancelled'];

const parseMatchTimeSlot = (timeSlot) => {
  if (!timeSlot) return null;

  let text = String(timeSlot).trim();
  if (!text) return null;
  if (text.includes('T')) text = text.replace('T', ' ');

  const [rawDate = '', rawTime = ''] = text.split(' ');
  const dateParts = rawDate.split(/[-/]/);
  if (dateParts.length !== 3) return null;

  let eventDate = '';
  if (dateParts[0].length === 4) {
    eventDate = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
  } else if (dateParts[2].length === 4) {
    eventDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
  }
  if (!eventDate) return null;

  const timeParts = rawTime.split(':');
  if (timeParts.length < 2) return null;

  const hour = Number(timeParts[0]);
  const minute = Number(timeParts[1]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;

  const start = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const end = `${String((hour + 1) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    eventDate,
    bookingTime: `${start} - ${end}`,
  };
};

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

  if (!FINAL_REQUEST_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid request status' });
  }

  try {
    const matchReq = await model.selectById({ id: req.params.id });
    if (!matchReq) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const userId = Number(res.locals.userId);
    const isSender = Number(matchReq.sender_id) === userId;
    const isReceiver = Number(matchReq.receiver_id) === userId;

    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'You are not part of this request' });
    }

    if (matchReq.status !== 'Pending') {
      return res.status(409).json({ message: `Request is already ${matchReq.status}` });
    }

    if ((status === 'Accepted' || status === 'Declined') && !isReceiver) {
      return res.status(403).json({ message: 'Only the receiver can accept or decline this request' });
    }

    if (status === 'Cancelled' && !isSender) {
      return res.status(403).json({ message: 'Only the sender can cancel this request' });
    }

    const data = {
      id: req.params.id,
      status,
    };

    const result = await model.updateStatus(data);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    let conversation = null;
    let calendarEvent = null;

    if (status === 'Accepted') {
      await Promise.all([
        friendModel.createFriendship({
          userId: matchReq.sender_id,
          friendId: matchReq.receiver_id,
        }),
        friendModel.createFriendship({
          userId: matchReq.receiver_id,
          friendId: matchReq.sender_id,
        }),
      ]);

      conversation = await chatModel.ensureFriendConversation(
        Number(matchReq.sender_id),
        Number(matchReq.receiver_id),
        userId
      );

      const schedule = parseMatchTimeSlot(matchReq.time_slot);
      if (schedule) {
        calendarEvent = await homeModel.createCalendarEvent({
          creator_id: userId,
          request_id: matchReq.request_id || req.params.id,
          partner_id: matchReq.sender_id,
          co_participants: matchReq.co_participants || [],
          module_id: matchReq.module_id || null,
          name: matchReq.type === 'group' ? 'Group Study' : 'Match Session',
          topic: matchReq.topic || '',
          location: matchReq.location || '',
          is_online: Boolean(matchReq.is_online),
          meeting_url: null,
          event_date: schedule.eventDate,
          booking_time: schedule.bookingTime,
          type: matchReq.type === 'group' ? 'Group Study' : 'Match Session',
          status: 'Confirmed',
          notes: matchReq.message || '',
        });
      }
    }

    res.status(200).json({
      message: 'Request status updated successfully',
      conversation_id: conversation?.conversation_id || null,
      event_id: calendarEvent?.event_id || null,
    });
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
        if (Array.isArray(val)) return val.map((item) => String(item).trim()).filter(Boolean);
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (!trimmed) return [];
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
          } catch {
            return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
          }
        }
        return [String(val).trim()].filter(Boolean);
      };

      const lowerList = (values) => parseJson(values).map((value) => value.toLowerCase());
      const describeOverlap = (overlap, fallback) => {
        if (overlap.length > 0) return overlap.join(', ');
        return fallback;
      };

      const myDays = lowerList(myPref.availability_days);
      const myModes = lowerList(myPref.selected_modes);
      const myTimes = lowerList(myPref.selected_times);
      const myLangs = lowerList(myPref.selected_languages);
      const myStyles = lowerList(myPref.style);

      results.forEach((partner) => {
        let score = 0;
        const breakdown = [];

        const sharedCount = parseInt(partner.shared_modules_count) || 0;
        let moduleScore = 0;
        if (sharedCount >= 3) {
          moduleScore = 40;
        } else if (sharedCount === 2) {
          moduleScore = 32;
        } else if (sharedCount === 1) {
          moduleScore = 20;
        }
        score += moduleScore;
        breakdown.push({
          label: 'Shared modules',
          points: moduleScore,
          max: 40,
          detail: `${sharedCount} shared module${sharedCount === 1 ? '' : 's'}`,
        });

        const partnerDays = lowerList(partner.availability_days);
        const overlapDays = myDays.filter((day) => partnerDays.includes(day));
        let daysScore = 0;
        if (myDays.length === 0 || partnerDays.length === 0) {
          daysScore = 15;
        } else if (overlapDays.length >= 2) {
          daysScore = 20;
        } else if (overlapDays.length === 1) {
          daysScore = 10;
        }
        score += daysScore;
        breakdown.push({
          label: 'Availability days',
          points: daysScore,
          max: 20,
          detail: describeOverlap(overlapDays, 'Availability not fully set'),
        });

        const partnerModes = lowerList(partner.selected_modes);
        const overlapModes = myModes.filter((mode) => partnerModes.includes(mode));
        let modesScore = 0;
        if (myModes.length === 0 || partnerModes.length === 0) {
          modesScore = 10;
        } else if (overlapModes.length > 0) {
          modesScore = 15;
        }
        score += modesScore;
        breakdown.push({
          label: 'Study mode',
          points: modesScore,
          max: 15,
          detail: describeOverlap(overlapModes, 'Flexible mode'),
        });

        const partnerTimes = lowerList(partner.selected_times);
        const overlapTimes = myTimes.filter((time) => partnerTimes.includes(time));
        let timesScore = 0;
        if (myTimes.length === 0 || partnerTimes.length === 0) {
          timesScore = 7;
        } else if (overlapTimes.length > 0) {
          timesScore = 10;
        }
        score += timesScore;
        breakdown.push({
          label: 'Study time',
          points: timesScore,
          max: 10,
          detail: describeOverlap(overlapTimes, 'Flexible time'),
        });

        const partnerLangs = lowerList(partner.selected_languages);
        const overlapLangs = myLangs.filter((language) => partnerLangs.includes(language));
        let languagesScore = 0;
        if (myLangs.length === 0 || partnerLangs.length === 0) {
          languagesScore = 3;
        } else if (overlapLangs.length > 0) {
          languagesScore = 5;
        }
        score += languagesScore;
        breakdown.push({
          label: 'Language',
          points: languagesScore,
          max: 5,
          detail: describeOverlap(overlapLangs, 'No language preference'),
        });

        const partnerStyles = lowerList(partner.style);
        const overlapStyles = myStyles.filter((style) => partnerStyles.includes(style));
        const stylesScore = myStyles.length === 0 || partnerStyles.length === 0
          ? 3
          : overlapStyles.length > 0
            ? 5
            : 2;
        score += stylesScore;
        breakdown.push({
          label: 'Study style',
          points: stylesScore,
          max: 5,
          detail: describeOverlap(overlapStyles, 'Different study styles'),
        });

        let courseScore = 0;
        if (partner.diploma_id && myProfile && partner.diploma_id === myProfile.diploma_id) {
          courseScore = 5;
        }
        score += courseScore;
        breakdown.push({
          label: 'Course alignment',
          points: courseScore,
          max: 5,
          detail: courseScore > 0 ? 'Same diploma' : 'Different or unset diploma',
        });

        partner.match_percentage = Math.min(Math.max(score, 20), 100);
        partner.match_breakdown = breakdown;
      });

      // Sort results by match_percentage DESC
      results.sort((a, b) => b.match_percentage - a.match_percentage);
    } else {
      // Default calculation if no user preference profile exists
      results.forEach((partner) => {
        const sharedCount = parseInt(partner.shared_modules_count) || 0;
        partner.match_percentage = Math.min(sharedCount * 25, 100);
        partner.match_breakdown = [{
          label: 'Shared modules',
          points: partner.match_percentage,
          max: 100,
          detail: `${sharedCount} shared module${sharedCount === 1 ? '' : 's'}`,
        }];
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
