import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = '7d';

export const createAccessToken = (userId, email, tier) => {
  return jwt.sign({ sub: userId, email, tier }, JWT_SECRET, { expiresIn: EXPIRES_IN });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
