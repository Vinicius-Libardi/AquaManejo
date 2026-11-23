const { ApiError } = require('../errors/api-error');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const buckets = new Map();

function authRateLimit(request, response, next) {
  const now = Date.now();
  const address = request.socket.remoteAddress || 'unknown';
  const key = `${request.path}:${address}`;
  for (const [bucketKey, bucket] of buckets) {
    if (bucket.expiresAt <= now) buckets.delete(bucketKey);
  }
  const bucket = buckets.get(key);
  if (bucket && bucket.count >= MAX_ATTEMPTS) {
    response.setHeader('Retry-After', String(Math.ceil((bucket.expiresAt - now) / 1000)));
    return next(new ApiError(429, 'AUTH_RATE_LIMITED', 'Muitas tentativas. Aguarde antes de tentar novamente.'));
  }
  buckets.set(key, bucket ? { count: bucket.count + 1, expiresAt: bucket.expiresAt } : { count: 1, expiresAt: now + WINDOW_MS });
  return next();
}

module.exports = { authRateLimit };
