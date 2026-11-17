function success(res, data = null, status = 200, message = null) {
  return res.status(status).json({
    success: true,
    data,
    message,
  });
}

function failure(res, status, code, message) {
  return res.status(status).json({
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  });
}

module.exports = {
  failure,
  success,
};
