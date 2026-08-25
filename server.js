require('dotenv').config();

const { createApp } = require('./app');
const { getApplicationConfig } = require('./config/application');
const { appendLog } = require('./services/logger');

function start() {
  const config = getApplicationConfig();
  const server = createApp(config);
  server.listen(config.port, () => {
    appendLog({
      level: 'info', action: 'app.start',
      message: `ConectaSalud Lab disponible en http://localhost:${config.port}`,
      context: { port: config.port, hapiFhirUrl: config.hapiFhirUrl, scope: config.scope }
    });
    console.log(`ConectaSalud Lab disponible en http://localhost:${config.port}`);
  });
  return server;
}

if (require.main === module) start();

module.exports = { start };
