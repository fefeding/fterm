---
name: Server Health Check
description: Comprehensive server health check - CPU, memory, disk, network, processes, services. Cross-platform (Linux/macOS).
tags: [ops, monitoring, health]
---

Perform a comprehensive server health check. Generate a single script to collect all metrics at once.

## Execution Strategy

Use a **bash script** with OS detection to collect all health metrics in one pass. The script must adapt to the target OS (Linux vs macOS vs Windows).

**On Windows (PowerShell)**, use this script instead:

```powershell
$ErrorActionPreference = 'Continue'
Write-Output "===== SERVER HEALTH CHECK ====="
Write-Output "OS: $((Get-CimInstance Win32_OperatingSystem).Caption)"
Write-Output "Hostname: $env:COMPUTERNAME"
Write-Output "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output ""

# System Load
Write-Output "--- System Load ---"
$cpu = Get-CimInstance Win32_Processor
Write-Output "CPU Usage: $($cpu.LoadPercentage)%"
Write-Output "Cores: $($cpu.NumberOfLogicalProcessors)"
Write-Output ""

# Memory
Write-Output "--- Memory ---"
$os = Get-CimInstance Win32_OperatingSystem
$totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
$usedGB = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 1)
Write-Output "Total: ${totalGB}GB, Used: ${usedGB}GB, Free: ${freeGB}GB"
Write-Output ""

# Disk
Write-Output "--- Disk Usage ---"
Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
  $totalGB = [math]::Round($_.Size / 1GB, 1)
  $freeGB = [math]::Round($_.FreeSpace / 1GB, 1)
  $usedPct = [math]::Round(($_.Size - $_.FreeSpace) / $_.Size * 100, 1)
  Write-Output "$($_.DeviceID) Total: ${totalGB}GB, Free: ${freeGB}GB, Used: ${usedPct}%"
}
Write-Output ""

# Network
Write-Output "--- Network ---"
Get-NetTCPConnection -State Listen 2>$null | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table
Write-Output ""

# Processes
Write-Output "--- Top Processes by Memory ---"
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 5 Name, @{N='Mem(MB)';E={[math]::Round($_.WorkingSet64/1MB,1)}}, CPU | Format-Table
Write-Output ""

# Services
Write-Output "--- Failed/Stopped Services ---"
Get-Service | Where-Object { $_.StartType -eq 'Automatic' -and $_.Status -ne 'Running' } | Select-Object Name, Status, StartType | Format-Table
Write-Output ""

# Event Log Errors
Write-Output "--- Recent Errors ---"
Get-WinEvent -FilterHashtable @{LogName='System'; Level=2; StartTime=(Get-Date).AddHours(-1)} -MaxEvents 20 2>$null | Select-Object TimeCreated, Id, Message | Format-List
Write-Output ""

# Docker
if (Get-Command docker -ErrorAction SilentlyContinue) {
  Write-Output "--- Docker ---"
  Write-Output "Running: $((docker ps -q) | Measure-Object | Select -Expand Count)"
  docker system df
}
Write-Output "===== CHECK COMPLETE ====="
```

## Unix/macOS/Linux Script

Generate to `/tmp/_health_check.sh`:

