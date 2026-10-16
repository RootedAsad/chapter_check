import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const server = createApp(config).listen(config.port, () => {
  console.log(`ChapterCheck API listening on port ${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
