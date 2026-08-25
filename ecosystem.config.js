module.exports = {
  apps: [{
    name: 'conectasalud-lab',
    cwd: __dirname,
    script: './server.js',
    env: { NODE_ENV: 'production' }
  }]
};
