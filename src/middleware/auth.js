import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from './errorHandler.js';
import pool from '../db/connection.js';

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

// Checks live subscription state in the DB rather than the `tier` claim baked into the
// access token at login - that claim goes stale the moment a user upgrades or cancels,
// since it isn't refreshed until they get a new token.
export const requirePremium = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT subscription_tier, subscription_active, subscription_end_date
       FROM users WHERE id = $1`,
      [req.user.sub]
    );
    const user = result.rows[0];
    const isActivePremium =
      user?.subscription_tier === 'premium' &&
      user.subscription_active &&
      (!user.subscription_end_date || new Date(user.subscription_end_date) > new Date());

    if (!isActivePremium) {
      return next(new AppError('forbidden', 'This feature requires a premium subscription', 403));
    }
    next();
  } catch (err) {
    next(err);
  }
};
