const authService = require('../services/auth-service');
const { clearSessionCookie, readCookie, SESSION_COOKIE, sessionCookie } = require('../middlewares/session-auth');

function sendSession(response, result, status = 200) {
  response.setHeader('Set-Cookie', sessionCookie(result.session.token, authService.SESSION_DURATION_MS));
  return response.status(status).json({ data: { user: result.user, expiresAt: result.session.expiresAt } });
}

async function register(request, response) {
  return sendSession(response, await authService.register(request.app.locals.database, request.validated.body), 201);
}

async function login(request, response) {
  return sendSession(response, await authService.login(request.app.locals.database, request.validated.body));
}

function current(request, response) {
  return response.json({ data: { user: { id: request.user.id, name: request.user.name, email: request.user.email } } });
}

function logout(request, response) {
  authService.deleteSession(request.app.locals.database, request.sessionToken || readCookie(request, SESSION_COOKIE));
  response.setHeader('Set-Cookie', clearSessionCookie());
  return response.status(204).end();
}

module.exports = { current, login, logout, register };
