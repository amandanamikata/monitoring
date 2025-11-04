# Prometheus Scraping Methods: Direct vs Exporter

This document explains the two different approaches to collecting metrics in this project.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCRAPING METHOD COMPARISON                     │
└─────────────────────────────────────────────────────────────────┘

METHOD 1: DIRECT SCRAPING (Node.js Application)
┌──────────────────┐                    ┌──────────────────┐
│   Node.js App    │                    │   Prometheus     │
│   Port 3000      │ ─────────────────> │   Port 9090      │
│                  │   HTTP GET          │                  │
│ Built-in         │   /metrics          │ Scrapes directly │
│ prom-client      │                     │                  │
└──────────────────┘                    └──────────────────┘
      ✅ Native Prometheus support
      ✅ No middleware needed
      ✅ Real-time metrics


METHOD 2: EXPORTER PATTERN (PostgreSQL)
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   PostgreSQL     │    │ Postgres Exporter│    │   Prometheus     │
│   Port 5432      │<───│   Port 9187      │<───│   Port 9090      │
│                  │    │                  │    │                  │
│ No Prometheus    │ SQL│ Translates SQL   │HTTP│ Scrapes from     │
│ support          │    │ to Prometheus    │GET │ exporter         │
└──────────────────┘    └──────────────────┘    └──────────────────┘
      ❌ Doesn't speak Prometheus
      ✅ Exporter acts as translator
      ✅ No database modification needed
```

---

## Method 1: Direct Scraping (Built-in Metrics)

### Example: Node.js Application

**How it works:**
1. Application imports Prometheus client library (`prom-client`)
2. Application creates and exposes metrics in code
3. Application serves `/metrics` endpoint in Prometheus format
4. Prometheus scrapes the `/metrics` endpoint directly

### Implementation

**Step 1: Install Prometheus client**
```javascript
// package.json
{
  "dependencies": {
    "prom-client": "^15.1.0"
  }
}
```

**Step 2: Create metrics in application code**
```javascript
// server.js
const client = require('prom-client');
const register = new client.Registry();

// Create a counter metric
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(httpRequestCounter);

// Increment the counter on each request
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
  });
  next();
});
```

**Step 3: Expose /metrics endpoint**
```javascript
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Step 4: Configure Prometheus to scrape**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'my-app'
    static_configs:
      - targets: ['app:3000']
```

### Metrics Output Format
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/users",status_code="200"} 1523
http_requests_total{method="POST",route="/api/orders",status_code="201"} 847

# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 45.67
```

### When to Use Direct Scraping

✅ **Use when:**
- You're building a new application
- You can modify the application code
- The language has a Prometheus client library
- You want low latency and real-time metrics
- You need fine-grained control over metrics

❌ **Don't use when:**
- You can't modify the application (third-party software)
- No Prometheus client library available for your language
- Application is legacy/unmaintained

### Languages with Prometheus Client Libraries
- **Go**: `prometheus/client_golang`
- **Python**: `prometheus_client`
- **Java**: `prometheus/client_java`
- **Node.js**: `prom-client`
- **Ruby**: `prometheus/client_ruby`
- **.NET**: `prometheus-net`
- **Rust**: `prometheus`
- **PHP**: `promphp/prometheus_client_php`

---

## Method 2: Exporter Pattern (External Adapter)

### Example: PostgreSQL with postgres_exporter

**How it works:**
1. PostgreSQL runs normally (no modification)
2. Exporter connects to PostgreSQL using standard protocol
3. Exporter queries PostgreSQL for metrics (SQL queries)
4. Exporter translates results to Prometheus format
5. Exporter exposes `/metrics` endpoint
6. Prometheus scrapes the exporter (not PostgreSQL directly)

### Implementation

**Step 1: Run your service normally**
```yaml
# docker-compose.yml
postgres:
  image: postgres:15
  environment:
    POSTGRES_PASSWORD: secret
  ports:
    - "5432:5432"
```

**Step 2: Deploy the exporter**
```yaml
# docker-compose.yml
postgres-exporter:
  image: prometheuscommunity/postgres-exporter
  environment:
    DATA_SOURCE_NAME: "postgresql://user:pass@postgres:5432/db?sslmode=disable"
  ports:
    - "9187:9187"
```

**Step 3: Configure custom queries (optional)**
```yaml
# queries.yaml
pg_database_size:
  query: "SELECT datname, pg_database_size(datname) as size_bytes FROM pg_database"
  metrics:
    - datname:
        usage: "LABEL"
        description: "Database name"
    - size_bytes:
        usage: "GAUGE"
        description: "Database size in bytes"
```

