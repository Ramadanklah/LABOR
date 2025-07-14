# Windows Setup Guide for Labor Results Web App

## ✅ **Issue Fixed!**

The error `Der Befehl "vite" ist entweder falsch geschrieben oder` has been resolved by updating the package.json to use `npx vite` instead of just `vite`.

## 🚀 **Quick Start for Windows**

### **Option 1: Use the Windows Batch Script (Easiest)**
```batch
start-dev.bat
```
This will automatically start both servers in separate windows.

### **Option 2: Manual Start**
```batch
REM Terminal 1 - Backend
cd server
npm start

REM Terminal 2 - Frontend  
cd client
npm start
```

## 🔧 **If You Still Have Issues**

### **1. Clean Reinstall**
If you encounter any dependency issues:

```batch
REM Clean the client dependencies
cd client
rmdir /s /q node_modules
del package-lock.json
npm install

REM Clean the server dependencies  
cd ..\server
rmdir /s /q node_modules
del package-lock.json
npm install

REM Start the application
cd ..
start-dev.bat
```

### **2. Use npx Directly**
If npm scripts don't work, you can run commands directly:

```batch
REM Start frontend
cd client
npx vite

REM Start backend (in another terminal)
cd server  
node server.js
```

### **3. Check Node.js Version**
Make sure you have a recent version of Node.js:

```batch
node --version
npm --version
```

**Recommended**: Node.js 18+ and npm 8+

## 📋 **Demo Credentials**

Once the app is running, use these credentials to login:

- **BSNR**: `123456789`
- **LANR**: `1234567`
- **Password**: `securepassword`

## 🌐 **Access URLs**

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000

## 🎯 **What's Fixed**

### **Before (Didn't Work)**
```json
"scripts": {
  "start": "vite"
}
```

### **After (Works)**
```json
"scripts": {
  "start": "npx vite"
}
```

The `npx` prefix ensures that Vite is found and executed correctly on Windows systems.

## 🚨 **Common Windows Issues & Solutions**

### **Issue 1: "vite command not found"**
**Solution**: Already fixed with `npx vite` in package.json

### **Issue 2: Permission Denied**
**Solution**: Run Command Prompt as Administrator

### **Issue 3: Port Already in Use**
**Solution**: 
```batch
REM Kill processes on ports 3000 and 5000
netstat -ano | findstr :3000
netstat -ano | findstr :5000
REM Then kill the process ID with: taskkill /PID <PID> /F
```

### **Issue 4: Node Modules Issues**
**Solution**: Delete `node_modules` and `package-lock.json`, then `npm install`

## 📁 **File Structure Verification**

Your project should look like this:

```
labor-results-app/
├── client/
│   ├── node_modules/    ✅ Should exist after npm install
│   ├── package.json     ✅ Updated with npx commands
│   ├── vite.config.js   ✅ Vite configuration
│   └── src/
├── server/
│   ├── node_modules/    ✅ Should exist after npm install
│   ├── package.json     ✅ Server dependencies
│   └── server.js        ✅ Main server file
├── start-dev.bat        ✅ Windows startup script
└── start-dev.sh         ✅ Linux/Mac startup script
```

## 🎉 **You're All Set!**

The application should now work perfectly on Windows. If you have any other issues, check the main troubleshooting section in [README.md](./README.md).

## 💡 **Pro Tips for Windows Development**

1. **Use Windows Terminal** instead of Command Prompt for better experience
2. **Consider WSL2** (Windows Subsystem for Linux) for a more Linux-like development environment
3. **Use Git Bash** as an alternative terminal that supports Unix-style commands
4. **Install Windows Package Manager** (`winget`) for easier Node.js installation

Your Labor Results Web App is now fully Windows-compatible! 🚀