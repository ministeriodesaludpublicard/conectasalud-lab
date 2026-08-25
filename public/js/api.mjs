export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`El servidor respondió HTTP ${response.status} sin JSON.`); }
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.error || `Error HTTP ${response.status}`);
    error.details = payload.details;
    error.status = response.status;
    throw error;
  }
  return payload;
}
