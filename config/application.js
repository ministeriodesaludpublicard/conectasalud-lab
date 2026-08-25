const path = require('path');
const { getEndpointConfig } = require('./endpoints');

const DEFAULT_PORT = 3445;
const DEFAULT_MAX_BODY_SIZE_MB = 20;
const DEFAULT_GUIDE_URL = 'https://igrepdom.netlify.app/';

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getApplicationConfig(env = process.env, warn = console.warn) {
  const endpoints = getEndpointConfig(env, warn);
  const maxBodySizeMb = positiveNumber(env.MAX_BODY_SIZE_MB, DEFAULT_MAX_BODY_SIZE_MB);
  return {
    port: positiveNumber(env.PORT, DEFAULT_PORT),
    publicDir: path.join(__dirname, '..', 'public'),
    maxBodySize: Math.round(maxBodySizeMb * 1024 * 1024),
    maxBodySizeMb,
    guideUrl: String(env.FHIR_GUIDE_URL || DEFAULT_GUIDE_URL),
    guideVersion: String(env.FHIR_GUIDE_VERSION || '').trim() || null,
    sourceId: String(env.MHD_SOURCE_ID || '').trim(),
    bearerToken: String(env.FHIR_BEARER_TOKEN || ''),
    scope: ['ITI-65', 'ITI-67', 'ITI-68'],
    ...endpoints
  };
}

module.exports = { DEFAULT_PORT, DEFAULT_MAX_BODY_SIZE_MB, DEFAULT_GUIDE_URL, getApplicationConfig };