```bash
#!/bin/bash

OS="$(uname -s)"
echo "===== SERVER HEALTH CHECK ====="
echo "OS: $OS $(uname -r)"
echo "Hostname: $(hostname)"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. System Load
echo "--- System Load ---"
uptime
if [ "$OS" = "Linux" ]; then
  echo "Load detail: $(cat /proc/loadavg 2>/dev/null)"
elif [ "$OS" = "Darwin" ]; then
  echo "Load detail: $(sysctl -n vm.loadavg 2>/dev/null)"
fi
echo ""

# 2. CPU Info
echo "--- CPU ---"
if [ "$OS" = "Linux" ]; then
  echo "Cores: $(nproc 2>/dev/null)"
  echo "Model: $(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs)"
  echo "Top 5 by CPU:"
  ps aux --sort=-%cpu 2>/dev/null | head -6
elif [ "$OS" = "Darwin" ]; then
  echo "Cores: $(sysctl -n hw.ncpu 2>/dev/null)"
  echo "Model: $(sysctl -n machdep.cpu.brand_string 2>/dev/null)"
  echo "Top 5 by CPU:"
  ps aux -r 2>/dev/null | head -6
fi
echo ""

# 3. Memory
echo "--- Memory ---"
if [ "$OS" = "Linux" ]; then
  free -h 2>/dev/null
elif [ "$OS" = "Darwin" ]; then
  TOTAL=$(sysctl -n hw.memsize 2>/dev/null)
  TOTAL_GB=$(echo "scale=1; $TOTAL/1024/1024/1024" | bc 2>/dev/null || echo "unknown")
  echo "Total: ${TOTAL_GB}GB"
  echo "Page size: $(sysctl -n hw.pagesize 2>/dev/null) bytes"
  vm_stat 2>/dev/null
  echo ""
  echo "Memory pressure:"
  memory_pressure 2>/dev/null | head -5
fi
echo ""

# 4. Disk Usage
echo "--- Disk Usage ---"
if [ "$OS" = "Linux" ]; then
  df -h --type=ext4 --type=xfs --type=btrfs --type=overlay --type=tmpfs 2>/dev/null || df -h
elif [ "$OS" = "Darwin" ]; then
  df -h | grep -E '^/|Filesystem'
fi
echo ""
echo "Inode usage (if any >80%):"
if [ "$OS" = "Linux" ]; then
  df -i 2>/dev/null | awk 'NR==1 || $5+0 > 80'
else
  df -i 2>/dev/null | awk 'NR==1 || $8+0 > 80'
fi
echo ""

# 5. Top Disk Consumers
echo "--- Largest directories in / ---"
if [ "$OS" = "Darwin" ]; then
  du -sh /* 2>/dev/null | sort -rh | head -10
else
  du -sh /* --max-depth=0 2>/dev/null | sort -rh | head -10
fi
echo ""

# 6. Network
echo "--- Network ---"
if [ "$OS" = "Linux" ]; then
  echo "Connections summary:"
  ss -s 2>/dev/null || cat /proc/net/sockstat 2>/dev/null
  echo ""
  echo "Listening ports:"
  ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null
elif [ "$OS" = "Darwin" ]; then
  echo "Listening ports:"
  lsof -i -P -n 2>/dev/null | grep LISTEN | head -20 || netstat -an | grep LISTEN
  echo ""
  echo "Network interfaces:"
  ifconfig 2>/dev/null | grep -E '^[a-z]|inet ' | head -20
fi
echo ""

# 7. Process Health
echo "--- Processes ---"
echo "Total: $(ps aux | wc -l)"
if [ "$OS" = "Linux" ]; then
  echo "Zombie: $(ps aux | awk '$8 ~ /Z/ {count++} END {print count+0}')"
  echo "Top 5 by memory:"
  ps aux --sort=-%mem | head -6
elif [ "$OS" = "Darwin" ]; then
  echo "Zombie: $(ps aux | awk '$8 ~ /Z/ {count++} END {print count+0}')"
  echo "Top 5 by memory:"
  ps aux -m | head -6
fi
echo ""

# 8. Recent System Errors
echo "--- Recent System Errors ---"
if [ "$OS" = "Linux" ]; then
  if command -v journalctl &>/dev/null; then
    journalctl -p err --no-pager -n 20 --since "1 hour ago" 2>/dev/null
  else
    dmesg -T 2>/dev/null | grep -i 'error\|fail\|warn' | tail -20 || dmesg 2>/dev/null | tail -20
  fi
elif [ "$OS" = "Darwin" ]; then
  log show --last 1h --predicate 'messageType == error' --style compact 2>/dev/null | tail -20 || \
    echo "(log command not available)"
fi
echo ""

# 9. Services
echo "--- Services ---"
if [ "$OS" = "Linux" ]; then
  if command -v systemctl &>/dev/null; then
    echo "Failed services:"
    systemctl --failed --no-pager 2>/dev/null
  else
    echo "(no systemd)"
  fi
elif [ "$OS" = "Darwin" ]; then
  echo "LaunchDaemons (loaded):"
  launchctl list 2>/dev/null | wc -l
  echo "Unresponsive agents:"
  launchctl list 2>/dev/null | awk '$1 == "-" && $2 != "0" {print}' | head -10
fi
echo ""

# 10. Security
echo "--- Security ---"
echo "Currently logged in:"
who 2>/dev/null
echo ""
if [ "$OS" = "Linux" ]; then
  echo "Failed login attempts:"
  lastb 2>/dev/null | head -10 || echo "(no lastb data)"
elif [ "$OS" = "Darwin" ]; then
  echo "Recent logins:"
  last -10 2>/dev/null
fi
echo ""

# 11. Docker (if available)
if command -v docker &>/dev/null; then
  echo "--- Docker ---"
  echo "Running containers: $(docker ps -q 2>/dev/null | wc -l)"
  docker system df 2>/dev/null
  echo ""
fi

echo "===== CHECK COMPLETE ====="
```

## Workflow

1. Create the script: `cat > /tmp/_health_check.sh << 'SCRIPT_EOF' ... SCRIPT_EOF`
2. Execute: `chmod +x /tmp/_health_check.sh && bash /tmp/_health_check.sh` (set timeout to 15000ms)
3. Parse the output and summarize findings
4. Clean up: `rm -f /tmp/_health_check.sh`

## Analysis Guidelines

After collecting the data, highlight:
- **Critical**: disk >90%, memory >90%, load > CPU cores, zombie processes, failed services
- **Warning**: disk >80%, memory >80%, high number of connections
- **Info**: general health status, uptime, any anomalies
