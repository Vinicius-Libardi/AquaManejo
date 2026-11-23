const { createHash, randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { ApiError } = require('../errors/api-error');

const scrypt = promisify(scryptCallback);
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const DUMMY_SALT = Buffer.alloc(16, 7);

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password, salt = randomBytes(16)) {
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, encodedHash) {
  const parts = encodedHash?.split('$');
  if (parts?.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nText, rText, pText, saltHex, keyHex] = parts;
  const n = Number(nText); const r = Number(rText); const p = Number(pText);
  if (n !== 16384 || r !== 8 || p !== 1 || !/^[a-f\d]{32}$/i.test(saltHex) || !/^[a-f\d]{128}$/i.test(keyHex)) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length,
    { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(actual, expected);
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.createdAt };
}

function createSession(database, userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  database.prepare('INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .run(userId, hashToken(token), expiresAt);
  database.prepare("DELETE FROM auth_sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run();
  return { token, expiresAt };
}

async function register(database, input) {
  const passwordHash = await hashPassword(input.password);
  const userId = database.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(input.name, input.email.toLowerCase(), passwordHash).lastInsertRowid;
  const user = database.prepare(`SELECT id, name, email, created_at AS createdAt FROM users WHERE id = ?`).get(userId);
  return { user: publicUser(user), session: createSession(database, user.id) };
}

async function login(database, input) {
  const user = database.prepare(`SELECT id, name, email, password_hash AS passwordHash,
      created_at AS createdAt FROM users WHERE email = ? COLLATE NOCASE`).get(input.email.toLowerCase());
  const passwordMatches = user?.passwordHash
    ? await verifyPassword(input.password, user.passwordHash)
    : await scrypt(input.password, DUMMY_SALT, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).then(() => false);
  if (!user || !passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }
  return { user: publicUser(user), session: createSession(database, user.id) };
}

function findSession(database, token) {
  if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  return database.prepare(`SELECT users.id, users.name, users.email,
      auth_sessions.id AS sessionId, auth_sessions.expires_at AS expiresAt
    FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
    .get(hashToken(token)) || null;
}

function deleteSession(database, token) {
  if (token) database.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token));
}

module.exports = { deleteSession, findSession, hashPassword, login, register, SESSION_DURATION_MS };
