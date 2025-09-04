const path = require('path');

// Import the main server application
const app = require(path.join(__dirname, '..', 'src', 'server.js'));

// Export for Vercel serverless functions
module.exports = app;