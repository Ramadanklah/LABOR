# Testing Guide for Labor Results Web App

This guide will help you test all the functionality of the Labor Results Web App to ensure everything is working correctly.

## Prerequisites

Before testing, make sure both servers are running:

1. **Backend Server** (Port 5000)
   ```bash
   cd server
   npm start
   ```
   You should see: "Server running on http://localhost:5000"

2. **Frontend Server** (Port 3000)
   ```bash
   cd client
   npm run dev
   ```
   This should automatically open http://localhost:3000 in your browser

## Test Cases

### 1. Test Backend API Endpoints

You can test the backend endpoints directly using curl or a tool like Postman:

#### Test Login Endpoint
```bash
# Valid credentials
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"bsnr": "123456789", "lanr": "1234567", "password": "doctor123"}'

# Expected response:
# {"success":true,"message":"Login successful","token":"fake-jwt-token"}

# Invalid credentials
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"bsnr": "wrong", "lanr": "wrong", "password": "wrong"}'

# Expected response:
# {"success":false,"message":"Invalid credentials"}
```

#### Test Results Endpoint
```bash
curl -H "Authorization: Bearer <TOKEN>" -X GET http://localhost:5000/api/results

# Expected response: Array of 3 mock lab results
```

#### Test Mirth Connect Webhook
```bash
curl -X POST http://localhost:5000/api/mirth-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data from mirth connect"}'

# Expected response:
# {"message":"Data received and processed successfully"}
```

#### Test Download Endpoints
```bash
# Test LDT download (all results)
curl -H "Authorization: Bearer <TOKEN>" -X GET http://localhost:5000/api/download/ldt \
  -o test_results.ldt

# Test PDF download (all results)  
curl -H "Authorization: Bearer <TOKEN>" -X GET http://localhost:5000/api/download/pdf \
  -o test_results.pdf

# Test specific result LDT download
curl -H "Authorization: Bearer <TOKEN>" -X GET http://localhost:5000/api/download/ldt/res001 \
  -o test_result_res001.ldt

# Test specific result PDF download
curl -H "Authorization: Bearer <TOKEN>" -X GET http://localhost:5000/api/download/pdf/res001 \
  -o test_result_res001.pdf

# Verify file types
file test_results.ldt  # Should show: ASCII text
file test_results.pdf  # Should show: PDF document
```

### Quick E2E Script

```bash
node scripts/e2e-login-download.js
```

This will perform health check, login, fetch results, and download LDT/PDF to `/tmp/test_e2e.*`.

### 2. Test Frontend Application

#### Login Page Tests

1. **Access Login Page**
   - Open http://localhost:3000
   - You should see the "Labor Results Login" page with a clean, modern design

2. **Test Invalid Login**
   - Enter any incorrect credentials
   - Click "Login"
   - You should see "Invalid credentials" message

3. **Test Valid Login**
   - BSNR: `123456789`
   - LANR: `1234567`
   - Password: `securepassword`
   - Click "Login"
   - You should see "Login successful" message and be redirected to the dashboard

#### Results Dashboard Tests

After successful login, you should see the Results Dashboard with:

1. **Navigation Bar**
   - "Labor Results Dashboard" title on the left
   - "Logout" button on the right

2. **Search and Filter Section**
   - Search input for patient name or result ID
   - Status filter dropdown (All Statuses, Final, Preliminary)
   - Type filter dropdown (All Types, Blood Count, Urinalysis, Microbiology)

3. **Results Table**
   - Should display 3 mock results
   - Columns: Result ID, Date, Type, Patient, Status, BSNR, LANR
   - Status badges should be colored (green for Final, yellow for Preliminary)

#### Interactive Features Tests

1. **Search Functionality**
   - Enter "Max" in the search box
   - Results should filter to show only "Max Mustermann" entries
   - Clear search to see all results again

2. **Status Filter**
   - Select "Final" from status dropdown
   - Should show only results with "Final" status
   - Select "Preliminary" to see preliminary results

3. **Type Filter**
   - Select "Blood Count" from type dropdown
   - Should show only Blood Count results

4. **Refresh Button**
   - Click the "Refresh" button
   - Should reload the data (you might see a brief loading state)

5. **Download Functionality**
   - **Bulk Downloads**: Use the "Download Results" section
     - Click "Download as LDT" - should download .ldt file
     - Click "Download as PDF" - should download .pdf file
   - **Individual Downloads**: Use action buttons in each table row
     - Click "LDT" button for specific result download
     - Click "PDF" button for specific result download
   - Verify downloaded files have correct names and content

6. **Logout**
   - Click "Logout" button in the top right
   - Should return to login page

### 3. Test Responsive Design

1. **Desktop View**
   - Full table should be visible
   - All filters should be in a single row

2. **Mobile View**
   - Resize browser window or use developer tools to simulate mobile
   - Table should be horizontally scrollable
   - Filters should stack vertically
   - Login form should remain centered and readable

### 4. Test Network Handling

1. **Stop Backend Server**
   - Stop the backend server (Ctrl+C in the server terminal)
   - Try to login or refresh results
   - Should see "Network error or server unavailable" message

2. **Restart Backend**
   - Restart backend server
   - Try operations again
   - Should work normally

### 5. Browser Console Tests

Open browser developer tools (F12) and check:

1. **No Console Errors**
   - Should not see any red error messages in console
   - Login and navigation should not produce errors

2. **Network Tab**
   - During login, you should see POST request to `/api/login`
   - During dashboard load, you should see GET request to `/api/results`
   - All requests should return successful status codes (200, 401 for invalid login)

## Expected Behavior Summary

### Login Page
- ✅ Clean, centered login form
- ✅ Form validation (required fields)
- ✅ Proper error messages for invalid credentials
- ✅ Successful authentication redirects to dashboard

### Results Dashboard
- ✅ Professional navigation bar with logout option
- ✅ Three-column filter section
- ✅ Responsive results table with 7 columns
- ✅ Color-coded status badges
- ✅ Real-time search and filtering
- ✅ Refresh functionality
- ✅ Proper error handling

### Technical
- ✅ Backend API responds correctly to all endpoints
- ✅ Frontend makes proper API calls
- ✅ CORS is configured correctly
- ✅ Proxy configuration works for development

## Troubleshooting

If you encounter issues:

1. **"Cannot GET /" error**: Backend server might not be running
2. **"Network error"**: Check if both servers are running on correct ports
3. **Styles not loading**: Ensure Tailwind CSS is properly installed
4. **Blank page**: Check browser console for JavaScript errors

## Performance Testing

1. **Load Testing**
   - The mock data loads instantly
   - Search and filter operations should be near-instantaneous
   - No noticeable lag in UI interactions

2. **Browser Compatibility**
   - Test in Chrome, Firefox, Safari, and Edge
   - All features should work consistently

This testing guide ensures that all features of the Labor Results Web App are functioning correctly and provides a comprehensive verification process for developers and users.