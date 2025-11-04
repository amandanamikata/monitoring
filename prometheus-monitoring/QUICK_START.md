# Quick Start Guide

## Prerequisites

Before starting, ensure you have:
- **Docker** installed (v20.10+)
- **Docker Compose** installed (or Docker with Compose plugin)
- **Proper Docker permissions** (see step 0 below)

---

## 0. Fix Docker Permissions (First Time Setup)

If you get "permission denied" when running Docker commands, you need to fix permissions:

### Option A: Add Your User to Docker Group (Recommended)

```bash
# Add your user to the docker group
sudo usermod -aG docker $USER

# Apply the changes (choose one):
# Option 1: Log out and log back in
# Option 2: Run this command:
newgrp docker

# Verify it works (should show Docker info without sudo):
docker ps
```

**This is a ONE-TIME setup.** After this, you won't need `sudo` for Docker commands.

### Option B: Use sudo (Quick Fix)

If you don't want to add your user to docker group, use `sudo` for all Docker commands:

```bash
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs
```

**Note**: The rest of this guide assumes you've completed Option A. If using Option B, add `sudo` before each `docker` command.

---

## 1. Start Everything

```bash
# Navigate to project directory
cd prometheus-monitoring

# Start all services (first time takes 2-5 minutes)
docker compose up -d
```

**What this does**:
- Creates network and volumes
- Pulls Docker images (postgres, prometheus, grafana, etc.)
- Builds Node.js application
- Starts 5 containers (postgres, postgres-exporter, app-service, prometheus, grafana)

**Expected output**:
```
[+] Building 45.2s
[+] Running 6/6
 ✔ Network prometheus-monitoring_monitoring    Created
 ✔ Volume "prometheus-monitoring_postgres-data" Created
 ✔ Volume "prometheus-monitoring_prometheus-data" Created
 ✔ Volume "prometheus-monitoring_grafana-data" Created
 ✔ Container postgres-db                       Started
 ✔ Container postgres-exporter                 Started
 ✔ Container enterprise-app                    Started
 ✔ Container prometheus                        Started
 ✔ Container grafana                           Started
```

---

## 2. Wait for Services (30-60 seconds)

Services need time to initialize:

```bash
# Check status of all services
docker compose ps
```

**Expected output** (all should show "Up" or "Up (healthy)"):
```
NAME                IMAGE                                      STATUS
enterprise-app      prometheus-monitoring-app-service          Up (healthy)
grafana             grafana/grafana:latest                     Up
postgres-db         postgres:15-alpine                         Up (healthy)
postgres-exporter   prometheuscommunity/postgres-exporter      Up
prometheus          prom/prometheus:latest                     Up
```

**If any show "Restarting" or "Unhealthy"**:
```bash
# Check logs for that service
docker compose logs <service-name>

# Example:
docker compose logs postgres-db
docker compose logs app-service
```

---

## 3. Access Services

Once all services are running:

| Service | URL | Login | Purpose |
|---------|-----|-------|---------|
| **Application** | http://localhost:3000 | - | Node.js app with API endpoints |
| **App Metrics** | http://localhost:3000/metrics | - | Raw Prometheus metrics (direct scraping) |
| **Prometheus** | http://localhost:9090 | - | Query and explore metrics |
| **Postgres Exporter** | http://localhost:9187/metrics | - | Database metrics (exporter pattern) |
| **Grafana** | http://localhost:3001 | admin/admin | Dashboards and visualization |

**Test if everything is working**:
```bash
# Test application
curl http://localhost:3000

# Test metrics endpoint
curl http://localhost:3000/metrics | head -20

# Test exporter
curl http://localhost:9187/metrics | head -20
```

---

## 4. Generate Test Data

The application has endpoints to generate metrics:

```bash
# Generate 50 orders
for i in {1..50}; do
  curl -X POST http://localhost:3000/api/orders
  sleep 0.1
done

# Generate 30 user registrations
for i in {1..30}; do
  curl -X POST http://localhost:3000/api/users/register
  sleep 0.1
done

# Test cache operations
for i in {1..20}; do
  curl http://localhost:3000/api/cache/test
  sleep 0.1
done

# Simulate database queries
for i in {1..20}; do
  curl http://localhost:3000/api/database/query
  sleep 0.1
done
```

**Or use the load generation script**:
```bash
# Generate load for 60 seconds at 2 requests/second
./generate-load.sh 60 2
```

---

## 5. View Dashboards in Grafana

1. **Open Grafana**: http://localhost:3001
2. **Login**:
   - Username: `admin`
   - Password: `admin`
   - (You may be prompted to change password - you can skip this)
3. **Navigate to Dashboards**:
   - Click **Dashboards** in left sidebar
   - Click **Browse**
4. **Open Pre-built Dashboards**:
   - **Enterprise Application Metrics** - Node.js app with direct scraping
   - **PostgreSQL Database Metrics (via Exporter)** - Database metrics via exporter

**What you'll see**:
- Request rate and latency graphs
- Order and revenue statistics
- Active user counts
- Database connections and cache hit rates
- Queue sizes and error rates

---

## 6. View Metrics in Prometheus

1. **Open Prometheus**: http://localhost:9090
2. **Go to Graph tab**
3. **Try these queries**:

```promql
# Request rate (requests per second)
rate(http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active users by type
active_users_current

# Database connections by state
pg_stat_activity_connections

# Orders by status
sum by(status) (orders_total)

# Total revenue
sum(revenue_total_dollars)

# Cache hit rate
sum(rate(cache_hits_total[5m])) /
(sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))

# Database cache hit ratio
pg_cache_hit_ratio_ratio
```

