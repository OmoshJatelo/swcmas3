const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const config = require('../config');
const { sendMail } = require('../utils/mailer');
const logger = require('../utils/logger');

/** Generate JWT access token */
const generateAccessToken = (user) => {
  const payload = { id: user._id, role: user.role };
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessExpiry });
};

/** Generate JWT refresh token */
const generateRefreshToken = (user) => {
  const payload = { id: user._id, role: user.role };
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiry });
};

/** Register a new user */
const register = async (data) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    const err = new Error('Email already in use');
    err.statusCode = 409;
    throw err;
  }
  const user = new User(data);
  await user.save();
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  // Store refresh token hash (or plain for simplicity) - we store plain for now
  user.refreshToken = refreshToken;
  await user.save();
  return { user, accessToken, refreshToken };
};

/** Login user */
const login = async (email, password) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  console.log('Before save - user:', user._id, 'refreshToken:', user.refreshToken);
  try {
    const savedUser = await user.save();
    console.log('After save - savedUser:', savedUser._id, 'refreshToken:', savedUser.refreshToken);
  } catch (saveErr) {
    console.error('Save error:', saveErr);
    throw saveErr;
  }
  return { user, accessToken, refreshToken };
};

/** Refresh access token */
const refresh = async (providedToken) => {
  console.log('[auth.service] refresh called with token:', providedToken ? providedToken.substring(0, 20) + '...' : 'undefined');
  if (!providedToken) {
    const err = new Error('Refresh token missing');
    err.statusCode = 401;
    throw err;
  }
  let decoded;
  try {
    decoded = jwt.verify(providedToken, config.jwt.refreshSecret);
    console.log('[auth.service] Token decoded successfully, user ID:', decoded.id);
  } catch (e) {
    console.log('[auth.service] JWT verify failed:', e.message);
    const err = new Error('Invalid refresh token');
    err.statusCode = 401;
    throw err;
  }
  // Explicitly select refreshToken field since it has select: false in schema
  const user = await User.findById(decoded.id).select('+refreshToken');
  console.log('[auth.service] User found:', user ? user._id : 'not found');
  if (user) {
    console.log('[auth.service] User refreshToken in DB:', user.refreshToken ? user.refreshToken.substring(0, 20) + '...' : 'undefined');
    console.log('[auth.service] Provided token:', providedToken.substring(0, 20) + '...');
    console.log('[auth.service] Match:', user.refreshToken === providedToken);
  }
  if (!user || user.refreshToken !== providedToken) {
    console.log('[auth.service] Token mismatch or user not found');
    const err = new Error('Refresh token not recognized');
    err.statusCode = 401;
    throw err;
  }
  const accessToken = generateAccessToken(user);
  return { user, accessToken };
};

/** Logout user */
const logout = async (userId) => {
  const user = await User.findById(userId);
  if (user) {
    user.refreshToken = undefined;
    await user.save();
  }
};

/** Initiate password reset */
const initiatePasswordReset = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    // Do not reveal user existence for security; silently succeed
    logger.warn('Password reset requested for non-existent email: %s', email);
    return;
  }
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expires = Date.now() + 60 * 60 * 1000; // 1 hour
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(expires);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  const message = `You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.`;
  await sendMail({ to: email, subject: 'SWCMAS Password Reset', html: message });
};

/** Complete password reset */
const resetPassword = async (token, newPassword) => {
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+password');
  if (!user) {
    const err = new Error('Invalid or expired reset token');
    err.statusCode = 400;
    throw err;
  }
  user.password = newPassword; // pre-save will hash
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  return user;
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  initiatePasswordReset,
  resetPassword,
  generateAccessToken,
  generateRefreshToken,
};
