const errorHandler = (err, req, res, next) => {
  console.error("🔥 Error", err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.code || err.name || "ServerError",
    message: err.message || "Internal Server Error",
    ...(err.details ? { details: err.details } : {}),
  });
};

export { errorHandler };
