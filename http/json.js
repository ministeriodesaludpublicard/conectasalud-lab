function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readJsonBody(req, maxBodySize) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBodySize) {
        settled = true;
        reject(requestError(`La solicitud supera el límite de ${Math.round(maxBodySize / 1024 / 1024)} MB.`, 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      const body = Buffer.concat(chunks).toString('utf8');
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(requestError('El cuerpo de la solicitud no contiene JSON válido.', 400)); }
    });
    req.on('error', error => { if (!settled) reject(error); });
  });
}

module.exports = { sendJson, readJsonBody };
