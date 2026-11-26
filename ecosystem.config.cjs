// PM2 process file. CommonJS (.cjs) because the package itself is ESM.
//   pm2 startOrReload ecosystem.config.cjs && pm2 save
// Settings come from .env in the project directory (see .env.example).
module.exports = {
  apps: [
    {
      name: 'wizsla',
      script: 'dist/main.js',
      // The database and backup paths are relative to the project directory.
      cwd: __dirname,
      // One process: the bulb queues and the state cache live in memory.
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      // Back off when it keeps crashing (e.g. invalid .env) instead of looping.
      exp_backoff_restart_delay: 1000,
      max_memory_restart: '300M',
      // Time for open requests and the database to close on reload.
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
