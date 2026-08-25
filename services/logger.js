const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const LOG_DIR = path.resolve(process.env.LOG_DIR || path.join(__dirname, '..', 'logs'));
const LOG_FILE = path.join(LOG_DIR, 'conectasalud-lab.log');
const DEFAULT_LIMIT = 200;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function truncate(value, maxLength = 2000) {
  if (value === undefined || value === null) return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}... [truncated]`;
}

function sanitizeError(error) {
  if (!error) return null;
  return {
    message: error.message || String(error),
    code: error.code || null,
    status: error.response?.status || null,
    response: truncate(error.response?.data || null)
  };
}

function appendLog(entry) {
  ensureLogDir();

  const logEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    level: entry.level || 'info',
    action: entry.action || 'event',
    message: entry.message || '',
    direction: entry.direction || null,
    method: entry.method || null,
    url: entry.url || null,
    status: entry.status || null,
    durationMs: entry.durationMs || null,
    context: entry.context || null,
    error: sanitizeError(entry.error),
    responseSummary: entry.responseSummary || null
  };

  fs.appendFileSync(LOG_FILE, `${JSON.stringify(logEntry)}\n`, 'utf8');
  return logEntry;
}

function readLogs(limit = DEFAULT_LIMIT) {
  ensureLogDir();
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }

  const lines = fs
    .readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .slice(-Math.max(1, Number(limit) || DEFAULT_LIMIT));

  return lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
}

module.exports = {
  appendLog,
  readLogs
};
