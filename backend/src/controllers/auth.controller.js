const authService = require('../services/auth.service');
const ApiResponse = require('../utils/ApiResponse');
const config = require('../config');

// Helper to set httpOnly refresh token cookie
const setRefreshCookie = (res, token) => {
  const isProd = config.env === 'production';
  const maxAge = typeof config.jwt.refreshExpiry === 'string' ?
    // Convert string like '7d' to ms using a simple parser
    (() => {
      const match = config.jwt.refreshExpiry.match(/(\d+)([smhd])/);
      if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
      const [, value, unit] = match;
      const num = parseInt(value, 10);
      switch (unit) {
        case 's':
          return num * 1000;
        case 'm':
          return num * 60 * 1000;
        case 'h':
          return num * 60 * 60 * 1000;
        case 'd':
          return num * 24 * 60 * 60 * 1000;
        default:
          return 7 * 24 * 60 * 60 * 1000;
      }
    })()
    : config.jwt.refreshExpiry;
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge,
    path: '/api/v1/auth', // cookie scoped to auth path
  });
};

// Register endpoint
const register = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.register(req.body);
    setRefreshCookie(res, refreshToken);
    const data = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
      accessToken,
    };
    res.status(201).json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// Login endpoint
const login = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body.email, req.body.password);
    setRefreshCookie(res, refreshToken);
    const data = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
      accessToken,
    };
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// Refresh token endpoint
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    console.log('Refresh token from cookie:', req.cookies?.refreshToken ? 'present' : 'absent');
    console.log('Refresh token from body:', req.body?.refreshToken ? 'present' : 'absent');
    console.log('Token being passed to service:', token ? 'present' : 'absent');
    const { user, accessToken } = await authService.refresh(token);
    const data = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
      accessToken,
    };
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// Logout endpoint
const logout = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : null;
    if (userId) await authService.logout(userId);
    // Clear cookie
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    res.json(new ApiResponse({ message: 'Logged out successfully' }));
  } catch (err) {
    next(err);
  }
};

// Password reset request endpoint
const resetPasswordRequest = async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.initiatePasswordReset(email);
    res.json(new ApiResponse({ message: 'If the email exists, a reset link will be sent.' }));
  } catch (err) {
    next(err);
  }
};

// Password reset confirmation endpoint
const resetPasswordConfirm = async (req, res, next) => {
  try {
    const { token, email, newPassword } = req.body;
    // Verify token belongs to email - the service already validates token hash and expiry
    const user = await authService.resetPassword(token, newPassword);
    // Optionally, invalidate all existing refresh tokens by clearing field
    user.refreshToken = undefined;
    await user.save();
    res.json(new ApiResponse({ message: 'Password has been reset successfully' }));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  resetPasswordRequest,
  resetPasswordConfirm,
};
