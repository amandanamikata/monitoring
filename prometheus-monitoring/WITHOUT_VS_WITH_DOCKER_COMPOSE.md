# Without Docker Compose vs With Docker Compose

This document shows exactly what you'd need to do manually without Docker Compose, compared to using Docker Compose. This clearly demonstrates why Docker Compose is essential.

**Important**: If you get "permission denied" errors when running Docker commands below, you need to fix Docker permissions first. See [QUICK_START.md Step 0](QUICK_START.md#0-fix-docker-permissions-first-time-setup) or [README.md Troubleshooting](README.md#docker-permission-issues).

---

## Starting the Full Monitoring Stack

### ❌ WITHOUT Docker Compose (Manual Commands)

You would need to execute **ALL** of these commands **IN ORDER**:

```bash
# ==============================================================================
# STEP 1: CREATE NETWORK
# ==============================================================================
# Containers need to communicate, so create a network first
docker network create monitoring-network

# Verify it was created
docker network ls | grep monitoring

# ==============================================================================
# STEP 2: CREATE VOLUMES
# ==============================================================================
# Need volumes for data persistence
docker volume create postgres-data
docker volume create prometheus-data
docker volume create grafana-data

# Verify volumes
docker volume ls

# ==============================================================================
# STEP 3: START POSTGRESQL
# ==============================================================================
# Start database first (others depend on it)
docker run -d \
  --name postgres-db \
  --network monitoring-network \
  --restart unless-stopped \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -v postgres-data:/var/lib/postgresql/data \
  -v "$(pwd)/postgres-exporter/init.sql:/docker-entrypoint-initdb.d/init.sql" \
  --health-cmd "pg_isready -U postgres" \
  --health-interval 10s \
  --health-timeout 5s \
  --health-retries 5 \
  postgres:15-alpine

# Check if it started
docker ps | grep postgres-db

# Check logs for errors
docker logs postgres-db

# ==============================================================================
# STEP 4: WAIT FOR POSTGRES TO BE HEALTHY
# ==============================================================================
# Need to manually wait for postgres to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 15

# Check if it's actually ready (need to keep checking)
docker exec postgres-db pg_isready -U postgres
# If this fails, wait more and try again

# ==============================================================================
# STEP 5: START POSTGRES EXPORTER
# ==============================================================================
docker run -d \
  --name postgres-exporter \
  --network monitoring-network \
  --restart unless-stopped \
  -p 9187:9187 \
  -e DATA_SOURCE_NAME="postgresql://postgres_exporter:exporter_password@postgres-db:5432/enterprise_db?sslmode=disable" \
  -v "$(pwd)/postgres-exporter/queries.yaml:/etc/postgres-exporter/queries.yaml:ro" \
  prometheuscommunity/postgres-exporter:latest

# Check if it started
docker ps | grep postgres-exporter

# Check logs
docker logs postgres-exporter

# ==============================================================================
# STEP 6: BUILD APPLICATION IMAGE
# ==============================================================================
# Need to manually build our app
cd app-service
docker build -t enterprise-app:latest .
cd ..

# Verify image was created
docker images | grep enterprise-app

# ==============================================================================
# STEP 7: START APPLICATION
# ==============================================================================
docker run -d \
  --name enterprise-app \
  --network monitoring-network \
  --restart unless-stopped \
  -p 3000:3000 \
  --health-cmd "wget --quiet --tries=1 --spider http://localhost:3000/health" \
  --health-interval 30s \
  --health-timeout 10s \
  --health-retries 3 \
  --health-start-period 40s \
  enterprise-app:latest

# Check if it started
docker ps | grep enterprise-app

# Check logs
docker logs enterprise-app

# ==============================================================================
# STEP 8: START PROMETHEUS
# ==============================================================================
docker run -d \
  --name prometheus \
  --network monitoring-network \
  --restart unless-stopped \
  -p 9090:9090 \
  -v "$(pwd)/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
  -v "$(pwd)/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro" \
  -v prometheus-data:/prometheus \
  prom/prometheus:latest \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --web.console.libraries=/etc/prometheus/console_libraries \
  --web.console.templates=/etc/prometheus/consoles \
  --storage.tsdb.retention.time=30d \
  --web.enable-lifecycle

# Check if it started
docker ps | grep prometheus

# Check logs
docker logs prometheus

# ==============================================================================
# STEP 9: START GRAFANA
# ==============================================================================
docker run -d \
  --name grafana \
  --network monitoring-network \
  --restart unless-stopped \
  -p 3001:3000 \
  -e GF_SECURITY_ADMIN_USER=admin \
  -e GF_SECURITY_ADMIN_PASSWORD=admin \
  -e GF_USERS_ALLOW_SIGN_UP=false \
  -e GF_SERVER_ROOT_URL=http://localhost:3001 \
  -e GF_INSTALL_PLUGINS='' \
  -v grafana-data:/var/lib/grafana \
  -v "$(pwd)/grafana/datasources:/etc/grafana/provisioning/datasources:ro" \
  -v "$(pwd)/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro" \
  grafana/grafana:latest

# Check if it started
docker ps | grep grafana

# Check logs
docker logs grafana

# ==============================================================================
# STEP 10: VERIFY EVERYTHING IS RUNNING
# ==============================================================================
docker ps

# Should see 5 containers running:
# - postgres-db
# - postgres-exporter
# - enterprise-app
# - prometheus
# - grafana

# ==============================================================================
# STEP 11: CHECK LOGS FOR ALL SERVICES
# ==============================================================================
docker logs postgres-db
docker logs postgres-exporter
docker logs enterprise-app
docker logs prometheus
docker logs grafana
```

**Total:** ~80+ lines of commands, must be executed in order, easy to make mistakes!

---

### ✅ WITH Docker Compose

You need **ONE** command:

```bash
docker-compose up -d
```

**That's it!** Everything is done automatically:
- Creates network
- Creates volumes
- Builds application
- Starts all services in correct order
- Waits for dependencies
- Shows status

Check everything with:
```bash
docker-compose ps
docker-compose logs -f
```

**Total:** 1 command! 🎉

---

## Stopping Services

### ❌ WITHOUT Docker Compose

```bash
# Stop each container individually
docker stop grafana
docker stop prometheus
docker stop enterprise-app
docker stop postgres-exporter
docker stop postgres-db

# Remove containers (if you want to clean up)
docker rm grafana
docker rm prometheus
docker rm enterprise-app
docker rm postgres-exporter
docker rm postgres-db

# Remove network (if you want)
docker network rm monitoring-network

# Note: Volumes are NOT removed (good for data, but need manual cleanup)
```

**Total:** 10+ commands

---

### ✅ WITH Docker Compose

```bash
# Stop all services
docker-compose stop

# Or stop and remove containers (volumes preserved)
docker-compose down

# Or stop and remove everything including data
docker-compose down -v
```

**Total:** 1 command!

---

## Viewing Logs

### ❌ WITHOUT Docker Compose

```bash
# View logs of each service separately
docker logs postgres-db
docker logs postgres-exporter
docker logs enterprise-app
docker logs prometheus
docker logs grafana

# Follow logs (need separate terminal for each)
docker logs -f postgres-db &
docker logs -f postgres-exporter &
docker logs -f enterprise-app &
docker logs -f prometheus &
docker logs -f grafana &

# View last 100 lines
docker logs --tail=100 postgres-db
docker logs --tail=100 postgres-exporter
docker logs --tail=100 enterprise-app
docker logs --tail=100 prometheus
docker logs --tail=100 grafana
```

**Total:** 5 commands minimum (15 commands for detailed viewing)

---

### ✅ WITH Docker Compose

```bash
# View all logs
docker-compose logs

# Follow all logs
docker-compose logs -f

# View logs of specific service
docker-compose logs -f prometheus

# Last 100 lines of all services
docker-compose logs --tail=100
```

**Total:** 1 command!

---

## Restarting Services

### ❌ WITHOUT Docker Compose

```bash
# Restart each service
docker restart postgres-db
docker restart postgres-exporter
docker restart enterprise-app
docker restart prometheus
docker restart grafana

# Wait and verify each one
docker ps
docker logs postgres-db | tail
docker logs postgres-exporter | tail
docker logs enterprise-app | tail
docker logs prometheus | tail
docker logs grafana | tail
```

**Total:** 10 commands

---

### ✅ WITH Docker Compose

```bash
# Restart all services
docker-compose restart

# Or restart specific service
docker-compose restart prometheus
```

**Total:** 1 command!

---

## Updating Configuration

### ❌ WITHOUT Docker Compose

```bash
# Edit config file
nano prometheus/prometheus.yml

# Stop the service
docker stop prometheus

# Remove the container
docker rm prometheus

# Recreate with new config (need to remember all the flags!)
docker run -d \
  --name prometheus \
  --network monitoring-network \
  --restart unless-stopped \
  -p 9090:9090 \
  -v "$(pwd)/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
  -v "$(pwd)/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro" \
  -v prometheus-data:/prometheus \
  prom/prometheus:latest \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --web.console.libraries=/etc/prometheus/console_libraries \
  --web.console.templates=/etc/prometheus/consoles \
  --storage.tsdb.retention.time=30d \
  --web.enable-lifecycle

# Check if it worked
docker logs prometheus
```

**Total:** 4+ commands, need to remember exact configuration!

---

### ✅ WITH Docker Compose

```bash
# Edit config file
nano prometheus/prometheus.yml

# Restart with new config
docker-compose up -d prometheus
```

**Total:** 1 command! Configuration is in docker-compose.yml, no need to remember!

---

## Checking Status

### ❌ WITHOUT Docker Compose

```bash
# List all containers
docker ps -a

# Check if specific containers are running
docker ps | grep postgres-db
docker ps | grep postgres-exporter
docker ps | grep enterprise-app
docker ps | grep prometheus
docker ps | grep grafana

# Check resource usage
docker stats postgres-db
docker stats postgres-exporter
docker stats enterprise-app
docker stats prometheus
docker stats grafana

# Check container details
docker inspect postgres-db
docker inspect postgres-exporter
docker inspect enterprise-app
docker inspect prometheus
docker inspect grafana
```

**Total:** 10+ commands

---

### ✅ WITH Docker Compose

```bash
# Check status of all services
docker-compose ps

# Check resource usage
docker-compose stats

# View configuration
docker-compose config
```

**Total:** 1 command!

---

## Rebuilding After Code Changes

### ❌ WITHOUT Docker Compose

```bash
# Stop the app
docker stop enterprise-app

# Remove the container
docker rm enterprise-app

# Remove the old image
docker rmi enterprise-app:latest

# Rebuild the image
cd app-service
docker build -t enterprise-app:latest .
cd ..

# Recreate the container (remember all flags!)
docker run -d \
  --name enterprise-app \
  --network monitoring-network \
  --restart unless-stopped \
  -p 3000:3000 \
  --health-cmd "wget --quiet --tries=1 --spider http://localhost:3000/health" \
  --health-interval 30s \
  --health-timeout 10s \
  --health-retries 3 \
  --health-start-period 40s \
  enterprise-app:latest

# Check logs
docker logs enterprise-app
```

**Total:** 7 commands

---

### ✅ WITH Docker Compose

```bash
# Rebuild and restart
docker-compose up -d --build app-service
```

**Total:** 1 command!

---

## Scaling Services

### ❌ WITHOUT Docker Compose

```bash
# Start multiple instances manually
docker run -d --name app1 --network monitoring-network -p 3001:3000 enterprise-app
docker run -d --name app2 --network monitoring-network -p 3002:3000 enterprise-app
docker run -d --name app3 --network monitoring-network -p 3003:3000 enterprise-app

# Need to update Prometheus config to scrape all instances
# Need to manage port conflicts manually
# Need to stop each one individually later
```

**Total:** Very complex, not practical

---

### ✅ WITH Docker Compose

```bash
# Scale to 3 instances
docker-compose up -d --scale app-service=3

# Scale down to 1
docker-compose up -d --scale app-service=1
```

**Total:** 1 command!

---

## Running Commands Inside Containers

### ❌ WITHOUT Docker Compose

```bash
# Connect to PostgreSQL
docker exec -it postgres-db psql -U postgres

# Check Prometheus config
docker exec prometheus cat /etc/prometheus/prometheus.yml

# Run command in app
docker exec enterprise-app npm test

# Open shell in container
docker exec -it grafana /bin/bash
```

**Total:** Need to remember exact container names

---

### ✅ WITH Docker Compose

```bash
# Connect to PostgreSQL (use service name)
docker-compose exec postgres psql -U postgres

# Check Prometheus config
docker-compose exec prometheus cat /etc/prometheus/prometheus.yml

# Run command in app
docker-compose exec app-service npm test

# Open shell in container
docker-compose exec grafana /bin/bash
```

**Total:** Same commands but use service names (easier to remember)

---

## Troubleshooting

### ❌ WITHOUT Docker Compose

```bash
# Check if services can communicate
docker exec enterprise-app ping postgres-db
docker exec prometheus curl http://enterprise-app:3000/metrics
docker exec grafana curl http://prometheus:9090

# Check network
docker network inspect monitoring-network

# Check volumes
docker volume inspect postgres-data
docker volume inspect prometheus-data
docker volume inspect grafana-data

# Check why container failed
docker logs postgres-db
docker inspect postgres-db | grep -A 20 State

# Port conflicts
docker ps -a
lsof -i :3000
lsof -i :9090
```

**Total:** Many commands, complex investigation

---

### ✅ WITH Docker Compose

```bash
# Check everything
docker-compose ps
docker-compose logs

# Check specific service
docker-compose logs postgres

# Validate configuration
docker-compose config

# View networks and volumes
docker-compose config --volumes
docker-compose config --services
```

**Total:** Simple, organized troubleshooting

---

## Sharing with Team

### ❌ WITHOUT Docker Compose

You would need to create a document like:

```markdown
## Setup Instructions

1. Install Docker
2. Create network: `docker network create monitoring-network`
3. Create volumes: `docker volume create postgres-data` ...
4. Run postgres: `docker run -d --name postgres-db ...` (80 characters)
5. Wait 15 seconds
6. Run postgres-exporter: `docker run -d --name ...` (60 characters)
7. Build app: `cd app-service && docker build ...`
8. Run app: `docker run -d --name enterprise-app ...` (70 characters)
9. Run prometheus: `docker run -d --name prometheus ...` (120 characters)
10. Run grafana: `docker run -d --name grafana ...` (100 characters)
11. Check logs for each service
12. Access at http://localhost:3001

To stop:
- `docker stop` each service
- `docker rm` each service

To update:
- Stop service
- Remove container
- Rebuild/pull
- Recreate with exact same flags
```

**Problems:**
- ❌ Long documentation
- ❌ Easy to make typos
- ❌ Version drift (someone uses different flags)
- ❌ Hard to maintain
- ❌ Different behavior on different machines

---

### ✅ WITH Docker Compose

Share the `docker-compose.yml` file:

```markdown
## Setup Instructions

1. Install Docker and Docker Compose
2. Clone repository
3. Run: `docker-compose up -d`
4. Access at http://localhost:3001

To stop: `docker-compose down`
To update: `docker-compose up -d --build`
```

**Benefits:**
- ✅ Simple documentation
- ✅ Configuration is code (version controlled)
- ✅ Guaranteed same behavior everywhere
- ✅ Easy to maintain
- ✅ Self-documenting

---

## Complete Comparison Summary

| Task | Without Docker Compose | With Docker Compose | Time Saved |
|------|----------------------|-------------------|-----------|
| **Start all services** | 80+ lines, 10 steps | `docker-compose up -d` | 10 minutes → 30 seconds |
| **Stop all services** | 10+ commands | `docker-compose down` | 2 minutes → 5 seconds |
| **View logs** | 5-15 commands | `docker-compose logs` | 1 minute → 5 seconds |
| **Restart services** | 10 commands | `docker-compose restart` | 2 minutes → 10 seconds |
| **Update config** | 4+ commands, remember flags | `docker-compose up -d` | 3 minutes → 10 seconds |
| **Rebuild app** | 7 commands | `docker-compose up -d --build` | 2 minutes → 20 seconds |
| **Check status** | 10+ commands | `docker-compose ps` | 1 minute → 5 seconds |
| **Troubleshoot** | Many commands | `docker-compose logs` | 5 minutes → 30 seconds |
| **Share with team** | Long documentation | Share docker-compose.yml | Hours → Minutes |
| **Total complexity** | High | Low | Massive difference! |

---

## Real-World Impact

### Developer Experience

**Without Docker Compose:**
- "How do I run this project?"
- "Which ports does it use?"
- "What's the startup order?"
- "My setup doesn't work like yours"
- "I forgot a flag when starting postgres"

**With Docker Compose:**
- "Just run `docker-compose up`"
- "Everything is in the YAML file"
- "It handles dependencies automatically"
- "Works the same for everyone"
- "Configuration is version controlled"

### Time Investment

**First time setup:**
- Without Docker Compose: 1-2 hours (reading docs, typing commands, fixing errors)
- With Docker Compose: 5 minutes (`docker-compose up -d`)

**Daily usage:**
- Without Docker Compose: 5-10 minutes per day (starting, stopping, checking)
- With Docker Compose: 30 seconds per day

**Over a month (20 workdays):**
- Without Docker Compose: ~3-4 hours wasted
- With Docker Compose: ~10 minutes total

### Team Impact

**Team of 5 developers:**
- Without Docker Compose: Everyone struggles, different setups, hard to help each other
- With Docker Compose: Everyone has identical environment, easy collaboration

---

## Conclusion

**Docker Compose transforms:**
- 80+ commands → 1 command
- Complex documentation → Single YAML file
- Hours of setup → Minutes
- "It works on my machine" → "It works everywhere"
- Manual orchestration → Automated orchestration

**This is why Docker Compose is essential for multi-container applications!**
