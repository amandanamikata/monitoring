# Enterprise Monitoring with Prometheus and Grafana

A complete monitoring stack demonstrating two different approaches to metrics collection:
1. **Direct Scraping**: Node.js app with built-in Prometheus metrics
2. **Exporter Pattern**: PostgreSQL with postgres_exporter

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Component Breakdown](#detailed-component-breakdown)
- [Understanding the Two Scraping Methods](#understanding-the-two-scraping-methods)
- [Accessing the Services](#accessing-the-services)
- [Exploring Metrics](#exploring-metrics)
- [Creating Custom Dashboards](#creating-custom-dashboards)
- [Troubleshooting](#troubleshooting)
- [Enterprise Metrics Explained](#enterprise-metrics-explained)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MONITORING STACK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐        ┌──────────────────┐              │
│  │   Node.js App    │        │   PostgreSQL     │              │
│  │  (Port 3000)     │        │   (Port 5432)    │              │
│  │                  │        │                  │              │
│  │  /metrics        │        │  (No /metrics)   │              │
│  │  endpoint        │        │                  │              │
│  └────────┬─────────┘        └────────┬─────────┘              │
│           │                           │                         │
│           │ Direct                    │                         │
│           │ Scraping                  │ Queries                 │
│           │                           ▼                         │
│           │                  ┌──────────────────┐              │
│           │                  │ Postgres Exporter│              │
│           │                  │   (Port 9187)    │              │
│           │                  │                  │              │
│           │                  │   /metrics       │              │
│           │                  └────────┬─────────┘              │
│           │                           │                         │
│           │                           │ Exporter                │
│           │                           │ Scraping                │
│           ▼                           ▼                         │
│  ┌─────────────────────────────────────────┐                   │
│  │          Prometheus (Port 9090)         │                   │
│  │                                         │                   │
│  │  - Scrapes metrics every 10-30s        │                   │
│  │  - Stores time-series data             │                   │
│  │  - Evaluates alert rules               │                   │
│  └─────────────────┬───────────────────────┘                   │
│                    │                                            │
│                    │ Query                                      │
│                    ▼                                            │
│  ┌─────────────────────────────────────────┐                   │
│  │          Grafana (Port 3001)            │                   │
│  │                                         │                   │
│  │  - Visualizes metrics                  │                   │
│  │  - Creates dashboards                  │                   │
│  │  - Sends alerts                        │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **Docker** (v20.10+)
- **Docker Compose** (v2.0+)
- At least 4GB RAM available
- Ports available: 3000, 3001, 5432, 9090, 9187

Check if Docker is installed:
```bash
docker --version
docker-compose --version
```

---

## Quick Start

### Step 1: Navigate to Project Directory
```bash
cd prometheus-monitoring
```

### Step 2: Start All Services
```bash
docker-compose up -d
```

This command will:
- Build the Node.js application
- Pull required Docker images (PostgreSQL, Prometheus, Grafana, postgres_exporter)
- Start all services in the background
- Create necessary volumes and networks

### Step 3: Verify All Services Are Running
```bash
docker-compose ps
```

You should see all services with status "Up":
```
NAME                IMAGE                                      STATUS
enterprise-app      prometheus-monitoring-app-service          Up
grafana             grafana/grafana:latest                     Up
postgres-db         postgres:15-alpine                         Up
postgres-exporter   prometheuscommunity/postgres-exporter      Up
prometheus          prom/prometheus:latest                     Up
```

### Step 4: Check Service Health
```bash
# Check logs for any errors
docker-compose logs -f

# Or check individual services
docker-compose logs app-service
docker-compose logs postgres
docker-compose logs prometheus
docker-compose logs grafana
```

---

## Detailed Component Breakdown

### 1. Node.js Application (Direct Prometheus Integration)

**Location**: `app-service/`

**How it works**:
- Uses `prom-client` npm package
- Exposes `/metrics` endpoint directly
- No exporter needed
- Prometheus scrapes directly from `http://app-service:3000/metrics`

**Key files**:
- `server.js`: Main application with metrics instrumentation
- `package.json`: Dependencies including prom-client
- `Dockerfile`: Container definition

**Exposed metrics**:
```
# HTTP Metrics
http_request_duration_seconds    # Request latency histogram
http_requests_total              # Total request counter

# Business Metrics
orders_total                     # Orders by status and payment method
revenue_total_dollars            # Revenue by product category
active_users_current             # Current active users
user_registrations_total         # User registration counter

# Application Performance
database_query_duration_seconds  # Database query latency
cache_hits_total / cache_misses_total  # Cache performance
application_errors_total         # Error tracking
active_connections_current       # Active connections
queue_size_current              # Queue sizes

# Node.js Runtime Metrics (automatic)
process_cpu_seconds_total       # CPU usage
process_resident_memory_bytes   # Memory usage
nodejs_eventloop_lag_seconds    # Event loop lag
nodejs_heap_size_used_bytes     # Heap usage
```

**Test the metrics endpoint**:
```bash
curl http://localhost:3000/metrics
```

### 2. PostgreSQL Database (Requires Exporter)

**Location**: `postgres-exporter/`

**Why an exporter is needed**:
- PostgreSQL doesn't natively speak Prometheus format
- Database metrics are in SQL tables (pg_stat_*, pg_database, etc.)
- postgres_exporter acts as a translator/bridge
- It queries PostgreSQL and converts results to Prometheus metrics

**Key files**:
- `init.sql`: Database initialization with sample data
- `queries.yaml`: Custom metric queries for the exporter

**How postgres_exporter works**:
1. Connects to PostgreSQL using credentials
2. Runs SQL queries defined in `queries.yaml`
3. Converts query results to Prometheus metrics format
4. Exposes metrics at `http://postgres-exporter:9187/metrics`
5. Prometheus scrapes from the exporter, not directly from PostgreSQL

**Exposed metrics**:
```
# Database Metrics
pg_database_size_bytes          # Database size
pg_stat_activity_connections    # Active connections by state
pg_slow_queries_slow_queries    # Slow query count
pg_cache_hit_ratio_ratio        # Cache hit ratio

# Table Statistics
pg_stat_user_tables_seq_scan    # Sequential scans
pg_stat_user_tables_idx_scan    # Index scans
pg_stat_user_tables_n_live_tup  # Live tuples
pg_stat_user_tables_n_dead_tup  # Dead tuples

# Business Metrics from Database
business_orders_by_status_count      # Orders by status
business_orders_by_status_total_amount  # Revenue by status
business_users_by_type_count         # Users by account type
business_product_stock_stock_quantity  # Product inventory
business_daily_revenue_revenue       # Daily revenue
```

**Test the exporter endpoint**:
```bash
curl http://localhost:9187/metrics
```

### 3. Prometheus Configuration

**Location**: `prometheus/prometheus.yml`

**Key sections**:

```yaml
# Global settings
global:
  scrape_interval: 15s      # Default scrape frequency
  evaluation_interval: 15s  # How often to evaluate rules

# Scrape configurations
scrape_configs:
  # Direct scraping - no exporter
  - job_name: 'enterprise-app'
    scrape_interval: 10s
    static_configs:
      - targets: ['app-service:3000']
        labels:
          scrape_method: 'direct'

  # Exporter-based scraping
  - job_name: 'postgresql'
    scrape_interval: 30s
    static_configs:
      - targets: ['postgres-exporter:9187']
        labels:
          scrape_method: 'exporter'
```

**Important configuration details**:
- `scrape_interval`: How often to collect metrics (10-30s)
- `targets`: Service hostname:port to scrape
- `labels`: Additional metadata attached to metrics
- `metric_relabel_configs`: Modify metrics before storage

### 4. Grafana Configuration

**Location**: `grafana/`

**Auto-configured components**:
- **Datasource**: Prometheus connection (auto-configured)
- **Dashboards**: Two pre-built dashboards (auto-loaded)

**Files**:
- `datasources/prometheus.yml`: Prometheus datasource config
- `dashboards/dashboard-provider.yml`: Dashboard loading config
- `dashboards/application-dashboard.json`: App metrics dashboard
- `dashboards/database-dashboard.json`: Database metrics dashboard

---

## Understanding the Two Scraping Methods

### Method 1: Direct Scraping (Node.js App)

**Advantages**:
- ✅ Simple and fast
- ✅ No additional components
- ✅ Lower latency
- ✅ Real-time metrics
- ✅ Full control over metrics

**Implementation**:
```javascript
// Install prometheus client
npm install prom-client

// In your application
const client = require('prom-client');
const register = new client.Registry();

// Create metrics
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests'
});

register.registerMetric(httpRequestCounter);

// Expose endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**When to use**:
- Modern applications you control
- Applications in languages with Prometheus client libraries
- When you can modify the application code

### Method 2: Exporter Pattern (PostgreSQL)

**Advantages**:
- ✅ Works with third-party software
- ✅ No application modification needed
- ✅ Reusable exporters available
- ✅ Centralized metrics logic
- ✅ Can aggregate multiple sources

**Disadvantages**:
- ❌ Additional component to maintain
- ❌ Slight latency increase
- ❌ Extra resource usage
- ❌ Another potential failure point

**Implementation**:
```yaml
# docker-compose.yml
postgres-exporter:
  image: prometheuscommunity/postgres-exporter
  environment:
    DATA_SOURCE_NAME: "postgresql://user:pass@postgres:5432/db"
  ports:
    - "9187:9187"
```

**When to use**:
- Third-party software (databases, message queues, etc.)
- Legacy applications you can't modify
- Services without Prometheus client libraries
- When you need custom metrics from existing data

### Common Exporters

| Software | Exporter | Port | Purpose |
|----------|----------|------|---------|
| PostgreSQL | postgres_exporter | 9187 | Database metrics |
| MySQL | mysqld_exporter | 9104 | Database metrics |
| Redis | redis_exporter | 9121 | Cache metrics |
| MongoDB | mongodb_exporter | 9216 | Database metrics |
| NGINX | nginx-prometheus-exporter | 9113 | Web server metrics |
| HAProxy | haproxy_exporter | 9101 | Load balancer metrics |
| RabbitMQ | rabbitmq_exporter | 9419 | Message queue metrics |
| Elasticsearch | elasticsearch_exporter | 9114 | Search metrics |

---

## Accessing the Services

Once all services are running, access them via:

| Service | URL | Credentials | Purpose |
|---------|-----|-------------|---------|
| Node.js App | http://localhost:3000 | None | Application endpoints |
| App Metrics | http://localhost:3000/metrics | None | Raw Prometheus metrics |
| Prometheus | http://localhost:9090 | None | Query metrics, view targets |
| Postgres Exporter | http://localhost:9187/metrics | None | Database metrics |
| Grafana | http://localhost:3001 | admin/admin | Dashboards and visualization |
| PostgreSQL | localhost:5432 | postgres/postgres | Database (via client) |

---

## Exploring Metrics

### 1. View Raw Metrics

**Application metrics**:
```bash
curl http://localhost:3000/metrics | grep -E "^(http_|orders_|revenue_)"
```

**Database metrics**:
```bash
curl http://localhost:9187/metrics | grep -E "^(pg_|business_)"
```

### 2. Generate Sample Data

The Node.js app has endpoints to generate metrics:

```bash
# Create orders
curl -X POST http://localhost:3000/api/orders

# Register users
curl -X POST http://localhost:3000/api/users/register

# Check active users
curl http://localhost:3000/api/users/active

# Test cache
curl http://localhost:3000/api/cache/test

# Simulate database query
curl http://localhost:3000/api/database/query

# Generate error
curl http://localhost:3000/api/error
```

**Generate load**:
```bash
# Generate 100 requests
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/orders
  curl -X POST http://localhost:3000/api/users/register
  curl http://localhost:3000/api/cache/test
  sleep 0.1
done
```

### 3. Query Metrics in Prometheus

1. Open http://localhost:9090
2. Go to **Graph** tab
3. Try these queries:

**HTTP request rate**:
```promql
rate(http_requests_total[5m])
```

**95th percentile latency**:
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Total orders by status**:
```promql
sum by(status) (orders_total)
```

**Database cache hit ratio**:
```promql
pg_cache_hit_ratio_ratio
```

**Active database connections**:
```promql
sum by(state) (pg_stat_activity_connections)
```

### 4. Check Scrape Targets

1. Open http://localhost:9090
2. Go to **Status → Targets**
3. Verify all targets show "UP" status:
   - `enterprise-app` (Direct scraping)
   - `postgresql` (Exporter scraping)

**Troubleshooting targets**:
- **DOWN**: Service not reachable, check Docker networks
- **TIMEOUT**: Scrape taking too long, check service performance
- **INVALID**: Metrics format incorrect, check /metrics endpoint

---

## Creating Custom Dashboards

### Method 1: Import Existing Dashboards

The project includes two pre-built dashboards that auto-load on startup:
- **Enterprise Application Metrics**: Node.js app metrics
- **PostgreSQL Database Metrics**: Database and business metrics

### Method 2: Create New Dashboard in Grafana UI

1. Open http://localhost:3001
2. Login with `admin` / `admin`
3. Click **+** → **Dashboard** → **Add new panel**

4. **Add a panel for request rate**:
   - Query: `rate(http_requests_total[5m])`
   - Legend: `{{method}} {{route}}`
   - Panel type: **Graph**
   - Title: "HTTP Request Rate"

5. **Add a panel for order statistics**:
   - Query: `sum by(status) (orders_total)`
   - Legend: `{{status}}`
   - Panel type: **Pie chart**
   - Title: "Orders by Status"

6. **Add a panel for active users**:
   - Query: `active_users_current`
   - Legend: `{{user_type}}`
   - Panel type: **Gauge**
   - Title: "Active Users"

7. Click **Save dashboard**

### Method 3: Export/Import Dashboard JSON

**Export a dashboard**:
1. Open dashboard
2. Click **Dashboard settings** (gear icon)
3. Click **JSON Model**
4. Copy JSON
5. Save to file

**Import a dashboard**:
1. Click **+** → **Import**
2. Paste JSON or upload file
3. Select Prometheus datasource
4. Click **Import**

### Method 4: Use Community Dashboards

Grafana has thousands of pre-built dashboards:

1. Go to https://grafana.com/grafana/dashboards
2. Search for your technology (e.g., "Node.js", "PostgreSQL")
3. Copy dashboard ID
4. In Grafana: **+** → **Import** → Enter ID

**Recommended dashboard IDs**:
- **1860**: Node Exporter Full
- **9628**: PostgreSQL Database
- **11074**: Node.js Application Dashboard
- **7362**: Prometheus Stats

---

## Troubleshooting

### Services Won't Start

```bash
# Check Docker Compose logs
docker-compose logs

# Check specific service
docker-compose logs app-service
docker-compose logs prometheus
docker-compose logs grafana

# Restart specific service
docker-compose restart app-service

# Rebuild and restart
docker-compose up -d --build app-service
```

### Metrics Not Appearing

**Check metrics endpoint is working**:
```bash
# Test application metrics
curl http://localhost:3000/metrics

# Test database metrics
curl http://localhost:9187/metrics
```

**Check Prometheus targets**:
1. Open http://localhost:9090/targets
2. Verify targets are UP
3. Check "Last Scrape" timestamp is recent

**Check Prometheus logs**:
```bash
docker-compose logs prometheus | grep -i error
```

### Grafana Shows "No Data"

**Verify datasource connection**:
1. Go to Configuration → Data Sources
2. Click on "Prometheus"
3. Click "Test" button
4. Should show "Data source is working"

**Verify metrics exist in Prometheus**:
1. Go to http://localhost:9090
2. Run query: `up{job="enterprise-app"}`
3. Should return results

**Check time range**:
- Make sure Grafana time range includes data
- Try "Last 5 minutes" or "Last 1 hour"

### PostgreSQL Exporter Issues

**Check exporter logs**:
```bash
docker-compose logs postgres-exporter
```

**Common errors**:

1. **Connection refused**:
   - PostgreSQL not ready yet
   - Wait 30 seconds and check again

2. **Permission denied**:
   - User doesn't have pg_monitor role
   - Check init.sql executed correctly

3. **Custom queries failing**:
   - Syntax error in queries.yaml
   - Check PostgreSQL logs: `docker-compose logs postgres`

**Verify exporter is working**:
```bash
curl http://localhost:9187/metrics | grep pg_up
# Should show: pg_up 1
```

### Database Not Initializing

**Check if init.sql ran**:
```bash
docker-compose exec postgres psql -U postgres -d enterprise_db -c "\dt"
```

Should show tables: users, orders, products, transactions

**Force re-initialization**:
```bash
# Stop and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

### Port Conflicts

If ports are already in use:

```bash
# Check what's using a port
sudo lsof -i :3000
sudo lsof -i :9090

# Kill process or change port in docker-compose.yml
```

**Change ports in docker-compose.yml**:
```yaml
services:
  app-service:
    ports:
      - "3002:3000"  # Change left side only
```

---

## Enterprise Metrics Explained

### HTTP/Application Metrics

| Metric | Type | Description | Business Value |
|--------|------|-------------|----------------|
| `http_requests_total` | Counter | Total HTTP requests | Traffic patterns, usage trends |
| `http_request_duration_seconds` | Histogram | Request latency | User experience, SLA compliance |
| `active_connections_current` | Gauge | Current connections | Capacity planning |
| `application_errors_total` | Counter | Error count | System reliability |

### Business Metrics

| Metric | Type | Description | Business Value |
|--------|------|-------------|----------------|
| `orders_total` | Counter | Order count | Sales volume |
| `revenue_total_dollars` | Counter | Revenue | Financial tracking |
| `active_users_current` | Gauge | Active users | Engagement |
| `user_registrations_total` | Counter | New users | Growth rate |

### Database Metrics

| Metric | Type | Description | Performance Impact |
|--------|------|-------------|-------------------|
| `pg_stat_activity_connections` | Gauge | DB connections | Connection pool sizing |
| `pg_cache_hit_ratio_ratio` | Gauge | Cache efficiency | Query performance |
| `pg_slow_queries_slow_queries` | Gauge | Slow queries | Optimization needs |
| `pg_stat_user_tables_n_dead_tup` | Gauge | Dead tuples | Vacuum requirements |

### Infrastructure Metrics

| Metric | Type | Description | Ops Value |
|--------|------|-------------|-----------|
| `process_cpu_seconds_total` | Counter | CPU usage | Resource allocation |
| `process_resident_memory_bytes` | Gauge | Memory usage | Memory leaks, sizing |
| `nodejs_eventloop_lag_seconds` | Gauge | Event loop lag | Application health |
| `queue_size_current` | Gauge | Queue backlog | Processing capacity |

---

## Next Steps

### 1. Add Alerting

Create `alertmanager.yml` and configure alert notifications:
```yaml
route:
  receiver: 'email'
receivers:
  - name: 'email'
    email_configs:
      - to: 'alerts@company.com'
```

### 2. Add More Exporters

Monitor additional services:
```yaml
# Add Redis monitoring
redis:
  image: redis:alpine
redis-exporter:
  image: oliver006/redis_exporter
```

### 3. Long-term Storage

Configure remote write for long-term metrics:
```yaml
remote_write:
  - url: "https://your-storage/api/v1/write"
```

### 4. Production Hardening

- Use secrets management (Docker secrets, Vault)
- Enable TLS/HTTPS
- Set up authentication
- Configure resource limits
- Implement backup strategy

### 5. Custom Metrics

Add application-specific metrics:
```javascript
const checkoutDuration = new client.Histogram({
  name: 'checkout_duration_seconds',
  help: 'Checkout process duration'
});
```

---

## Stopping the Stack

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (deletes all data)
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all
```

---

## Additional Resources

- **Prometheus Documentation**: https://prometheus.io/docs/
- **Grafana Documentation**: https://grafana.com/docs/
- **Prometheus Client Libraries**: https://prometheus.io/docs/instrumenting/clientlibs/
- **Exporter List**: https://prometheus.io/docs/instrumenting/exporters/
- **PromQL Cheatsheet**: https://promlabs.com/promql-cheat-sheet/
- **Grafana Dashboards**: https://grafana.com/grafana/dashboards/

---

## Summary

This project demonstrates:

✅ **Direct metrics scraping** from application with built-in Prometheus support (Node.js)
✅ **Exporter pattern** for services without native Prometheus support (PostgreSQL)
✅ **Real enterprise metrics**: HTTP, business, database, and infrastructure
✅ **Complete monitoring stack** with Prometheus and Grafana
✅ **Pre-built dashboards** for immediate visualization
✅ **Docker Compose orchestration** for easy deployment

You now have a production-ready monitoring foundation!
