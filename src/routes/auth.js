import express from 'express';
import pool from '../db/connection.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { createAccessToken } from '../utils/jwt.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  subscriptionTier: user.subscription_tier,
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password) {
      throw new AppError('invalid_request', 'Email and password are required', 400);
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new AppError('email_taken', 'An account with this email already exists', 409);
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name, last_name, subscription_tier`,
      [email, passwordHash, firstName || null, lastName || null]
    );

    const user = result.rows[0];
    const accessToken = createAccessToken(user.id, user.email, user.subscription_tier);
    res.status(201).json({ accessToken, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError('invalid_request', 'Email and password are required', 400);
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await comparePassword(password, user.password_hash))) {
      throw new AppError('invalid_credentials', 'Incorrect email or password', 401);
    }

    const accessToken = createAccessToken(user.id, user.email, user.subscription_tier);
    res.json({ accessToken, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
