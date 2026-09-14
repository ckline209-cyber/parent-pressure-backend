import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from './errorHandler.js';

export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'unauthorized', message: 'Missing access token' });

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
  }
};

export const requirePremium = (req, res, next) => {
  if (req.user?.tier !== 'premium') {
    return next(new AppError('forbidden', 'This feature requires a premium subscription', 403));
  }
  next();
};
