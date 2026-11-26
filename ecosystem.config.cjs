// PM2 process file. CommonJS (.cjs) because the package itself is ESM.
//   pm2 startOrReload ecosystem.config.cjs && pm2 save
// Settings come from .env in the project directory (see .env.example).
module.exports = {
  apps: [
    {
      name: 'wizsla',
      script: 'dist/main.js',
      // The Node that runs this file: the `pm2` command in the deploying
      // shell (nvm's Node 24), not the one the PM2 daemon was started with
      // at boot, which may be older and also serves other apps.
      interpreter: process.execPath,
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
