# Mirth Connect Setup Guide

This guide provides step-by-step instructions for configuring Mirth Connect to work with the Lab Results Management System.

## Problem Resolution

The error `{"success":false,"message":"Route not found"}` occurs when Mirth Connect is not properly configured to send data to the correct endpoint.

## Solution Overview

The system provides two endpoints for Mirth Connect integration:

1. **Raw LDT Endpoint** (`/api/mirth-webhook`) - Recommended
2. **JSON Endpoint** (`/api/webhook/json`) - Alternative

## Option 1: Raw LDT Configuration (Recommended)

### Step 1: Create HTTP Sender Channel

1. **Open Mirth Connect Administrator**
2. **Create New Channel**
   - Name: `Lab Results Webhook`
   - Channel Type: `HTTP Sender`

### Step 2: Configure Source Connector

1. **Source Connector Settings**
   - **Connector Type**: `HTTP Listener`
   - **Port**: `8080` (or your preferred port)
   - **Context Path**: `/mirth/ldt`

### Step 3: Configure Destination Connector

1. **Destination Connector Settings**
   - **Connector Type**: `HTTP Sender`
   - **URL**: `http://your-server:5000/api/mirth-webhook`
   - **Method**: `POST`
   - **Content Type**: `text/plain`
   - **Response Data**: `Response`

### Step 4: Configure Transformer

1. **Open Destination Transformer**
2. **Add JavaScript Step**
3. **Use this transformer code**:

```javascript
// Mirth Connect Transformer for Raw LDT Endpoint
function doTransform() {
    var logger = Packages.org.apache.log4j.Logger.getLogger('transformer');

    var message = connectorMessage.getEncoded();
    if (message == null) {
        message = connectorMessage.getRawData();
    }

    // Log the incoming message for debugging
    logger.info("Incoming message: " + message);

    // For raw LDT endpoint, return the message as-is
    // The server will parse the LDT data
    return message;
}
```

### Step 5: Configure Response Handling

1. **Response Settings**
   - **Response Data**: `Response`
   - **Response Status**: `200`

2. **Error Handling**
   - **Response Status**: `400`, `404`, `500`
   - **Response Data**: `Response`

## Option 2: JSON Configuration (Alternative)

### Step 1: Create HTTP Sender Channel

1. **Open Mirth Connect Administrator**
2. **Create New Channel**
   - Name: `Lab Results JSON Webhook`
   - Channel Type: `HTTP Sender`

### Step 2: Configure Source Connector

1. **Source Connector Settings**
   - **Connector Type**: `HTTP Listener`
   - **Port**: `8080` (or your preferred port)
   - **Context Path**: `/mirth/json`

### Step 3: Configure Destination Connector

1. **Destination Connector Settings**
   - **Connector Type**: `HTTP Sender`
   - **URL**: `http://your-server:5000/api/webhook/json`
   - **Method**: `POST`
   - **Content Type**: `application/json`
   - **Response Data**: `Response`

### Step 4: Configure Transformer

1. **Open Destination Transformer**
2. **Add JavaScript Step**
3. **Use this transformer code**:

```javascript
// Mirth Connect Transformer for JSON Endpoint
function doTransform() {
    var logger = Packages.org.apache.log4j.Logger.getLogger('transformer');

    var message = connectorMessage.getEncoded();
    if (message == null) {
        message = connectorMessage.getRawData();
    }

    var lines = message.split('\n');

    var lanr = '';
    var bsnr = '';
    var firstName = '';
    var lastName = '';
    var birthDate = '';
    var gender = '';
    var labTests = [];
    var imagePath = '';

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();

        if (line.startsWith('0148') && lanr === '') {
            lanr = line.substring(4);
        }

        if (line.startsWith('0138') && bsnr === '') {
            bsnr = line.substring(4);
        }

        if (line.startsWith('0133101')) {
            lastName = line.substring(7);
        }

        if (line.startsWith('0133102')) {
            firstName = line.substring(7);
        }

        if (line.startsWith('0173103') && line.length >= 15) {
            birthDate = line.substring(7, 11) + '-' + line.substring(11, 13) + '-' + line.substring(13, 15);
        }

        if (line.startsWith('0103101')) {
            gender = line.substring(7);
        }

        if (line.startsWith('0148410') || line.startsWith('0138410') || line.startsWith('0128410') || line.startsWith('0118410')) {
            labTests.push(line.substring(7));
        }

        if (line.startsWith('0589901')) {
            var match = line.match(/IMAGENAME\\+(.+)/i);
            if (match) {
                imagePath = '\\\\' + match[1];
            }
        }
    }

    var payload = {
        lanr: lanr,
        bsnr: bsnr,
        patient: {
            firstName: firstName,
            lastName: lastName,
            birthDate: birthDate,
            gender: gender
        },
        labTests: labTests,
        imagePath: imagePath
    };

    tmp['jsonPayload'] = JSON.stringify(payload);
    logger.info("JSON Payload: " + tmp['jsonPayload']);
    return true;
}
```

