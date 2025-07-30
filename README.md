# Lab Results Management System

A comprehensive laboratory results management system with user authentication, result tracking, and Mirth Connect integration.

## Features

- **User Management**: Role-based access control (Admin, Doctor, Lab Tech)
- **Result Management**: Upload, view, and download lab results
- **Mirth Connect Integration**: Receive LDT messages from Mirth Connect
- **PDF Generation**: Download results as PDF files
- **Audit Logging**: Track all system activities
- **REST API**: Full REST API for integration

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lab-results-system
   ```

2. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

The server will start on `http://localhost:5000` with default users:
- **Admin**: admin@laborresults.de / admin123
- **Doctor**: doctor@laborresults.de / doctor123  
- **Lab Tech**: lab@laborresults.de / lab123

## Mirth Connect Integration

### Configuration Options

The system supports two different Mirth Connect integration approaches:

#### Option 1: Raw LDT Data (Recommended)

**Endpoint**: `POST /api/mirth-webhook`
**Content-Type**: `text/plain`
**Data Format**: Raw LDT message

**Mirth Connect Configuration**:
1. **Destination Type**: HTTP Sender
2. **URL**: `http://your-server:5000/api/mirth-webhook`
3. **Method**: POST
4. **Content Type**: `text/plain`
5. **Transformer**: Use the `transformForRawLDT` function from `mirth-connect-transformer.js`

**Transformer Code**:
```javascript
// Use this function for raw LDT endpoint
function transformForRawLDT(msg, channelMap, sourceMap) {
    try {
        // Get the LDT message from the incoming message
        const ldtMessage = msg.toString();
        
        // For the /api/mirth-webhook endpoint, return raw LDT data
        return ldtMessage;
        
    } catch (error) {
        logger.error('Raw LDT Transformer error:', error);
        
        // Return error response
        return JSON.stringify({
            error: true,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
```

#### Option 2: JSON Data

**Endpoint**: `POST /api/webhook/json`
**Content-Type**: `application/json`
**Data Format**: Structured JSON payload

**Mirth Connect Configuration**:
1. **Destination Type**: HTTP Sender
2. **URL**: `http://your-server:5000/api/webhook/json`
3. **Method**: POST
4. **Content Type**: `application/json`
5. **Transformer**: Use the `transform` function from `mirth-connect-transformer.js`

**Transformer Code**:
```javascript
// Use this function for JSON endpoint
function transform(msg, channelMap, sourceMap) {
    try {
        // Get the LDT message from the incoming message
        const ldtMessage = msg.toString();
        
        // For the JSON endpoint, transform LDT to JSON
        const jsonPayload = transformLDTToJSON(ldtMessage);
        
        // Return the JSON payload for /api/webhook/json endpoint
        return JSON.stringify(jsonPayload);
        
    } catch (error) {
        logger.error('Transformer error:', error);
        
        // Return error response
        return JSON.stringify({
            error: true,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
```

### Troubleshooting Mirth Connect Integration

#### Common Issues and Solutions

1. **"Route not found" Error**
   - **Cause**: Wrong endpoint URL or HTTP method
   - **Solution**: Verify the URL is exactly `http://your-server:5000/api/mirth-webhook` (no trailing slash)
   - **Check**: Ensure the server is running and accessible

2. **"No valid LDT payload detected" Error**
   - **Cause**: Empty or invalid LDT data
   - **Solution**: Check that the transformer is sending the raw LDT message, not JSON
   - **Verify**: Use the `transformForRawLDT` function for raw LDT endpoint

3. **"LANR and BSNR are required fields" Error**
   - **Cause**: Missing required identifiers in JSON payload
   - **Solution**: Ensure the LDT message contains BSNR and LANR data
   - **Check**: Verify the LDT parsing logic extracts these fields correctly

4. **Connection Refused Error**
   - **Cause**: Server not running or wrong port
   - **Solution**: Start the server with `npm start` and verify it's running on port 5000
   - **Check**: Test with `curl -X POST http://localhost:5000/api/mirth-webhook -H "Content-Type: text/plain" -d "test"`

#### Testing the Integration

1. **Test Raw LDT Endpoint**:
   ```bash
   curl -X POST http://localhost:5000/api/mirth-webhook \
     -H "Content-Type: text/plain" \
     -d "01380008230\n014810000204\n0199212LDT1014.01"
   ```

2. **Test JSON Endpoint**:
   ```bash
   curl -X POST http://localhost:5000/api/webhook/json \
     -H "Content-Type: application/json" \
     -d '{
       "lanr": "123456789",
       "bsnr": "987654321",
       "patient": "John Doe",
       "type": "Laboratory Test",
       "status": "Final",
       "date": "2024-01-15"
     }'
   ```

