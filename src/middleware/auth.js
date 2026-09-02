export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({error: "unauthorized"});
  req.user = {sub: 1};
  next();
};

export const requirePremium = (req, res, next) => {
  next();
};