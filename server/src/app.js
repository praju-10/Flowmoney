import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { buildRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from './config.js';

export function createApp(db, { serveClient = true } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Only the local frontend origin(s) may call the API from a browser.
  app.use(cors({ origin: config.webOrigins }));
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', buildRouter(db));

  // Production: serve the built React app from the same local server.
  if (serveClient && fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(express.static(config.clientDist));
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
