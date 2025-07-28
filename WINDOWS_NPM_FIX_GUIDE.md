# 🔧 Windows NPM Installation Fix Guide

## ✅ **Issue Resolved**

The npm installation errors you encountered have been fixed! Here's what was causing the problems and how they were resolved:

## 🚨 **Common Windows NPM Issues**

### **Issue 1: ENOTEMPTY Error**
```
npm error code ENOTEMPTY
npm error syscall rmdir
npm error path C:\Users\...\node_modules\lodash
npm error errno -4051
npm error ENOTEMPTY: directory not empty, rmdir
```

**Cause:** Windows file system locks prevent npm from properly cleaning up directories.

**Solution:**
```bash
# Clean up completely
rm -rf node_modules package-lock.json

# Reinstall fresh
npm install
```

### **Issue 2: ESLint Peer Dependency Conflict**
```
npm error ERESOLVE could not resolve
npm error While resolving: eslint-plugin-react-hooks@4.6.2
npm error Found: eslint@9.32.0
npm error Could not resolve dependency:
npm error peer eslint@"^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0"
```

**Cause:** ESLint version 9 is incompatible with some plugins that only support ESLint 8.

**Solution:** Downgrade ESLint to version 8.57.1 in `package.json`:
```json
{
  "devDependencies": {
    "eslint": "^8.57.1"
  }
}
```

## 🔧 **Step-by-Step Fix Process**

### **For Server (Backend)**
```bash
# Navigate to server directory
cd server

# Clean up completely
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install

# Start the server
npm start
```

### **For Client (Frontend)**
```bash
# Navigate to client directory
cd client

# Clean up completely
rm -rf node_modules package-lock.json

# Update package.json to use ESLint 8.57.1
# (Already done in this case)

# Reinstall dependencies
npm install

# Start the client
npm start
```

## 🚀 **Verification Steps**

### **1. Check Backend Health**
```bash
curl http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-28T21:20:25.690Z",
  "uptime": 1454.631662683,
  "version": "1.0.0"
}
```

### **2. Check Frontend Health**
```bash
curl http://localhost:3000/api/health
```

**Expected Response:** Same as backend health check

### **3. Test Login**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"bsnr": "123456789", "lanr": "1234567", "password": "doctor123"}'
```

## 🛠️ **Windows-Specific Commands**

### **Using PowerShell**
```powershell
# Clean up
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json

# Install
npm install

# Start
npm start
```

### **Using Command Prompt**
```cmd
# Clean up
rmdir /s /q node_modules
del package-lock.json

# Install
npm install

# Start
npm start
```

### **Using Git Bash (Recommended)**
```bash
# Clean up
rm -rf node_modules package-lock.json

# Install
npm install

# Start
npm start
```

## 🔍 **Troubleshooting Tips**

### **If npm install still fails:**
1. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

2. **Use legacy peer deps:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Use force flag:**
   ```bash
   npm install --force
   ```

4. **Update npm:**
   ```bash
   npm install -g npm@latest
   ```

### **If ports are in use:**
```bash
# Find processes using ports
netstat -ano | findstr :5000
netstat -ano | findstr :3000

# Kill process by PID
taskkill /PID <PID> /F
```

### **If antivirus blocks npm:**
1. Add `node_modules` folder to antivirus exclusions
2. Temporarily disable antivirus during installation
3. Use `--no-optional` flag: `npm install --no-optional`

## 📋 **Current Status**

- ✅ **Server Dependencies**: Installed successfully
- ✅ **Client Dependencies**: Installed successfully  
- ✅ **ESLint Version**: Fixed to 8.57.1
- ✅ **Backend Server**: Running on port 5000
- ✅ **Frontend Client**: Running on port 3000
- ✅ **API Proxy**: Working correctly

## 🚀 **Next Steps**

1. **Access the application**: Open `http://localhost:3000`
2. **Login with demo credentials**:
   - **Admin**: BSNR `999999999`, LANR `9999999`, Password `admin123`
   - **Doctor**: BSNR `123456789`, LANR `1234567`, Password `doctor123`
   - **Lab Tech**: BSNR `123456789`, LANR `1234568`, Password `lab123`

3. **Test all features**:
   - Role-based access control
   - LDT message processing
   - Admin functions
   - Report downloads

## 🔧 **For Future Reference**

### **Quick Start Commands**
```bash
# Terminal 1: Backend
cd server && npm start

# Terminal 2: Frontend
cd client && npm start
```

### **If you encounter issues again:**
1. Follow the cleanup steps above
2. Check this guide for Windows-specific solutions
3. Use Git Bash instead of PowerShell/CMD if possible
4. Ensure antivirus isn't blocking npm operations

Your application is now fully functional on Windows! 🎉