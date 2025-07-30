const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - Allow all origins
app.use(cors({
  origin: '*',
  credentials: true
}));

// Body parser for text/plain
app.use(bodyParser.text({ type: '*/*', limit: '10mb' }));

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Mirth webhook endpoint
app.post('/api/mirth-webhook', (req, res) => {
  console.log('Received Mirth webhook request:');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Body length:', req.body ? req.body.length : 0);
  console.log('Body preview:', req.body ? req.body.substring(0, 200) : 'No body');
  
  if (!req.body || typeof req.body !== 'string' || req.body.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid LDT payload detected',
    });
  }

  // Simple response
  res.status(202).json({
    success: true,
    message: 'LDT payload received successfully',
    receivedAt: new Date().toISOString(),
    bodyLength: req.body.length,
    bodyPreview: req.body.substring(0, 100)
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Simple test server running on port ${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`Mirth webhook: http://localhost:${PORT}/api/mirth-webhook`);
});