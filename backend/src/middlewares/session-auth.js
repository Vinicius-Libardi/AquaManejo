const { findSession } = require('../services/auth-service');
const { ApiError } = require('../errors/api-error');

const SESSION_COOKIE = 'aquamanejo_session';

function readCookie(request, name) {
  const prefix = `${name}=`;
  const value = (request.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return value ? value.slice(prefix.length) : '';
}

function sessionAuthentication(request, response, next) {
  const token = readCookie(request, SESSION_COOKIE);
  const session = findSession(request.app.locals.database, token);
  if (!session) return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Faça login para acessar sua conta.'));
  request.sessionToken = token;
  request.user = { id: session.id, name: session.name, email: session.email, sessionId: session.sessionId };
  return next();
}

function sessionCookie(token, maxAge = SESSION_DURATION_MS) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${secure}`;
}

const { SESSION_DURATION_MS } = require('../services/auth-service');

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

module.exports = { clearSessionCookie, readCookie, SESSION_COOKIE, sessionAuthentication, sessionCookie };
