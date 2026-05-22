const {
  selectByUsernameOrEmail,
  create,
  updateProfile,
  updateProfilePicture,
  updatePassword,
  enrollModules,
  selectByUserId,
  selectPublicUserById,
  searchStudents,
} = require('../models/User.model');
const bcrypt = require('bcrypt');
const institutionModel = require('../models/Institution.model');
const diplomaModel = require('../models/Diploma.model');

const safeUser = (user) => {
  if (!user) return user;
  const userCopy = { ...user };
  delete userCopy.password;
  return userCopy;
};

const isValidChoice = (value, allowedValues) => allowedValues.includes(value);

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
    const currentUser = await selectByUserId({ userId });
    const updatedUser = await updateProfile({
      ...currentUser,
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
      user: safeUser(updatedUser),
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

    res.status(200).json({
      message: 'Profile picture uploaded successfully',
      profile_pic: profilePicPath,
      user: safeUser(updatedUser),
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

    if (friendData.is_private && Number(friendId) !== Number(res.locals.userId)) {
      return res.status(200).json({
        user_id: friendData.user_id,
        is_private: true,
        message: 'This profile is private.',
      });
    }

    res.status(200).json(safeUser(friendData));
  } catch (error) {
    next(error);
  }
};

module.exports.updateProfile = async (req, res, next) => {
  const userId = res.locals.userId;
  const {
    name,
    email,
    institutionId,
    diplomaId,
    year,
    profileText,
    theme,
    language,
    isPrivate,
    friendRequestPrivate,
    pushNotif,
    defaultLandingPage,
  } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (year && (Number.isNaN(Number(year)) || Number(year) < 1 || Number(year) > 10)) {
    return res.status(400).json({ error: 'Year must be between 1 and 10' });
  }

  try {
    const currentUser = await selectByUserId({ userId });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const finalTheme = theme || currentUser.theme || 'Light';
    const finalLanguage = language || currentUser.language || 'English';
    const finalDefaultLandingPage =
      defaultLandingPage || currentUser.default_landing_page || 'Dashboard';
    const finalIsPrivate = isPrivate ?? currentUser.is_private;
    const finalFriendRequestPrivate = friendRequestPrivate ?? currentUser.friend_request_private;
    const finalPushNotif = pushNotif ?? currentUser.push_notif;

    if (!isValidChoice(finalTheme, ['Light', 'Dark'])) {
      return res.status(400).json({ error: 'Theme must be Light or Dark' });
    }

    if (!isValidChoice(finalLanguage, ['English', 'Japanese', 'Chinese'])) {
      return res.status(400).json({ error: 'Language must be English, Japanese, or Chinese' });
    }

    if (!isValidChoice(finalDefaultLandingPage, ['Dashboard', 'Profile', 'Chat', 'Matchmaking'])) {
      return res.status(400).json({ error: 'Please choose a valid landing page' });
    }

    if (institutionId) {
      const institution = await institutionModel.getInstitutionByInstitutionId(institutionId);
      if (!institution || institution.length === 0) {
        return res.status(400).json({ error: 'Selected institution does not exist' });
      }
    }

    if (diplomaId) {
      const diploma = await diplomaModel.getDiplomaByDiplomaId(diplomaId);
      if (!diploma || diploma.length === 0) {
        return res.status(400).json({ error: 'Selected diploma does not exist' });
      }
    }

    const updatedUser = await updateProfile({
      userId,
      name: name.trim(),
      email: email.trim(),
      institutionId,
      diplomaId,
      year,
      profileText,
      theme: finalTheme,
      language: finalLanguage,
      isPrivate: finalIsPrivate,
      friendRequestPrivate: finalFriendRequestPrivate,
      pushNotif: finalPushNotif,
      defaultLandingPage: finalDefaultLandingPage,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: safeUser(updatedUser),
    });
  } catch (error) {
    if (error.code === '23505') {
      // PostgreSQL unique violation error code
      return res.status(409).json({ error: 'Username or email is already taken' });
    }
    next(error);
  }
};

module.exports.changePassword = async (req, res, next) => {
  const userId = res.locals.userId;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All password fields are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New passwords do not match' });
  }

  try {
    const user = await selectByUserId({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password);
    if (!currentPasswordMatches) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = await updatePassword({ userId, password: hashedPassword });

    res.status(200).json({
      message: 'Password changed successfully',
      user: safeUser(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getMe = async (req, res, next) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await selectByUserId({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(safeUser(user));
  } catch (error) {
    next(error);
  }
};

module.exports.getPublicUser = async (req, res, next) => {
  try {
    const user = await selectPublicUserById({ userId: req.params.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
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
