# Port Conflict Troubleshooting Guide

## Problem: "Error: listen EADDRINUSE: address already in use :::5000"

This error occurs when another process is already using port 5000.

## ✅ Quick Solutions

### 1. **Automatic Port Selection (Recommended)**
The server now automatically tries alternative ports (5001, 5002, etc.) when 5000 is busy.
Simply restart the server and it will find an available port.

### 2. **Use a Different Port Manually**

**Windows Command Prompt:**
```cmd
set PORT=3001
npm start
```

**Windows PowerShell:**
```powershell
$env:PORT=3001
npm start
```

**Linux/Mac:**
```bash
PORT=3001 npm start
```

### 3. **Find and Kill the Process Using Port 5000**

**Windows - Use our helper scripts:**
```cmd
# Option A: Run the batch script
scripts\check-port.bat

# Option B: Run the PowerShell script  
powershell -ExecutionPolicy Bypass -File scripts\check-port.ps1
```

**Windows - Manual commands:**
```cmd
# Find the process
netstat -ano | findstr :5000

# Kill the process (replace <PID> with actual PID)
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Find the process
lsof -i :5000
# or
ss -tulpn | grep :5000

# Kill the process (replace <PID> with actual PID)
kill -9 <PID>
```

## 🔍 Common Causes

1. **Another instance of the server is running**
   - Check if you already have the server running in another terminal
   - Look for "Backend Server" window if using start-dev.bat

2. **Another application using port 5000**
   - Some applications default to port 5000 (Flask, .NET Core, etc.)
   - Check your running applications

3. **Previous server didn't shut down properly**
   - The process might still be running in the background
   - Use the kill commands above to clean up

## 🛠️ Prevention Tips

1. **Always stop servers properly:**
   - Use Ctrl+C in the terminal
   - Close terminal windows running servers
   - Don't just close the terminal without stopping the process

2. **Use different ports for different projects:**
   - Set PORT environment variable
   - Update your .env file

3. **Check running processes before starting:**
   - Run our check-port scripts
   - Use task manager to see running processes

## 🚀 Server Features

The server now includes:
- ✅ Automatic port conflict detection
- ✅ Auto-retry on ports 5001, 5002, 5003
- ✅ Clear error messages with solutions
- ✅ Graceful fallback handling

## 📞 Still Having Issues?

If the problem persists:
1. Restart your computer (clears all processes)
2. Check Windows Firewall/antivirus settings
3. Try running as administrator
4. Use a completely different port range (e.g., PORT=8000)