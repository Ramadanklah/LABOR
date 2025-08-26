# PowerShell script to check and manage port 5000 usage
Write-Host "Checking for processes using port 5000..." -ForegroundColor Yellow
Write-Host ""

# Get processes using port 5000
$processes = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue

if ($processes) {
    Write-Host "Found process(es) using port 5000:" -ForegroundColor Red
    Write-Host ""
    
    foreach ($proc in $processes) {
        $processInfo = Get-Process -Id $proc.OwningProcess -ErrorAction SilentlyContinue
        if ($processInfo) {
            Write-Host "PID: $($proc.OwningProcess) - Process: $($processInfo.ProcessName) - State: $($proc.State)" -ForegroundColor White
        }
    }
    
    Write-Host ""
    $response = Read-Host "Would you like to kill these processes? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        foreach ($proc in $processes) {
            try {
                Stop-Process -Id $proc.OwningProcess -Force
                Write-Host "Killed process $($proc.OwningProcess)" -ForegroundColor Green
            }
            catch {
                Write-Host "Failed to kill process $($proc.OwningProcess): $($_.Exception.Message)" -ForegroundColor Red
            }
        }
        Write-Host "Done!" -ForegroundColor Green
    }
} else {
    Write-Host "No processes found using port 5000." -ForegroundColor Green
}

Write-Host ""
Write-Host "Alternative solutions:" -ForegroundColor Cyan
Write-Host "1. Use a different port: set PORT=3001 && npm start" -ForegroundColor White
Write-Host "2. Or in PowerShell: `$env:PORT=3001; npm start" -ForegroundColor White
Write-Host "3. Check if another instance of the server is running" -ForegroundColor White

Read-Host "Press Enter to continue"