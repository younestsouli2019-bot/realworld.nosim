export async function withRetry(fn, { attempts = 3, baseMs = 250, factor = 2, jitter = true } = {}) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const delay = baseMs * Math.pow(factor, i);
      const wait = jitter ? Math.floor(delay * (0.8 + Math.random() * 0.4)) : delay;
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