### LDT Message Format

The system expects LDT (Laboratory Data Transfer) messages in the following format:

```
01380008230    # BSNR (Patient ID)
014810000204   # LANR (Doctor ID)
0199212LDT1014.01  # Message header
# Additional LDT records...
```

## API Endpoints

### Authentication

#### POST `/api/auth/login`
Login with email and password.

**Request**:
```json
{
  "email": "doctor@laborresults.de",
  "password": "doctor123"
}
```

**Response**:
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "doctor@laborresults.de",
    "role": "doctor",
    "permissions": ["view_results", "download_results"]
  }
}
```

### Results Management

#### GET `/api/results`
Get all results for the authenticated user.

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "id": "result_id",
      "date": "2024-01-15",
      "type": "Blood Test",
      "status": "Final",
      "patient": "John Doe",
      "assignedTo": "doctor@laborresults.de"
    }
  ]
}
```

#### GET `/api/results/:id`
Get a specific result by ID.

#### GET `/api/results/:id/download`
Download a result as PDF.

### Mirth Connect Webhooks

#### POST `/api/mirth-webhook`
Receive raw LDT messages from Mirth Connect.

**Content-Type**: `text/plain`

**Request**: Raw LDT message string

**Response**:
```json
{
  "success": true,
  "messageId": "uuid",
  "recordCount": 3,
  "resultId": "res_timestamp_id",
  "bsnr": "123456789",
  "lanr": "987654321",
  "patient": "John Doe",
  "assignedTo": "doctor@laborresults.de",
  "message": "Result assigned to doctor@laborresults.de"
}
```

#### POST `/api/webhook/json`
Receive structured JSON data from Mirth Connect.

**Content-Type**: `application/json`

**Request**:
```json
{
  "lanr": "123456789",
  "bsnr": "987654321",
  "patient": "John Doe",
  "type": "Laboratory Test",
  "status": "Final",
  "date": "2024-01-15",
  "resultId": "res_timestamp_id",
  "data": {
    "patientId": "PAT123",
    "birthDate": "1980-01-01",
    "labName": "Medical Lab",
    "parameters": []
  }
}
```

## User Management

### Default Users

The system comes with three default users:

1. **Admin** (`admin@laborresults.de` / `admin123`)
   - Full system access
   - Can manage users and view all results

2. **Doctor** (`doctor@laborresults.de` / `doctor123`)
   - Can view and download assigned results
   - BSNR: `123456789`, LANR: `987654321`

3. **Lab Tech** (`lab@laborresults.de` / `lab123`)
   - Can upload and manage results
   - Limited to lab operations

### User Roles and Permissions

- **Admin**: All permissions
- **Doctor**: `view_results`, `download_results`
- **Lab Tech**: `upload_results`, `view_results`

## Environment Variables

Create a `.env` file in the server directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# Lab Information (for PDF generation)
LAB_NAME=Medical Laboratory
LAB_STREET=Medical Center Street 1
LAB_ZIP=12345
LAB_CITY=Medical City
LAB_PHONE=+49-123-456789
LAB_EMAIL=info@laborresults.de

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
```

## Development

### Running in Development Mode

```bash
cd server
npm run dev
```

### Running Tests

```bash
npm test
```

### API Testing

Use the provided test scripts:

```bash
# Test all endpoints
./test-api.sh

# Test specific functionality
node test-api-endpoints.js
```

## Deployment

### Docker Deployment

```bash
# Build the image
docker build -t lab-results-system .

# Run the container
docker run -p 5000:5000 lab-results-system
```

### Production Considerations

1. **Environment Variables**: Set all required environment variables
2. **JWT Secret**: Use a strong, unique JWT secret
3. **HTTPS**: Use HTTPS in production
4. **Database**: Consider using a persistent database
5. **Logging**: Configure proper logging for production
6. **Monitoring**: Set up monitoring and alerting

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port 5000
   netstat -ano | findstr :5000
   
   # Kill the process
   taskkill /PID <pid> /F
   ```

2. **Permission Denied**
   - Ensure you have write permissions for logs directory
   - Run as administrator if needed

3. **CORS Issues**
   - Check FRONTEND_URL environment variable
   - Verify CORS configuration in server.js

4. **JWT Token Issues**
   - Ensure JWT_SECRET is set
   - Check token expiration

### Logs

Check the logs in `server/logs/`:
- `combined.log`: All logs
- `error.log`: Error logs only

## Support

For issues and questions:
1. Check the troubleshooting guide
2. Review the logs
3. Test with the provided test scripts
4. Verify Mirth Connect configuration

## License

This project is licensed under the MIT License.