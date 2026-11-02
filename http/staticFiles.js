const fs = require('fs');
const path = require('path');
const { sendJson } = require('./json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/fhir+json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function resolvePublicFile(publicDir, pathname) {
  const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let decodedPath;
  try { decodedPath = decodeURIComponent(requestedPath); }
  catch { return null; }
  const filePath = path.resolve(publicDir, decodedPath);
  const relativePath = path.relative(publicDir, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  return filePath;
}

function serveStatic(req, res, publicDir) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const filePath = resolvePublicFile(publicDir, requestUrl.pathname);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { ok: false, error: 'Recurso no encontrado.' });
    return;
  }
<<<<<<< HEAD
  res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
=======
  const extension = path.extname(filePath).toLowerCase();
  const headers = { 'Content-Type': MIME_TYPES[extension] || 'application/octet-stream' };
  // Evita reutilizar versiones anteriores de HTML y módulos tras desplegar cambios.
  if (['.html', '.js', '.mjs'].includes(extension)) headers['Cache-Control'] = 'no-cache, must-revalidate';
  res.writeHead(200, headers);
>>>>>>> origin/master
  fs.createReadStream(filePath).pipe(res);
}

module.exports = { MIME_TYPES, resolvePublicFile, serveStatic };
