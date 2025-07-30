require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - Allow all origins for Mirth Connect compatibility
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

// Mirth Connect ingestion endpoint to accept LDT payloads
app.post('/api/mirth-webhook', async (req, res) => {
  console.log('Received payload from Mirth Connect', {
    contentType: req.headers['content-type'],
    size: req.body ? req.body.length : 0,
  });

  // Basic validation – we expect a non-empty string
  if (!req.body || typeof req.body !== 'string' || req.body.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid LDT payload detected',
    });
  }

  // Simple LDT parsing (basic implementation)
  const lines = req.body.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return res.status(422).json({
      success: false,
      message: 'Unable to parse any LDT records',
    });
  }

  // Generate a simple message ID
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Extract basic information from LDT
  let bsnr = null;
  let lanr = null;
  
  // Simple parsing - look for BSNR and LANR in the data
  for (const line of lines) {
    if (line.startsWith('0138')) {
      bsnr = line.substring(4);
    } else if (line.startsWith('0148')) {
      lanr = line.substring(4);
    }
  }

  // Log the processing
  console.log(`Processed LDT message ${messageId}:`, {
    recordCount: lines.length,
    bsnr: bsnr,
    lanr: lanr,
    bodyPreview: req.body.substring(0, 200)
  });

  // Respond with processing details
  res.status(202).json({
    success: true,
    messageId,
    recordCount: lines.length,
    bsnr: bsnr,
    lanr: lanr,
    message: 'LDT payload processed successfully'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Fixed server running on port ${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`Mirth webhook: http://localhost:${PORT}/api/mirth-webhook`);
});