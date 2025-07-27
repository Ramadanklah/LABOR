@echo off
echo Checking for processes using port 5000...
echo.

netstat -ano | findstr :5000
if %errorlevel% equ 0 (
    echo.
    echo Found process(es) using port 5000.
    echo To kill a process, use: taskkill /PID ^<PID^> /F
    echo.
    echo Would you like to kill all processes using port 5000? (y/n)
    set /p answer=
    if /i "%answer%"=="y" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
            echo Killing process %%a...
            taskkill /PID %%a /F
        )
        echo Done!
    )
) else (
    echo No processes found using port 5000.
)

echo.
pause