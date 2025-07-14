# LDT and PDF Download API Guide

## Overview

The Labor Results Web App now supports downloading laboratory results in two standardized formats:

1. **LDT (Labor Daten Transfer)** - German standard for laboratory data exchange
2. **PDF** - Professional laboratory reports suitable for printing and archiving

## API Endpoints

### 1. Download All Results as LDT
```
GET /api/download/ldt
```

**Description**: Downloads all laboratory results in LDT format  
**Authentication**: Bearer token required  
**Response**: Binary file download (application/octet-stream)  
**Filename**: `lab_results_YYYY-MM-DD.ldt`

**Example**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -o lab_results.ldt \
     http://localhost:5000/api/download/ldt
```

### 2. Download All Results as PDF
```
GET /api/download/pdf
```

**Description**: Downloads all laboratory results as a formatted PDF report  
**Authentication**: Bearer token required  
**Response**: Binary file download (application/pdf)  
**Filename**: `lab_results_YYYY-MM-DD.pdf`

**Example**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -o lab_results.pdf \
     http://localhost:5000/api/download/pdf
```

### 3. Download Specific Result as LDT
```
GET /api/download/ldt/:resultId
```

**Description**: Downloads a specific laboratory result in LDT format  
**Parameters**: `resultId` - The ID of the result to download  
**Authentication**: Bearer token required  
**Response**: Binary file download (application/octet-stream)  
**Filename**: `result_RESULTID_YYYY-MM-DD.ldt`

**Example**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -o result_res001.ldt \
     http://localhost:5000/api/download/ldt/res001
```

### 4. Download Specific Result as PDF
```
GET /api/download/pdf/:resultId
```

**Description**: Downloads a specific laboratory result as a formatted PDF report  
**Parameters**: `resultId` - The ID of the result to download  
**Authentication**: Bearer token required  
**Response**: Binary file download (application/pdf)  
**Filename**: `result_RESULTID_YYYY-MM-DD.pdf`

**Example**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -o result_res001.pdf \
     http://localhost:5000/api/download/pdf/res001
```

## LDT Format Specification

### Record Types
- **8000**: Header record (software version, creation date/time)
- **8100**: Practice/Lab identification
- **8200**: Patient data
- **8300**: Request data
- **8400**: Result data
- **8500**: Footer record

### Sample LDT Output
```
0278000921818LABOR_RESULTS_V2.1
022800091032024XXXXX
022800091042230000
0208000910616UTF-8
0348100020117Labor Results System
037810002031Medical Center Street 1
018810002041245
023810002051Medical City
027810002471+49-123-456789
034810002491info@laborresults.de
021820031011Mustermann
0168200310213Max
0198200310319800101
0148200311016U
0208200300014MAXMUSTERMANN
0218300730311res001
0258300730420240115
023830073111123456789
0298300731313Practice 123456789
026840072601BLOODCOUNT
0218400726111Blood Count
0168400726214.5
0228400726310^6/μL
020840072641.0-5.5
014840072651F
0258400726820240115
0248400726923000000
015850092181EOF
```

### LDT Field Descriptions
- **Record length**: First 3 digits indicate total record length
- **Record type**: Digits 4-7 indicate the record type (8000, 8100, etc.)
- **Field ID**: Digits 8-11 indicate the specific field within the record type
- **Content**: Remaining characters contain the actual data

## PDF Format Specification

### Document Structure
1. **Header Section**
   - Laboratory information
   - Report generation timestamp
   - Contact details

2. **Results Section**
   - Patient-grouped results
   - Tabular format with columns:
     - Result ID
     - Date
     - Test Type
     - Status (color-coded)
     - Test Value
     - Reference Range

3. **Summary Section**
   - Total results count
   - Final vs. Preliminary results breakdown
   - Unique patients count

4. **Footer Section**
   - Page numbering
   - Confidentiality notice
   - System attribution

