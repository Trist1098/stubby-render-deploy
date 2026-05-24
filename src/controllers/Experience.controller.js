const experienceModel = require('../models/Experience.model');
const userModel = require('../models/User.model');

const validTypes = ['work', 'academic'];

const getValidatedBody = (body) => {
  const type = body.type?.trim().toLowerCase();
  const title = body.title?.trim();
  const organization = body.organization?.trim();
  const startDate = body.startDate;
  const endDate = body.endDate || null;
  const description = body.description?.trim() || null;

  if (!validTypes.includes(type)) {
    return { error: 'Experience type must be work or academic' };
  }
  if (!title || !organization || !startDate) {
    return { error: 'Title, organization, and start date are required' };
  }
  if (endDate && endDate < startDate) {
    return { error: 'End date cannot be earlier than start date' };
  }

  return { type, title, organization, startDate, endDate, description };
};

module.exports.getByUserId = async (req, res, next) => {
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

    const experiences = await experienceModel.getByUserId(profileUserId);
    res.status(200).json(experiences);
  } catch (error) {
    next(error);
  }
};

module.exports.create = async (req, res, next) => {
  const data = getValidatedBody(req.body);
  if (data.error) return res.status(400).json({ message: data.error });

  try {
    const experience = await experienceModel.create({ ...data, userId: res.locals.userId });
    res.status(201).json(experience);
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  const experienceId = Number(req.params.experienceId);
  const data = getValidatedBody(req.body);
  if (!experienceId || Number.isNaN(experienceId)) {
    return res.status(400).json({ message: 'A valid experienceId is required' });
  }
  if (data.error) return res.status(400).json({ message: data.error });

  try {
    const experience = await experienceModel.update({
      ...data,
      userId: res.locals.userId,
      experienceId,
    });
    if (!experience) {
      return res.status(404).json({ message: 'Experience not found' });
    }
    res.status(200).json(experience);
  } catch (error) {
    next(error);
  }
};

module.exports.remove = async (req, res, next) => {
  const experienceId = Number(req.params.experienceId);
  if (!experienceId || Number.isNaN(experienceId)) {
    return res.status(400).json({ message: 'A valid experienceId is required' });
  }

  try {
    const deletedCount = await experienceModel.remove({
      userId: res.locals.userId,
      experienceId,
    });
    if (!deletedCount) {
      return res.status(404).json({ message: 'Experience not found' });
    }
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};
