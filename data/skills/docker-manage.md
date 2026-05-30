---
name: Docker Management
description: Docker container lifecycle management, cleanup, monitoring, and troubleshooting
tags: [ops, docker, containers]
---

Manage Docker containers, images, volumes, and networks efficiently. Use scripts for batch operations.

## Platform Notes

- **Linux**: Docker runs natively. Docker Engine directly manages containers.
- **macOS**: Docker runs via Docker Desktop (Linux VM). Commands are identical but resource stats may differ. Docker socket is typically at `~/.docker/run/docker.sock` or `/var/run/docker.sock`.
- **Windows (WSL2)**: Docker Desktop with WSL2 backend. Commands run inside WSL.

Docker CLI commands are cross-platform — the same `docker` commands work on all OSes.

## Pre-check

Before any Docker operation, verify Docker is available:
```bash
docker info >/dev/null 2>&1 && echo "Docker OK" || echo "Docker not available or not running"
```

## Common Operations

### 1. Container Status Overview (single command is fine)

```bash
echo "=== Running ===" && docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" && echo "" && echo "=== Stopped ===" && docker ps -a --filter "status=exited" --format "table {{.Names}}\t{{.Status}}\t{{.Size}}"
```

### 2. System Cleanup (generate script for safety)

When user asks to clean up Docker resources, generate a script that shows what will be removed and asks for confirmation:

```bash
#!/bin/bash
echo "=== Docker Cleanup Preview ==="
echo ""

# Dangling images
DANGLING=$(docker images -f "dangling=true" -q | wc -l)
echo "Dangling images: $DANGLING"

# Stopped containers
STOPPED=$(docker ps -a --filter "status=exited" -q | wc -l)
echo "Stopped containers: $STOPPED"

# Unused volumes
VOLUMES=$(docker volume ls -f "dangling=true" -q | wc -l)
echo "Unused volumes: $VOLUMES"

# Unused networks
NETWORKS=$(docker network ls --filter "type=custom" -q | wc -l)
echo "Custom networks: $NETWORKS"

# Total reclaimable space
echo ""
echo "Reclaimable space:"
docker system df

echo ""
echo "Proceeding with cleanup..."

# Safe cleanup (no -f flag, keeps named volumes)
docker container prune -f 2>/dev/null
docker image prune -f 2>/dev/null
docker network prune -f 2>/dev/null
# Only prune anonymous volumes
docker volume prune -f 2>/dev/null

echo ""
echo "After cleanup:"
docker system df
echo "=== CLEANUP COMPLETE ==="
```

### 3. Container Logs Analysis (use script)

For analyzing container logs, generate a script:

```bash
#!/bin/bash
CONTAINER="${1:?Usage: $0 <container_name> [lines]}"
LINES="${2:-200}"

echo "=== Logs for: $CONTAINER ==="
echo ""

# Container info
docker inspect --format='Image: {{.Config.Image}} | Created: {{.Created}} | Status: {{.State.Status}}' "$CONTAINER" 2>/dev/null
echo ""

# Recent error logs
echo "--- Recent Errors ---"
docker logs --tail $LINES "$CONTAINER" 2>&1 | grep -i 'error\|exception\|fatal\|critical\|panic' | tail -20
echo ""

# Log volume
TOTAL=$(docker logs --tail $LINES "$CONTAINER" 2>&1 | wc -l)
ERRORS=$(docker logs --tail $LINES "$CONTAINER" 2>&1 | grep -ci 'error\|exception\|fatal')
echo "Last $LINES lines: $ERRORS errors found"
echo ""

# Resource usage
echo "--- Resource Usage ---"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" "$CONTAINER"
echo "=== COMPLETE ==="
```

### 4. Batch Container Operations (always use script)

For operations on multiple containers (restart, update, etc.), generate a script:

```bash
#!/bin/bash
set -e
PATTERN="${1:?Usage: $0 <name_pattern>}"

echo "=== Batch Operation: containers matching '$PATTERN' ==="
CONTAINERS=$(docker ps -a --filter "name=$PATTERN" --format "{{.Names}}")

if [ -z "$CONTAINERS" ]; then
    echo "No containers found matching '$PATTERN'"
    exit 1
fi

for c in $CONTAINERS; do
    STATUS=$(docker inspect --format='{{.State.Status}}' "$c")
    echo "[$c] status=$STATUS"
    # Add your operation here:
    # docker restart "$c"
    # docker stop "$c"
    # docker rm -f "$c"
done

echo "=== BATCH COMPLETE ==="
```

## Workflow

1. **Simple queries** (container list, single container status): use direct commands
2. **Batch operations or analysis**: generate a script to `/tmp/_docker_task.sh`
3. Always show what will be affected before executing destructive operations
4. Clean up temp scripts after execution

## Safety Rules

- Never run `docker system prune -a` without explicit user confirmation (removes ALL unused images)
- Never remove named volumes without listing them first
- For production containers, always check if there are health checks configured before restart
- Show `docker diff` before removing a container to check for data changes
