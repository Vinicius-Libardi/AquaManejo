const cors = require('cors');
const express = require('express');
const apiRoutes = require('./routes');
const { errorHandler, notFound } = require('./middlewares/error-handler');
const path = require('node:path');
const { sessionAuthentication } = require('./middlewares/session-auth');
const { ApiError } = require('./errors/api-error');

const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8080', 'http://127.0.0.1:8080'];

function createApp({ database, authenticationMiddleware } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_ORIGINS) {
    throw new Error('Configure FRONTEND_ORIGINS antes de iniciar em produção.');
  }
  const origins = process.env.FRONTEND_ORIGINS
    ? process.env.FRONTEND_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;
  if (database) app.locals.database = database;
  // Testes e uma futura integração de identidade podem injetar um autenticador confiável.
  app.locals.authenticate = authenticationMiddleware || sessionAuthentication;
  app.use(cors({ credentials: true, origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    const error = new Error('Origem não permitida.');
    error.code = 'ORIGIN_NOT_ALLOWED';
    return callback(error);
  } }));
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (process.env.NODE_ENV === 'production') response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.get('Origin');
      if (origin && !origins.includes(origin)) return next(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não permitida.'));
    }
    return next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', apiRoutes);
  app.use(express.static(path.resolve(__dirname, '../../frontend'), { index: 'index.html', fallthrough: true }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