**Step 4: Configure Prometheus**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'postgresql'
    static_configs:
      - targets: ['postgres-exporter:9187']  # Scrape exporter, not database!
```

### How the Exporter Works Internally

```
1. Prometheus sends HTTP GET to postgres-exporter:9187/metrics
2. Exporter receives request
3. Exporter executes: SELECT * FROM pg_stat_activity
4. Exporter gets results:
   ┌──────────┬───────┬──────────┐
   │ datname  │ state │ count(*) │
   ├──────────┼───────┼──────────┤
   │ mydb     │ active│ 15       │
   │ mydb     │ idle  │ 5        │
   └──────────┴───────┴──────────┘
5. Exporter transforms to Prometheus format:
   pg_stat_activity_connections{datname="mydb",state="active"} 15
   pg_stat_activity_connections{datname="mydb",state="idle"} 5
6. Returns to Prometheus as HTTP response
```

### When to Use Exporter Pattern

✅ **Use when:**
- Service doesn't have native Prometheus support
- You can't or don't want to modify the application
- It's third-party or commercial software
- Standard exporter already exists
- You need to aggregate metrics from multiple sources

❌ **Don't use when:**
- You can add native support directly
- No reliable exporter exists
- Exporter adds unacceptable latency
- You need real-time metrics (<1s granularity)

### Common Exporters

| Service | Exporter | Image | Port | Metrics |
|---------|----------|-------|------|---------|
| PostgreSQL | postgres_exporter | `prometheuscommunity/postgres-exporter` | 9187 | Database stats, queries, connections |
| MySQL | mysqld_exporter | `prom/mysqld-exporter` | 9104 | Database stats, replication |
| Redis | redis_exporter | `oliver006/redis_exporter` | 9121 | Cache stats, memory, keys |
| MongoDB | mongodb_exporter | `percona/mongodb_exporter` | 9216 | Database stats, operations |
| NGINX | nginx-exporter | `nginx/nginx-prometheus-exporter` | 9113 | Requests, connections |
| Apache | apache_exporter | `lusitaniae/apache_exporter` | 9117 | Requests, workers |
| RabbitMQ | rabbitmq_exporter | `kbudde/rabbitmq-exporter` | 9419 | Queues, messages, connections |
| Elasticsearch | elasticsearch_exporter | `quay.io/prometheuscommunity/elasticsearch-exporter` | 9114 | Cluster health, indices |
| Kafka | kafka_exporter | `danielqsj/kafka-exporter` | 9308 | Topics, consumer lag |
| HAProxy | haproxy_exporter | `prom/haproxy-exporter` | 9101 | Frontend/backend stats |
| Memcached | memcached_exporter | `prom/memcached-exporter` | 9150 | Cache stats, evictions |
| Consul | consul_exporter | `prom/consul-exporter` | 9107 | Service discovery, health |

---

## Side-by-Side Comparison

| Aspect | Direct Scraping | Exporter Pattern |
|--------|----------------|------------------|
| **Complexity** | Low - just add library | Medium - additional component |
| **Performance** | Fast - no translation | Slightly slower - translation overhead |
| **Latency** | Real-time | Depends on exporter and target |
| **Maintenance** | Part of app | Separate component to maintain |
| **Code Changes** | Required | Not required |
| **Third-party Support** | Need client library | Works with anything |
| **Resource Usage** | Low - in-process | Medium - separate process |
| **Failure Impact** | App metrics stop | Only metrics stop, app unaffected |
| **Customization** | Full control | Limited by exporter capabilities |
| **Examples** | Modern apps, microservices | Databases, message queues, legacy apps |

---

## Real-World Scenarios

### Scenario 1: Building a New Microservice
**Recommendation:** Direct Scraping

```javascript
// Your new microservice
const express = require('express');
const client = require('prom-client');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(3000);
```

**Why:** You control the code, low overhead, real-time metrics.

### Scenario 2: Monitoring Production PostgreSQL
**Recommendation:** Exporter Pattern

```yaml
postgres-exporter:
  image: prometheuscommunity/postgres-exporter
  environment:
    DATA_SOURCE_NAME: postgresql://monitor:pass@postgres:5432/db
