param(
    [int]$UserPort = 8001,
    [int]$EventPort = 8002,
    [int]$TicketPort = 8003,
    [int]$AttendeePort = 8005
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root "venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Error "Python venv not found at $python"
    exit 1
}

function Get-ListeningProcessId {
    param(
        [int]$Port
    )

    $line = netstat -ano -p TCP |
        Select-String -Pattern "LISTENING" |
        Where-Object { $_.Line -match "(^|\s|\])\S*:$Port\s+" } |
        Select-Object -First 1

    if ($line) {
        $parts = ($line.Line.Trim() -split "\s+")
        if ($parts.Length -ge 5) {
            return $parts[-1]
        }
    }
    return $null
}

function Get-RecentLogLines {
    param(
        [string]$Path,
        [int]$Lines = 20
    )

    if (-not (Test-Path $Path)) {
        return @()
    }

    return @(Get-Content -Path $Path | Select-Object -Last $Lines)
}

function Start-ServiceIfNeeded {
    param(
        [int]$Port,
        [string[]]$ArgList,
        [string]$Name
    )

    $existingPid = Get-ListeningProcessId -Port $Port
    if ($existingPid) {
        Write-Host "$Name already listening on port $Port (PID $existingPid)"
        return [pscustomobject]@{
            Name = $Name
            Port = $Port
            Pid = $existingPid
            Status = "listening"
            OutLog = $null
            ErrLog = $null
            Message = ""
        }
    }

    $logPrefix = ($Name -replace "-", "_")
    $outLog = Join-Path $root "$logPrefix.start.log"
    $errLog = Join-Path $root "$logPrefix.start.err"
    Remove-Item -LiteralPath $outLog -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $errLog -ErrorAction SilentlyContinue

    $proc = Start-Process -FilePath $python `
        -ArgumentList $ArgList `
        -WorkingDirectory $root `
        -WindowStyle Hidden `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog `
        -PassThru

    $deadline = (Get-Date).AddSeconds(12)
    do {
        Start-Sleep -Milliseconds 500
        $listeningPid = Get-ListeningProcessId -Port $Port
        if ($listeningPid) {
            Write-Host "$Name listening on port $Port (PID $listeningPid)"
            return [pscustomobject]@{
                Name = $Name
                Port = $Port
                Pid = $listeningPid
                Status = "listening"
                OutLog = $outLog
                ErrLog = $errLog
                Message = ""
            }
        }

        $running = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
    } while ($running -and (Get-Date) -lt $deadline)

    $logTail = Get-RecentLogLines -Path $errLog
    if (-not $logTail) {
        $logTail = Get-RecentLogLines -Path $outLog
    }
    $message = if ($logTail) {
        $logTail -join [Environment]::NewLine
    } else {
        "No startup output was captured. Check $outLog and $errLog."
    }

    Write-Warning "$Name failed to start on port $Port."
    Write-Host $message

    return [pscustomobject]@{
        Name = $Name
        Port = $Port
        Pid = $null
        Status = "failed"
        OutLog = $outLog
        ErrLog = $errLog
        Message = $message
    }
}

$results = @(
    Start-ServiceIfNeeded -Port $UserPort -ArgList @('-m','uvicorn','user_service.main:app','--host','127.0.0.1','--port',"$UserPort") -Name "user-service"
    Start-ServiceIfNeeded -Port $EventPort -ArgList @('-m','uvicorn','event_service.main:app','--host','127.0.0.1','--port',"$EventPort") -Name "event-service"
    Start-ServiceIfNeeded -Port $TicketPort -ArgList @('-m','uvicorn','ticket_service.main:app','--host','127.0.0.1','--port',"$TicketPort") -Name "ticket-service"
    Start-ServiceIfNeeded -Port $AttendeePort -ArgList @('-m','uvicorn','attendee_service.main:app','--host','127.0.0.1','--port',"$AttendeePort") -Name "attendee-service"
)

foreach ($result in $results) {
    if ($result.Status -eq "listening") {
        Write-Host "$($result.Name) PID: $($result.Pid)"
    } else {
        Write-Warning "$($result.Name) did not start. Logs: $($result.OutLog), $($result.ErrLog)"
    }
}

$failed = $results | Where-Object { $_.Status -ne "listening" }
if ($failed) {
    $failedNames = ($failed | ForEach-Object { $_.Name }) -join ", "
    Write-Error "Failed to start: $failedNames"
    exit 1
}
