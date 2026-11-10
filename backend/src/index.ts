import { uruchomObslugeSkanow } from './services/obsluga-skanow.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './db/pool.js';

const app = createApp();
const server = app.listen(env.port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`Sprawnik API nasłuchuje na porcie ${env.port}`);
});

const zatrzymajSkany = uruchomObslugeSkanow();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await zatrzymajSkany();
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  });
}