## Testing the Configuration

### Test Raw LDT Endpoint

```bash
curl -X POST http://localhost:5000/api/mirth-webhook \
  -H "Content-Type: text/plain" \
  -d "01380008230\n014810000204\n0199212LDT1014.01"
```

**Expected Response**:
```json
{
  "success": true,
  "messageId": "uuid",
  "recordCount": 1,
  "resultId": "res_timestamp_id",
  "bsnr": null,
  "lanr": null,
  "patient": "Unknown Patient",
  "assignedTo": null,
  "message": "Result created but not assigned (admin review required)"
}
```

### Test JSON Endpoint

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

**Expected Response**:
```json
{
  "success": true,
  "messageId": "uuid",
  "resultId": "res_timestamp_id",
  "bsnr": "987654321",
  "lanr": "123456789",
  "patient": "John Doe",
  "assignedTo": "doctor@laborresults.de",
  "message": "Result assigned to doctor@laborresults.de"
}
```

## Troubleshooting

### Common Issues

1. **"Route not found" Error**
   - **Cause**: Wrong URL or server not running
   - **Solution**: 
     - Verify server is running: `curl http://localhost:5000/api/health`
     - Check URL spelling: `http://your-server:5000/api/mirth-webhook` (no trailing slash)
     - Ensure server is accessible from Mirth Connect

2. **"No valid LDT payload detected" Error**
   - **Cause**: Empty or malformed data
   - **Solution**:
     - Check transformer is sending raw LDT data
     - Verify message format in Mirth Connect logs
     - Test with sample LDT data

3. **Connection Refused Error**
   - **Cause**: Server not running or firewall blocking
   - **Solution**:
     - Start server: `cd server && npm start`
     - Check firewall settings
     - Verify port 5000 is open

4. **CORS Errors**
   - **Cause**: Cross-origin request issues
   - **Solution**:
     - Server is configured to allow all origins for Mirth Connect
     - Check if using HTTPS vs HTTP

### Debugging Steps

1. **Check Server Status**
   ```bash
   curl http://localhost:5000/api/health
   ```

2. **Test Endpoint Directly**
   ```bash
   curl -X POST http://localhost:5000/api/mirth-webhook \
     -H "Content-Type: text/plain" \
     -d "test message"
   ```

3. **Check Mirth Connect Logs**
   - Open Mirth Connect Administrator
   - Go to Dashboard → Channel Status
   - Check for error messages

4. **Verify Network Connectivity**
   ```bash
   telnet your-server 5000
   ```

## Advanced Configuration

### Custom Headers

If you need to add custom headers:

1. **In Destination Connector**
   - **HTTP Headers**: Add custom headers as needed
   - Example: `Authorization: Bearer your-token`

### Retry Logic

Configure retry logic for failed requests:

1. **In Destination Connector**
   - **Response Status**: `400`, `404`, `500`
   - **Retry Count**: `3`
   - **Retry Interval**: `5000` (5 seconds)

### Timeout Settings

1. **In Destination Connector**
   - **Timeout**: `30000` (30 seconds)
   - **Response Timeout**: `30000` (30 seconds)

## Security Considerations

1. **Use HTTPS in Production**
   - Change URL to: `https://your-server:5000/api/mirth-webhook`

2. **Authentication**
   - Consider adding API key authentication
   - Use JWT tokens for secure communication

3. **Network Security**
   - Configure firewall rules
   - Use VPN if needed
   - Monitor access logs

## Monitoring

1. **Mirth Connect Dashboard**
   - Monitor channel status
   - Check message counts
   - Review error logs

2. **Server Logs**
   ```bash
   tail -f server/logs/combined.log
   tail -f server/logs/error.log
   ```

3. **Health Checks**
   - Set up automated health checks
   - Monitor response times
   - Alert on failures

## Support

If you continue to experience issues:

1. **Check the troubleshooting guide above**
2. **Review server logs for detailed error messages**
3. **Test with the provided curl commands**
4. **Verify network connectivity between Mirth Connect and the server**
5. **Ensure the server is running and accessible**

For additional help, refer to the main README.md file or check the troubleshooting section.