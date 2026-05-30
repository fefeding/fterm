---
name: Log Analysis
description: Analyze log files for errors, patterns, and anomalies. Cross-platform (Linux/macOS). Supports Nginx, application logs, system logs.
tags: [ops, debug, logs]
---

Analyze log files to find errors, patterns, and anomalies. Use scripts for efficient processing.

## Execution Strategy

**Always use a script** for log analysis. Single commands are insufficient for meaningful analysis.

### Language Selection
- **Python** (preferred): if available, use it for regex parsing, grouping, and statistics
- **Bash + awk/sed/grep**: fallback for systems without Python

## Step 1: Identify Log File

Before analysis, detect the correct log path based on OS:

```bash
OS="$(uname -s)"
# Common log locations by OS
if [ "$OS" = "Linux" ]; then
  echo "=== Available logs ==="
  ls -lh /var/log/syslog /var/log/messages /var/log/auth.log /var/log/nginx/access.log /var/log/nginx/error.log /var/log/kern.log 2>/dev/null
elif [ "$OS" = "Darwin" ]; then
  echo "=== Available logs ==="
  ls -lh /var/log/system.log /var/log/install.log /var/log/apache2/error_log 2>/dev/null
  echo ""
  echo "Note: macOS uses unified logging. For recent system logs use:"
  echo "  log show --last 1h --predicate 'messageType == error' --style compact"
fi
```

**On Windows (PowerShell)**, common log locations:
```powershell
# Windows Event Logs (use Get-WinEvent instead of file-based analysis)
Get-WinEvent -ListLog * -ErrorAction SilentlyContinue | Where-Object RecordCount -gt 0 | Select-Object LogName, RecordCount | Format-Table

# IIS logs
Get-ChildItem C:\inetpub\logs\LogFiles\*\*.log -ErrorAction SilentlyContinue

# Application logs (check common paths)
Get-ChildItem C:\logs\*.log, "$env:LOCALAPPDATA\Temp\*.log" -ErrorAction SilentlyContinue
```

For Windows Event Logs, use `Get-WinEvent` directly instead of file-based analysis:
```powershell
Get-WinEvent -FilterHashtable @{LogName='System'; Level=2; StartTime=(Get-Date).AddHours(-1)} -MaxEvents 100
```

Ask the user for the specific log file path, or use the detected paths above.

## Step 2: Analysis Script (Python)

Generate to `/tmp/_log_analyze.py`. This script is cross-platform — it only needs Python 3 and a valid log file path:

