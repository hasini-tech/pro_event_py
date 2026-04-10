$ports = 8001,8101,8002,8003,8005
$connections = foreach ($p in $ports) {
    Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
}

$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ }

if (-not $pids) {
    Write-Host "No uvicorn processes found on ports $($ports -join ', ')."
    exit 0
}

Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue
Write-Host "Stopped processes: $($pids -join ', ')"
