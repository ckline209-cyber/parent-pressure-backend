export const errorHandler = (err, req, res, next) => {
  res.status(err.statusCode || 500).json({error: err.error || "error", message: err.message});
};

export class AppError extends Error {
  constructor(error, message, statusCode = 400) {
    super(message);
    this.error = error;
    this.statusCode = statusCode;
  }
}