import express from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, age, gender, height_cm, weight_kg,
              fitness_level, dietary_restrictions, subscription_tier, subscription_active
       FROM users WHERE id = $1`,
      [req.user.sub]
    );
    const user = result.rows[0];
    if (!user) throw new AppError('not_found', 'User not found', 404);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
