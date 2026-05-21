const {
  selectByUsernameOrEmail,
  create,
  updateProfile,
  updateProfilePicture,
  enrollModules,
  selectByUserId,
  searchStudents,
} = require('../models/User.model');

module.exports.login = async (req, res, next) => {
  const identifier = req.body.username || req.body.identifier;
  if (!identifier || !req.body.password) {
    return res.status(400).json({ message: 'Error: username/email and password are required' });
  }

  try {
    const results = await selectByUsernameOrEmail({ identifier });
    if (results.length === 0)
      return res.status(401).json({ message: 'Invalid username or password' });

    res.locals.hash = results[0].password;
    res.locals.userId = results[0].user_id;
    res.locals.username = results[0].username;
    res.locals.user = results[0];
    res.locals.message = 'Login successful';
    next();
  } catch (error) {
    next(error);
  }
};

module.exports.register = async (req, res, next) => {
  const { username, email, password, name } = req.body;
  if (!username || !email || !password || !name) {
    return res.status(400).json({ message: 'Error: All fields are required' });
  }

  try {
    // Check if username or email already exists
    const existing = await selectByUsernameOrEmail({ identifier: username });
    const existingEmail = await selectByUsernameOrEmail({ identifier: email });

    if (existing.length > 0 || existingEmail.length > 0) {
      return res.status(409).json({ message: 'Username or email already exists' });
    }

    // Use the hashed password from middleware
    const newUser = await create({ username, email, password: res.locals.hash, name });

    res.locals.userId = newUser.user_id;
    res.locals.username = newUser.username;
    res.locals.user = newUser;
    res.locals.message = 'Registration successful';
    next();
  } catch (error) {
    next(error);
  }
};

module.exports.completeOnboarding = async (req, res, next) => {
  const userId = res.locals.userId;
  const { institution_id, diploma_id, year, module_ids } = req.body;

  if (!institution_id || !diploma_id || !year) {
    return res.status(400).json({ message: 'Error: Institution, Diploma, and Year are required' });
  }

  try {
    const updatedUser = await updateProfile({
      institution_id,
      diploma_id,
      year,
      user_id: userId,
    });

    await enrollModules({
      user_id: userId,
      module_ids,
    });

    res.status(200).json({
      message: 'Onboarding complete',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

module.exports.uploadProfilePicture = async (req, res, next) => {
  const userId = res.locals.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Profile picture file is required' });
  }

  try {
    const profilePicPath = `/uploads/${req.file.filename}`;
    const updatedUser = await updateProfilePicture({ userId, profilePic: profilePicPath });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (updatedUser.password) {
      delete updatedUser.password;
    }

    res.status(200).json({
      message: 'Profile picture uploaded successfully',
      profile_pic: profilePicPath,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

module.exports.viewProfile = async (req, res, next) => {
  const friendId = req.params.friendId;
  if (!friendId) {
    return res.status(400).json({ error: 'Friend ID is required' });
  }

  try {
    const friendData = await selectByUserId({ userId: friendId });
    if (!friendData) {
      return res.status(404).json({ error: 'Friend profile not found' });
    }
    if (friendData.password) {
      delete friendData.password;
    }
    res.status(200).json(friendData);
  } catch (error) {
    next(error);
  }
};

module.exports.updateProfile = async (req, res, next) => {
  const userId = res.locals.userId;
  const { name, email, institutionId, diplomaId, year, profileText } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const updatedUser = await updateProfile({
      userId,
      name,
      email,
      institutionId,
      diplomaId,
      year,
      profileText,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (updatedUser.password) {
      delete updatedUser.password;
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    if (error.code === '23505') {
      // PostgreSQL unique violation error code
      return res.status(400).json({ error: 'Email is already taken' });
    }
    next(error);
  }
};

module.exports.searchStudents = async (req, res, next) => {
  const userId = res.locals.userId;
  const query = (req.query.q || '').trim();

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (query.length < 2) {
    return res.status(200).json([]);
  }

  try {
    const students = await searchStudents({ userId, query });
    res.status(200).json(students);
  } catch (error) {
    next(error);
  }
};
