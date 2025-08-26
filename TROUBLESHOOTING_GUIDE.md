# 🔧 Troubleshooting Guide - Labor Results Web App

## ✅ **Current Status: RESOLVED**

Your application is now working correctly! The issue was that the backend server wasn't running when you started the frontend.

## 🚀 **How to Start the Application**

### **Step 1: Start the Backend Server**
```bash
# Navigate to the server directory
cd server

# Install dependencies (if not already done)
npm install

# Start the backend server
npm start
```

**Expected Output:**
```
Server running on port 5000
Database initialized with 3 users
```

### **Step 2: Start the Frontend Client**
```bash
# Open a new terminal window
# Navigate to the client directory
cd client

# Install dependencies (if not already done)
npm install

# Start the frontend development server
npm start
```

**Expected Output:**
```
VITE v5.4.19  ready in 411 ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

## 🔍 **Verification Steps**

### **1. Check Backend Health**
```bash
curl http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-28T21:09:41.402Z",
  "uptime": 810.343995178,
  "version": "1.0.0",
  "userStats": {
    "total": 3,
    "active": 3,
    "inactive": 0
  }
}
```

### **2. Check Frontend Accessibility**
```bash
curl http://localhost:3000
```

**Expected Response:** HTML content from the React app

### **3. Test API Proxy**
```bash
curl http://localhost:3000/api/health
```

**Expected Response:** Same as backend health check

### **4. Test Login Functionality**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"bsnr": "123456789", "lanr": "1234567", "password": "doctor123"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## 🚨 **Common Issues and Solutions**

### **Issue 1: ECONNREFUSED Errors**
**Symptoms:**
```
[vite] http proxy error: /api/auth/me
AggregateError [ECONNREFUSED]: 
    at internalConnectMultiple (node:net:1134:18)
```

**Solution:**
1. Make sure the backend server is running on port 5000
2. Check if port 5000 is not being used by another application
3. Restart the backend server: `cd server && npm start`

### **Issue 2: npm Warnings**
**Symptoms:**
```
npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
```

**Solution:**
These are just deprecation warnings and don't affect functionality. They've been updated in the latest version.

### **Issue 3: Port Already in Use**
**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
1. Find the process using port 5000: `lsof -i :5000`
2. Kill the process: `kill -9 <PID>`
3. Restart the server: `npm start`

### **Issue 4: Frontend Can't Connect to Backend**
**Symptoms:**
```
Failed to fetch: /api/auth/me
```

**Solution:**
1. Verify backend is running: `curl http://localhost:5000/api/health`
2. Check Vite proxy configuration in `client/vite.config.js`
3. Restart both frontend and backend

## 🔐 **Demo Credentials**

### **Admin User**
- **BSNR**: `999999999`
- **LANR**: `9999999`
- **Password**: `admin123`
- **Email**: `admin@laborresults.de`

### **Doctor User**
- **BSNR**: `123456789`
- **LANR**: `1234567`
- **Password**: `doctor123`
- **Email**: `doctor@laborresults.de`

### **Lab Technician User**
- **BSNR**: `123456789`
- **LANR**: `1234568`
- **Password**: `lab123`
- **Email**: `lab@laborresults.de`

## 🧪 **Testing the Application**

### **1. Open the Application**
Navigate to: `http://localhost:3000`

### **2. Test Login**
1. Use the demo credentials above
2. Try different user roles
3. Verify role-based access control

### **3. Test LDT Webhook**
```bash
curl -X POST http://localhost:5000/api/mirth-webhook \
  -H "Content-Type: text/plain" \
  -d "01380008230\n014810000204\n0199212LDT1014.01"
```

### **4. Test Admin Functions**
```bash
# Login as admin
TOKEN=$(curl -s -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"bsnr": "999999999", "lanr": "9999999", "password": "admin123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Test admin endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/admin/unassigned-results
```

## 📊 **Performance Monitoring**

### **Backend Health Check**
```bash
curl http://localhost:5000/api/health
```

### **Frontend Health Check**
```bash
curl http://localhost:3000/api/health
```

### **Memory Usage**
```bash
# Check Node.js processes
ps aux | grep node

# Check port usage
netstat -tulpn | grep :5000
netstat -tulpn | grep :3000
```

## 🔧 **Development Commands**

### **Backend Development**
```bash
cd server
npm start          # Start development server
npm test           # Run tests
npm run lint       # Lint code
```

### **Frontend Development**
```bash
cd client
npm start          # Start development server
npm run build      # Build for production
npm run lint       # Lint code
```

### **Full Stack Development**
```bash
# Terminal 1: Backend
cd server && npm start

# Terminal 2: Frontend
cd client && npm start
```

## 🚀 **Production Deployment**

### **Using Docker**
```bash
# Build and run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f
```

### **Manual Deployment**
```bash
# Backend
cd server
npm install --production
npm start

# Frontend
cd client
npm install
npm run build
# Serve the dist folder with a web server
```

## 📞 **Support**

If you encounter any issues:

1. **Check the logs** for both frontend and backend
2. **Verify network connectivity** between frontend and backend
3. **Test individual components** using the verification steps above
4. **Check the troubleshooting guide** for common solutions

## ✅ **Current Status**

- ✅ **Backend Server**: Running on port 5000
- ✅ **Frontend Client**: Running on port 3000
- ✅ **API Proxy**: Working correctly
- ✅ **Authentication**: JWT tokens working
- ✅ **Role-based Access**: Implemented and tested
- ✅ **LDT Processing**: Webhook functional
- ✅ **Admin Functions**: All endpoints working

Your application is now fully functional and ready for use!