4. **Check Scrape Targets**:
   - Go to: **Status** → **Targets**
   - Verify all targets show **"UP"** status:
     - `enterprise-app` (Direct scraping - no exporter)
     - `postgresql` (Scraping via postgres_exporter)

---

## Key Differences

### Direct Scraping (Node.js App)
- ✅ **Metrics location**: http://localhost:3000/metrics
- ✅ **No exporter needed**: App has built-in Prometheus client (`prom-client`)
- ✅ **Direct scraping**: Prometheus scrapes app directly
- ✅ **Lower latency**: No translation layer
- ✅ **How it works**:
  ```
  Prometheus → HTTP GET → http://app-service:3000/metrics → Returns metrics
  ```

### Exporter Pattern (PostgreSQL)
- ✅ **Metrics location**: http://localhost:9187/metrics
- ✅ **Exporter needed**: Uses `postgres_exporter` as bridge/translator
- ✅ **Why?**: PostgreSQL doesn't speak Prometheus natively (speaks SQL)
- ✅ **Indirect scraping**: Prometheus scrapes exporter, exporter queries database
- ✅ **How it works**:
  ```
  Prometheus → HTTP GET → postgres-exporter:9187/metrics →
  → Exporter runs SQL queries → Translates to Prometheus format → Returns metrics
  ```

---

## Troubleshooting

### **Permission Denied Error**
```
Error: permission denied while trying to connect to the Docker daemon socket
```

**Solution**: Follow [Step 0](#0-fix-docker-permissions-first-time-setup) above to fix Docker permissions.

---

### **Services Not Starting**
```bash
# Check all service logs
docker compose logs

# Check specific service
docker compose logs postgres-db
docker compose logs app-service
docker compose logs prometheus

# Rebuild if needed
docker compose up -d --build
```

---

### **No Metrics in Grafana**
- **Wait 30-60 seconds** for initial scrape
- **Check Prometheus targets**: http://localhost:9090/targets
  - All should show "UP"
- **Generate test data**: Run the commands in [Step 4](#4-generate-test-data)
- **Check datasource**: Grafana → Configuration → Data Sources → Prometheus (should show "working")

---

### **Port Already in Use**
```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :9090
sudo lsof -i :3001

# Kill the process or change port in docker-compose.yml
```

**To change ports**, edit `docker-compose.yml`:
```yaml
services:
  app-service:
    ports:
      - "3002:3000"  # Change left side (host port)
```

---

### **Container Keeps Restarting**
```bash
# Check logs for error messages
docker compose logs <container-name>

# Example: Check app logs
docker compose logs app-service

# Check container status
docker compose ps
```

Common issues:
- **Database not ready**: postgres-exporter starts before postgres is healthy (should fix automatically)
- **Port conflict**: Change ports in docker-compose.yml
- **Build failed**: Run `docker compose build --no-cache app-service`

---

### **Rebuilding After Code Changes**
```bash
# Rebuild and restart specific service
docker compose up -d --build app-service

# Rebuild all services
docker compose up -d --build

# Force clean rebuild
docker compose build --no-cache
docker compose up -d
```

---

## Stop Everything

### **Stop Services (Keep Data)**
```bash
# Stop all containers
docker compose stop

# Or stop and remove containers (volumes persist)
docker compose down
```

### **Stop and Remove All Data**
```bash
# Remove containers AND volumes (deletes all data!)
docker compose down -v
```

**Warning**: `docker compose down -v` will delete:
- All metrics in Prometheus (30 days of data)
- All dashboards you created in Grafana
- All data in PostgreSQL database

Use this to start completely fresh.

---

## View Logs

```bash
# View all logs
docker compose logs

# Follow logs (like tail -f)
docker compose logs -f

# Logs for specific service
docker compose logs app-service
docker compose logs prometheus
docker compose logs grafana

# Last 100 lines
docker compose logs --tail=100

# Follow specific service
docker compose logs -f app-service
```

---

## Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart app-service
docker compose restart prometheus
```

---

## Common Commands Cheatsheet

```bash
# Start services
docker compose up -d

# Stop services
docker compose stop

# Remove services (keep volumes)
docker compose down

# Remove services and volumes
docker compose down -v

# View status
docker compose ps

# View logs
docker compose logs
docker compose logs -f app-service

# Rebuild
docker compose up -d --build

# Restart
docker compose restart
docker compose restart app-service

# Execute command in container
docker compose exec app-service sh
docker compose exec postgres psql -U postgres

# View resource usage
docker compose stats
```

---

## What's Next?

After starting the stack:

1. **Explore Metrics**: Try different PromQL queries in Prometheus
2. **Customize Dashboards**: Edit Grafana dashboards to show what you need
3. **Generate Load**: Use `./generate-load.sh` to see metrics change in real-time
4. **Read Documentation**:
   - `README.md` - Complete guide
   - `FILE_BY_FILE_GUIDE.md` - Line-by-line code explanations
   - `DOCKER_COMPOSE_EXPLAINED.md` - Docker Compose deep dive
   - `SCRAPING_METHODS_EXPLAINED.md` - Direct vs Exporter patterns

---

## Summary

**What You Just Did**:
1. ✅ Fixed Docker permissions (one-time setup)
2. ✅ Started 5 services with one command
3. ✅ Deployed complete monitoring stack:
   - Node.js app with **direct Prometheus scraping**
   - PostgreSQL with **exporter pattern**
   - Prometheus collecting metrics
   - Grafana visualizing data
4. ✅ Generated test data to populate metrics
5. ✅ Accessed dashboards and metrics

**Total Time**: 5-10 minutes (including Docker image downloads)

**Stack is now running!** 🎉
