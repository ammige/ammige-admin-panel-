// PM2 process config for Hostinger VPS (or any Node server).
// Usage: npm run build && pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: 'ammige',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
