// Dev proxy: /ai -> Python AI service (8000); /api and /uploads -> Express backend (5001)
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(createProxyMiddleware('/ai', { target: 'http://localhost:8000', changeOrigin: true }));
  app.use(createProxyMiddleware(['/api', '/uploads'], { target: 'http://localhost:5001', changeOrigin: true }));
};