```python
#!/usr/bin/env python3
import sys, re, os
from collections import Counter, defaultdict

log_file = sys.argv[1] if len(sys.argv) > 1 else None
max_lines = int(sys.argv[2]) if len(sys.argv) > 2 else 5000

if not log_file:
    print("Usage: python3 _log_analyze.py <logfile> [max_lines]")
    sys.exit(1)

if not os.path.exists(log_file):
    print(f"Error: {log_file} not found")
    sys.exit(1)

# Read last N lines (memory efficient)
with open(log_file, 'r', errors='ignore') as f:
    all_lines = f.readlines()
    lines = all_lines[-max_lines:] if len(all_lines) > max_lines else all_lines

total = len(lines)
file_total = len(all_lines)
print(f"File: {log_file}")
print(f"Total lines: {file_total}, analyzing last: {total}")
print(f"File size: {os.path.getsize(log_file) / 1024 / 1024:.1f} MB")
print()

# 1. Error/Warn/Info counts
level_counts = Counter()
error_pattern = re.compile(r'\b(error|err|critical|fatal|crit|alert|emerg|panic)\b', re.I)
warn_pattern = re.compile(r'\b(warn|warning)\b', re.I)

error_lines = []
for line in lines:
    if error_pattern.search(line):
        level_counts['ERROR'] += 1
        if len(error_lines) < 20:
            error_lines.append(line.strip()[:200])
    elif warn_pattern.search(line):
        level_counts['WARN'] += 1
    else:
        level_counts['INFO'] += 1

print("--- Log Level Distribution ---")
for level, count in level_counts.most_common():
    pct = count / total * 100 if total > 0 else 0
    print(f"  {level}: {count} ({pct:.1f}%)")
print()

# 2. Recent errors
if error_lines:
    print(f"--- Recent Errors (up to 20) ---")
    for line in error_lines:
        print(f"  {line}")
    print()

# 3. Top error messages (deduplicated)
error_msgs = Counter()
for line in lines:
    if error_pattern.search(line):
        msg = re.sub(r'^[\d\-\s:./T]+', '', line.strip())
        msg = re.sub(r'\d+', 'N', msg)
        error_msgs[msg[:120]] += 1

if error_msgs:
    print("--- Top Error Patterns ---")
    for msg, count in error_msgs.most_common(10):
        print(f"  [{count}x] {msg}")
    print()

# 4. IP addresses (for access logs)
ip_counts = Counter()
for line in lines:
    ips = re.findall(r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b', line)
    for ip in ips:
        if not ip.startswith('127.') and not ip.startswith('0.'):
            ip_counts[ip] += 1

if ip_counts:
    print("--- Top IP Addresses ---")
    for ip, count in ip_counts.most_common(10):
        print(f"  {ip}: {count} requests")
    print()

# 5. HTTP status codes (for web logs)
status_counts = Counter()
for line in lines:
    m = re.search(r'"\s+(\d{3})\s+', line) or re.search(r'status[=:]\s*(\d{3})', line, re.I)
    if m:
        status_counts[m.group(1)] += 1

if status_counts:
    print("--- HTTP Status Codes ---")
    for code, count in sorted(status_counts.items()):
        print(f"  {code}: {count}")
    print()

# 6. Time distribution (errors per hour)
hour_errors = defaultdict(int)
for line in lines:
    if error_pattern.search(line):
        m = re.search(r'(\d{2}):\d{2}:\d{2}', line)
        if m:
            hour_errors[m.group(1)] += 1

if hour_errors:
    print("--- Error Distribution by Hour ---")
    for hour in sorted(hour_errors.keys()):
        bar = '#' * min(hour_errors[hour], 50)
        print(f"  {hour}:00  {hour_errors[hour]:4d} {bar}")
    print()

# 7. macOS unified log format support
# Detect if this is macOS log show output (format: "2024-01-15 10:30:00.123 ...")
mac_log_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+\S+\s+(\S+)\s+\[(\S+)\]')
subsystem_counts = Counter()
for line in lines:
    m = mac_log_pattern.match(line)
    if m:
        subsystem_counts[m.group(1)] += 1

if subsystem_counts:
    print("--- Top Subsystems (macOS) ---")
    for sub, count in subsystem_counts.most_common(10):
        print(f"  {sub}: {count}")
    print()

print("===== ANALYSIS COMPLETE =====")
```

## Step 3: Execution

```bash
cat > /tmp/_log_analyze.py << 'SCRIPT_EOF'
... (script content) ...
SCRIPT_EOF
python3 /tmp/_log_analyze.py /path/to/logfile 5000
```

Set timeout to 15000ms for large files.

## Fallback: Bash-only Analysis (Cross-Platform)

If Python is not available, use this cross-platform bash script:

```bash
#!/bin/bash
LOG="${1:?Usage: $0 <logfile> [lines]}"
N="${2:-5000}"

if [ ! -f "$LOG" ]; then
  echo "Error: $LOG not found"
  exit 1
fi

echo "=== Analyzing last $N lines of $LOG ==="
TOTAL=$(wc -l < "$LOG" | tr -d ' ')
echo "File total lines: $TOTAL"
echo ""

echo "--- Error/Warning counts ---"
tail -n $N "$LOG" | grep -ci 'error\|err\|critical\|fatal\|panic' | xargs -I{} echo "Errors: {}"
tail -n $N "$LOG" | grep -ci 'warn' | xargs -I{} echo "Warnings: {}"
echo ""

echo "--- Top error messages ---"
tail -n $N "$LOG" | grep -i 'error\|err\|critical\|fatal\|panic' | \
  sed 's/^[0-9 :-]*//' | sort | uniq -c | sort -rn | head -10
echo ""

echo "--- Top IPs ---"
tail -n $N "$LOG" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | \
  grep -v '^127\.' | sort | uniq -c | sort -rn | head -10
echo ""

echo "=== ANALYSIS COMPLETE ==="
```

## macOS Unified Logging

For macOS system logs that use the unified logging system (not plain text files), use:

```bash
# Recent errors (last 1 hour)
log show --last 1h --predicate 'messageType == error' --style compact 2>/dev/null | tail -50

# Export to file for analysis
log show --last 1h --predicate 'messageType == error' --style compact > /tmp/_macos_errors.log 2>/dev/null
# Then analyze /tmp/_macos_errors.log with the Python script above
```

## Cleanup

After analysis: `rm -f /tmp/_log_analyze.py /tmp/_log_analyze.sh /tmp/_macos_errors.log`