```

**Why:** Can't modify PostgreSQL, standard exporter exists, safe.

### Scenario 3: Legacy Java Application
**Recommendation:** Try both

**Option A - Add direct support** (if possible):
```xml
<!-- pom.xml -->
<dependency>
    <groupId>io.prometheus</groupId>
    <artifactId>simpleclient_servlet</artifactId>
    <version>0.16.0</version>
</dependency>
```

**Option B - Use JMX Exporter** (if can't modify):
```yaml
jmx-exporter:
  image: bitnami/jmx-exporter
  environment:
    JMX_URL: service:jmx:rmi:///jndi/rmi://app:9010/jmxrmi
```

**Why:** Direct is better but may require redeployment. JMX exporter works without changes.

### Scenario 4: Monitoring Multiple Services
**Recommendation:** Mixed approach

```
┌─────────────┐ Direct   ┌─────────────┐
│   Your API  ├─────────>│ Prometheus  │
└─────────────┘          └──────┬──────┘
                                 │
┌─────────────┐          ┌──────┴──────┐
│   Redis     │<---------│   Redis     │
└─────────────┘  Query   │   Exporter  ├───>┌─────────────┐
                         └─────────────┘    │ Prometheus  │
┌─────────────┐          ┌─────────────┐    └─────────────┘
│   MongoDB   │<---------│   MongoDB   │
└─────────────┘  Query   │   Exporter  ├───>
                         └─────────────┘
```

**Why:** Use the right tool for each component.

---

## Prometheus Configuration Comparison

### Direct Scraping Config
```yaml
scrape_configs:
  - job_name: 'my-app'
    scrape_interval: 10s        # Can be frequent
    static_configs:
      - targets: ['app:3000']   # Scrape app directly
    labels:
      scrape_method: 'direct'
```

### Exporter Pattern Config
```yaml
scrape_configs:
  - job_name: 'postgresql'
    scrape_interval: 30s              # Less frequent
    scrape_timeout: 10s               # Longer timeout
    static_configs:
      - targets: ['pg-exporter:9187'] # Scrape exporter
    labels:
      scrape_method: 'exporter'

    # Optional: relabel to add metadata
    metric_relabel_configs:
      - source_labels: [__name__]
        target_label: 'exporter'
        replacement: 'postgres_exporter'
```

---

## Testing Both Methods

### Test Direct Scraping (Node.js App)
```bash
# 1. Check metrics endpoint works
curl http://localhost:3000/metrics

# Expected output:
# http_requests_total{method="GET",route="/",status_code="200"} 1
# process_cpu_seconds_total 0.123
# nodejs_heap_size_used_bytes 12345678

# 2. Generate traffic
curl -X POST http://localhost:3000/api/orders

# 3. Check metrics updated
curl http://localhost:3000/metrics | grep orders_total
```

### Test Exporter Pattern (PostgreSQL)
```bash
# 1. Check exporter endpoint works
curl http://localhost:9187/metrics

# Expected output:
# pg_up 1
# pg_stat_activity_connections{datname="postgres",state="active"} 2
# pg_database_size_bytes{datname="postgres"} 8388608

# 2. Verify exporter is querying database
docker-compose logs postgres-exporter

# 3. Check specific metric
curl http://localhost:9187/metrics | grep pg_database_size_bytes
```

### Verify in Prometheus
```bash
# Open Prometheus UI
open http://localhost:9090

# Query direct metrics
http_requests_total

# Query exporter metrics
pg_stat_activity_connections

# Check scrape targets status
# Go to: Status → Targets
# Both should show "UP"
```

---

## Key Takeaways

1. **Direct Scraping = Native Integration**
   - Application speaks Prometheus language natively
   - Add metrics in your code
   - Best for applications you control

2. **Exporter Pattern = Translation Layer**
   - Exporter translates between service and Prometheus
   - No service modification needed
   - Best for third-party/legacy services

3. **Use Both in Production**
   - Modern apps: Direct scraping
   - Databases/infrastructure: Exporters
   - Mix and match based on needs

4. **Configuration Differences**
   - Direct: Scrape app endpoint
   - Exporter: Scrape exporter endpoint

5. **Both End Up in Prometheus**
   - Same query language (PromQL)
   - Same visualization in Grafana
   - Same alerting capabilities

---

## Further Reading

- **Prometheus Documentation**: https://prometheus.io/docs/instrumenting/writing_exporters/
- **Official Exporters List**: https://prometheus.io/docs/instrumenting/exporters/
- **Client Libraries**: https://prometheus.io/docs/instrumenting/clientlibs/
- **Best Practices**: https://prometheus.io/docs/practices/instrumentation/
