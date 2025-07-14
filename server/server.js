// server/server.js
require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const cors = require('cors');
const path = require('path');
const LDTGenerator = require('./utils/ldtGenerator');
const PDFGenerator = require('./utils/pdfGenerator');

const app = express();
const PORT = process.env.PORT || 5000; // Backend will run on port 5000

// Middleware
app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(express.json()); // Parse JSON request bodies

// --- Backend API Routes ---

// Example: Login endpoint
app.post('/api/login', (req, res) => {
    const { bsnr, lanr, password } = req.body;
    // TODO: Implement secure authentication logic (hash password, check against DB)
    // Use Cursor's AI to help generate this logic!
    console.log(`Login attempt for BSNR: ${bsnr}, LANR: ${lanr}`);

    // Placeholder for demonstration:
    if (bsnr === '123456789' && lanr === '1234567' && password === 'securepassword') {
        // In a real app, generate a JWT token here
        res.json({ success: true, message: 'Login successful', token: 'fake-jwt-token' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Example: Fetch labor results
app.get('/api/results', (req, res) => {
    // TODO: Authenticate user via token, then fetch results from DB based on BSNR/LANR
    // Use Cursor's AI to help with database queries and data filtering!
    console.log('Fetching results...');
    const mockResults = [
        { id: 'res001', date: '2023-01-15', type: 'Blood Count', status: 'Final', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
        { id: 'res002', date: '2023-01-10', type: 'Urinalysis', status: 'Final', patient: 'Erika Musterfrau', bsnr: '123456789', lanr: '1234567' },
        { id: 'res003', date: '2023-01-05', type: 'Microbiology', status: 'Preliminary', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
    ];
    res.json(mockResults);
});

// --- Mirth Connect Ingestion Endpoint ---
// This endpoint will receive data from Mirth Connect.
// In a production scenario, Mirth Connect would need to access your public IP/domain.
// For local testing, you might use tunneling tools like ngrok.
app.post('/api/mirth-webhook', (req, res) => {
    console.log('Received data from Mirth Connect:', JSON.stringify(req.body, null, 2));
    // TODO:
    // 1. Validate the incoming data (e.g., against LDT schema, if Mirth sends raw LDT or a structured version).
    // 2. Parse and transform the data into your database schema.
    // 3. Store the data in your database, linking it to the correct BSNR/LANR.
    // Use Cursor's AI to help with data parsing and database insertion logic!
    res.status(200).json({ message: 'Data received and processed successfully' });
});

// --- Download Endpoints ---

// Download results as LDT format
app.get('/api/download/ldt', (req, res) => {
    try {
        // In a real app, you would filter results based on user permissions, date ranges, etc.
        const mockResults = [
            { id: 'res001', date: '2023-01-15', type: 'Blood Count', status: 'Final', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
            { id: 'res002', date: '2023-01-10', type: 'Urinalysis', status: 'Final', patient: 'Erika Musterfrau', bsnr: '123456789', lanr: '1234567' },
            { id: 'res003', date: '2023-01-05', type: 'Microbiology', status: 'Preliminary', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
        ];

        const ldtGenerator = new LDTGenerator();
        const ldtContent = ldtGenerator.generateLDT(mockResults, {
            labInfo: {
                name: 'Labor Results System',
                street: 'Medical Center Street 1',
                zipCode: '12345',
                city: 'Medical City',
                phone: '+49-123-456789',
                email: 'info@laborresults.de'
            }
        });

        const filename = `lab_results_${new Date().toISOString().slice(0, 10)}.ldt`;
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(ldtContent, 'utf8'));
        
        res.send(ldtContent);
        console.log(`LDT file downloaded: ${filename}`);
    } catch (error) {
        console.error('Error generating LDT file:', error);
        res.status(500).json({ error: 'Failed to generate LDT file', details: error.message });
    }
});

// Download results as PDF
app.get('/api/download/pdf', async (req, res) => {
    try {
        // In a real app, you would filter results based on user permissions, date ranges, etc.
        const mockResults = [
            { id: 'res001', date: '2023-01-15', type: 'Blood Count', status: 'Final', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
            { id: 'res002', date: '2023-01-10', type: 'Urinalysis', status: 'Final', patient: 'Erika Musterfrau', bsnr: '123456789', lanr: '1234567' },
            { id: 'res003', date: '2023-01-05', type: 'Microbiology', status: 'Preliminary', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
        ];

        const pdfGenerator = new PDFGenerator();
        const pdfBuffer = await pdfGenerator.generatePDF(mockResults, {
            labInfo: {
                name: 'Labor Results System',
                street: 'Medical Center Street 1',
                zipCode: '12345',
                city: 'Medical City',
                phone: '+49-123-456789',
                email: 'info@laborresults.de'
            }
        });

        const filename = `lab_results_${new Date().toISOString().slice(0, 10)}.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        res.send(pdfBuffer);
        console.log(`PDF file downloaded: ${filename}`);
    } catch (error) {
        console.error('Error generating PDF file:', error);
        res.status(500).json({ error: 'Failed to generate PDF file', details: error.message });
    }
});

// Download specific result by ID as LDT
app.get('/api/download/ldt/:resultId', (req, res) => {
    try {
        const resultId = req.params.resultId;
        
        // In a real app, fetch the specific result from database
        const mockResults = [
            { id: 'res001', date: '2023-01-15', type: 'Blood Count', status: 'Final', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
            { id: 'res002', date: '2023-01-10', type: 'Urinalysis', status: 'Final', patient: 'Erika Musterfrau', bsnr: '123456789', lanr: '1234567' },
            { id: 'res003', date: '2023-01-05', type: 'Microbiology', status: 'Preliminary', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
        ];

        const result = mockResults.find(r => r.id === resultId);
        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }

        const ldtGenerator = new LDTGenerator();
        const ldtContent = ldtGenerator.generateLDT([result]);

        const filename = `result_${resultId}_${new Date().toISOString().slice(0, 10)}.ldt`;
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(ldtContent, 'utf8'));
        
        res.send(ldtContent);
        console.log(`LDT file downloaded for result ${resultId}: ${filename}`);
    } catch (error) {
        console.error('Error generating LDT file for result:', error);
        res.status(500).json({ error: 'Failed to generate LDT file', details: error.message });
    }
});

// Download specific result by ID as PDF
app.get('/api/download/pdf/:resultId', async (req, res) => {
    try {
        const resultId = req.params.resultId;
        
        // In a real app, fetch the specific result from database
        const mockResults = [
            { id: 'res001', date: '2023-01-15', type: 'Blood Count', status: 'Final', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
            { id: 'res002', date: '2023-01-10', type: 'Urinalysis', status: 'Final', patient: 'Erika Musterfrau', bsnr: '123456789', lanr: '1234567' },
            { id: 'res003', date: '2023-01-05', type: 'Microbiology', status: 'Preliminary', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
        ];

        const result = mockResults.find(r => r.id === resultId);
        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }

        const pdfGenerator = new PDFGenerator();
        const pdfBuffer = await pdfGenerator.generatePDF([result]);

        const filename = `result_${resultId}_${new Date().toISOString().slice(0, 10)}.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        res.send(pdfBuffer);
        console.log(`PDF file downloaded for result ${resultId}: ${filename}`);
    } catch (error) {
        console.error('Error generating PDF file for result:', error);
        res.status(500).json({ error: 'Failed to generate PDF file', details: error.message });
    }
});

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});