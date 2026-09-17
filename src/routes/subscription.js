import express from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Server-side pricing so a client can't dictate what it's charged.
const PLAN_PRICING = {
  monthly: { amountUsd: 9.99, durationDays: 30 },
  yearly: { amountUsd: 79.99, durationDays: 365 },
};

router.get('/status', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT subscription_tier, subscription_active, subscription_start_date, subscription_end_date
       FROM users WHERE id = $1`,
      [req.user.sub]
    );
    if (result.rows.length === 0) {
      throw new AppError('not_found', 'User not found', 404);
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/upgrade', authenticate, async (req, res, next) => {
  const { plan, google_play_order_id } = req.body;
  const pricing = PLAN_PRICING[plan];
  if (!pricing) {
    return next(new AppError('invalid_request', 'plan must be "monthly" or "yearly"', 400));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + pricing.durationDays * 24 * 60 * 60 * 1000);

    const userResult = await client.query(
      `UPDATE users
       SET subscription_tier = 'premium', subscription_active = true,
           subscription_start_date = $1, subscription_end_date = $2,
           google_play_subscription_id = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING subscription_tier, subscription_active, subscription_start_date, subscription_end_date`,
      [startDate, endDate, google_play_order_id || null, req.user.sub]
    );

    await client.query(
      `INSERT INTO subscription_events (user_id, event_type, subscription_tier, amount_usd, google_play_order_id)
       VALUES ($1, 'upgrade', 'premium', $2, $3)`,
      [req.user.sub, pricing.amountUsd, google_play_order_id || null]
    );

    await client.query('COMMIT');
    res.json({ subscription: userResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/cancel', authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `UPDATE users
       SET subscription_tier = 'free', subscription_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING subscription_tier, subscription_active, subscription_start_date, subscription_end_date`,
      [req.user.sub]
    );

    await client.query(
      `INSERT INTO subscription_events (user_id, event_type, subscription_tier)
       VALUES ($1, 'cancel', 'free')`,
      [req.user.sub]
    );

    await client.query('COMMIT');
    res.json({ subscription: userResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
