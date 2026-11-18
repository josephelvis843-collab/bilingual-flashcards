import { createApp } from './app.js';
import { init, readKnown, writeKnown, storeName } from './progressStore.js';

const PORT = process.env.PORT || 3001; // hosts like Render set PORT for you

const app = createApp({
  store: { readKnown, writeKnown },
  corsOrigin: process.env.CORS_ORIGIN,
  // Render has 3 proxies (measured from its X-Forwarded-For chain); locally there are none.
  trustProxyHops: process.env.RENDER ? 3 : 0,
});

await init();
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT} (storage: ${storeName})`);
});
