# 🚀 Quick Fix: Port 5000 Already in Use

## ✅ **SOLUTION 1: Server now auto-finds available port**
**Just restart the server** - it will automatically try ports 5001, 5002, 5003, etc.

## ✅ **SOLUTION 2: Use different port manually**
```cmd
set PORT=3001
npm start
```

## ✅ **SOLUTION 3: Kill the process using port 5000**

### Windows:
```cmd
# Find what's using port 5000
netstat -ano | findstr :5000

# Kill it (replace 1234 with actual PID)
taskkill /PID 1234 /F
```

### Or use our helper script:
```cmd
scripts\check-port.bat
```

## 🎯 **Most likely cause:**
You already have another instance of the server running. Check:
- Other terminal windows
- Task Manager for "node.exe" processes
- "Backend Server" window if you used start-dev.bat

## ⚡ **Quick test:**
After fixing, the server should show:
```
info: Server running on http://localhost:5000
```
(or another port if 5000 was busy)