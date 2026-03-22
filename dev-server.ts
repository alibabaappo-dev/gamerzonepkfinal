// dev-server.ts
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { app } from './server';

async function start() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  
  const devApp = express();
  devApp.use(app); // Backend routes pehle
  devApp.use(vite.middlewares); // Vite baad mein
  
  devApp.listen(3000, '0.0.0.0', () => {
    console.log('Development server running at http://localhost:3000');
  });
}

start();