### PDF Features
- **A4 page format** with professional layout
- **Color-coded status badges** (green for Final, yellow for Preliminary)
- **Automatic page breaks** for large datasets
- **Patient grouping** for better organization
- **Header repetition** on new pages
- **Comprehensive summary** statistics

## Frontend Integration

### Download Buttons
The React frontend includes download functionality with:

1. **Bulk Download Section**
   - Download all results as LDT
   - Download all results as PDF
   - Shows count of included results
   - Disabled when no results available

2. **Individual Result Actions**
   - LDT download button for each result
   - PDF download button for each result
   - Disabled during active downloads

### Frontend Implementation
```javascript
// Download all results as LDT
const downloadAllAsLDT = () => {
  const filename = `lab_results_${new Date().toISOString().slice(0, 10)}.ldt`;
  downloadFile('/api/download/ldt', filename);
};

// Download specific result as PDF
const downloadResultAsPDF = (resultId) => {
  const filename = `result_${resultId}_${new Date().toISOString().slice(0, 10)}.pdf`;
  downloadFile(`/api/download/pdf/${resultId}`, filename);
};
```

## Error Handling

### Common Error Responses

**404 - Result Not Found**:
```json
{
  "error": "Result not found"
}
```

**500 - Generation Error**:
```json
{
  "error": "Failed to generate LDT file",
  "details": "Specific error message"
}
```

**401 - Authentication Error**:
```json
{
  "error": "Unauthorized"
}
```

### Frontend Error Handling
- Download failures display error messages
- Loading states prevent multiple simultaneous downloads
- Network timeouts are handled gracefully
- User feedback provided for all download states

## Security Considerations

### Authentication
- All download endpoints require valid bearer token
- Token validation on each request
- User authorization for data access

### Data Privacy
- Downloads filtered by user permissions
- No sensitive data in error messages
- Secure file transmission over HTTPS (in production)

### File Handling
- Temporary file cleanup on server
- Memory-efficient streaming for large files
- Proper MIME type headers

## Usage Examples

### Browser JavaScript
```javascript
// Download with authentication
fetch('/api/download/pdf', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
})
.then(response => response.blob())
.then(blob => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lab_results.pdf';
  a.click();
});
```

### Node.js Client
```javascript
const fs = require('fs');
const fetch = require('node-fetch');

const downloadLDT = async (token) => {
  const response = await fetch('http://localhost:5000/api/download/ldt', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const buffer = await response.buffer();
  fs.writeFileSync('lab_results.ldt', buffer);
};
```

## Testing the Downloads

### Manual Testing
1. Login to the application
2. Navigate to the Results Dashboard
3. Use the download buttons in the "Download Results" section
4. Verify files are downloaded with correct names and content

### API Testing
```bash
# Test LDT download
curl -H "Authorization: Bearer fake-jwt-token" \
     -o test.ldt \
     http://localhost:5000/api/download/ldt

# Test PDF download
curl -H "Authorization: Bearer fake-jwt-token" \
     -o test.pdf \
     http://localhost:5000/api/download/pdf

# Verify file contents
file test.ldt  # Should show: ASCII text
file test.pdf  # Should show: PDF document
```

## Future Enhancements

### Planned Features
1. **Filtered Downloads**: Download only filtered/selected results
2. **Custom Date Ranges**: Specify date ranges for downloads
3. **Email Integration**: Send downloads via email
4. **Batch Processing**: Queue large downloads
5. **Digital Signatures**: Sign PDF reports digitally
6. **Template Customization**: Configurable PDF layouts

### Integration Opportunities
1. **Database Filtering**: Real patient data filtering
2. **User Permissions**: Role-based download access
3. **Audit Logging**: Track all download activities
4. **External Systems**: Integration with hospital systems
5. **Compression**: ZIP archives for bulk downloads

This comprehensive download system provides healthcare professionals with standardized, secure access to laboratory data in both machine-readable (LDT) and human-readable (PDF) formats.