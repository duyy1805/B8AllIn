module.exports = (err, req, res, next) => {
  console.error(err);
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  res.status(status).json({
    success: false,
    message: err.originalError?.info?.message || err.message || 'Internal server error',
    number: err.number || err.originalError?.info?.number || null
  });
};
