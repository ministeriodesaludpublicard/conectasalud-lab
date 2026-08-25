const http = require('http');
const { createApiController } = require('./controllers/apiController');
const { serveStatic } = require('./http/staticFiles');

function createApp(config) {
  const handleApi = createApiController(config);
  return http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) return handleApi(req, res);
    return serveStatic(req, res, config.publicDir);
  });
}

module.exports = { createApp };
