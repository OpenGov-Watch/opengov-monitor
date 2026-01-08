// PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [{
    name: 'opengov-api',
    script: './dist/index.js',
    cwd: '/home/opengov/api',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATABASE_PATH: '/home/opengov/data/polkadot.db'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    error_file: '/home/opengov/logs/api-error.log',
    out_file: '/home/opengov/logs/api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
