const success = (res, status, data) => {
  res.status(status).json({ data });
};

const fail = (res, status, message) => {
  res.status(status).json({ error: message });
};

const ok = (res, data) => success(res, 200, data);
const created = (res, data) => success(res, 201, data);

const badReq = (res, message) => fail(res, 400, message);
const notFound = (res, message) => fail(res, 404, message);

module.exports = {
  ok,
  created,
  badReq,
  notFound,
};
