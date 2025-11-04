# Docker Compose Visual Guide

This document provides visual representations of how Docker Compose orchestrates your monitoring stack.

---

## What Happens When You Run `docker-compose up -d`

```
YOU TYPE:
┌─────────────────────────┐
│ $ docker-compose up -d  │
└────────────┬────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE                              │
│                   (Reads docker-compose.yml)                   │
└────────────┬───────────────────────────────────────────────────┘
             │
             ├─── STEP 1: Read Configuration
             │    "I need 5 services, 1 network, 3 volumes"
             │
             ├─── STEP 2: Create Network
             │    docker network create prometheus-monitoring_monitoring
             │    ✓ Network created
             │
             ├─── STEP 3: Create Volumes
             │    docker volume create prometheus-monitoring_postgres-data
             │    docker volume create prometheus-monitoring_prometheus-data
             │    docker volume create prometheus-monitoring_grafana-data
             │    ✓ Volumes created
             │
             ├─── STEP 4: Build Custom Images
             │    cd app-service && docker build -t ...
             │    ✓ Image built: prometheus-monitoring_app-service
             │
             ├─── STEP 5: Pull Required Images
             │    docker pull postgres:15-alpine
             │    docker pull prometheuscommunity/postgres-exporter:latest
             │    docker pull prom/prometheus:latest
             │    docker pull grafana/grafana:latest
             │    ✓ Images downloaded
             │
             ├─── STEP 6: Start Containers in Dependency Order
             │
             │    ┌─────────────────────────────────────────┐
             │    │ 1. START: postgres                      │
             │    │    - No dependencies                    │
             │    │    - Mounts init.sql                    │
             │    │    - Waits for health check             │
             │    │    ✓ Container running and healthy      │
             │    └─────────────────────────────────────────┘
             │                    │
             │                    ▼
             │    ┌─────────────────────────────────────────┐
             │    │ 2. START: postgres-exporter             │
             │    │    - Depends on: postgres (healthy)     │
             │    │    - Connects to postgres               │
             │    │    ✓ Container running                  │
             │    └─────────────────────────────────────────┘
             │                    │
             │    ┌─────────────────────────────────────────┐
             │    │ 3. START: app-service                   │
             │    │    - No dependencies                    │
             │    │    - Exposes port 3000                  │
             │    │    ✓ Container running                  │
             │    └─────────────────────────────────────────┘
             │                    │
             │                    ▼
             │    ┌─────────────────────────────────────────┐
             │    │ 4. START: prometheus                    │
             │    │    - Depends on: app-service            │
             │    │    - Depends on: postgres-exporter      │
             │    │    - Mounts config files                │
             │    │    ✓ Container running, scraping        │
             │    └─────────────────────────────────────────┘
             │                    │
             │                    ▼
             │    ┌─────────────────────────────────────────┐
             │    │ 5. START: grafana                       │
             │    │    - Depends on: prometheus             │
             │    │    - Auto-loads datasource              │
             │    │    - Auto-loads dashboards              │
             │    │    ✓ Container running                  │
             │    └─────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────┐
│                    ALL SERVICES RUNNING                        │
│                                                                 │
│  ✓ Network: monitoring (5 containers connected)               │
│  ✓ Volumes: 3 volumes mounted                                 │
│  ✓ Services: 5 containers healthy                             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

OUTPUT TO TERMINAL:
Creating network "prometheus-monitoring_monitoring" ... done
Creating volume "prometheus-monitoring_postgres-data" ... done
Creating volume "prometheus-monitoring_prometheus-data" ... done
Creating volume "prometheus-monitoring_grafana-data" ... done
Building app-service ... done
Pulling postgres (postgres:15-alpine) ... done
Pulling postgres-exporter ... done
Pulling prometheus ... done
Pulling grafana ... done
Creating postgres-db ... done
Creating postgres-exporter ... done
Creating enterprise-app ... done
Creating prometheus ... done
Creating grafana ... done
```

---

## Container Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      YOUR COMPUTER (HOST)                       │
│                                                                  │
│  Browser                                                         │
│  localhost:3001 ─────────────────────────────┐                 │
│  localhost:9090 ───────────────┐             │                 │
│  localhost:3000 ─────┐         │             │                 │
└──────────────────────┼─────────┼─────────────┼─────────────────┘
                       │         │             │
         Port 3000     │         │ Port 9090   │ Port 3001
                       │         │             │
┌──────────────────────┼─────────┼─────────────┼─────────────────┐
│                      ▼         ▼             ▼                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        DOCKER NETWORK: monitoring                        │  │
│  │              (Virtual Network Bridge)                    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │                   DNS RESOLVER                      │ │  │
│  │  │  app-service      → 172.18.0.2                     │ │  │
│  │  │  postgres         → 172.18.0.3                     │ │  │
│  │  │  postgres-exporter→ 172.18.0.4                     │ │  │
│  │  │  prometheus       → 172.18.0.5                     │ │  │
│  │  │  grafana          → 172.18.0.6                     │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │  app-service  │  │   postgres   │  │ postgres-    │ │  │
│  │  │  :3000        │  │   :5432      │  │ exporter     │ │  │
│  │  │               │  │              │  │ :9187        │ │  │
│  │  │ /metrics ─────┼──┼──────────────┼──┼──┐           │ │  │
│  │  │               │  │ Queries◄─────┼──┼──┘           │ │  │
│  │  └───────────────┘  └──────────────┘  └──────────────┘ │  │
│  │          │                                     │         │  │
│  │          │  HTTP GET /metrics                  │         │  │
│  │          │                                     │         │  │
│  │          └─────────────┐           ┌───────────┘         │  │
│  │                        ▼           ▼                     │  │
│  │                  ┌──────────────────────┐               │  │
│  │                  │   prometheus         │               │  │
│  │                  │   :9090              │               │  │
│  │                  │                      │               │  │
│  │                  │  Scrapes metrics     │               │  │
│  │                  │  Stores TSDB         │               │  │
│  │                  │  Serves API          │               │  │
│  │                  └──────────┬───────────┘               │  │
│  │                             │                            │  │
│  │                             │ PromQL Queries             │  │
│  │                             ▼                            │  │
│  │                  ┌──────────────────────┐               │  │
│  │                  │      grafana         │               │  │
│  │                  │      :3000           │               │  │
│  │                  │                      │               │  │
│  │                  │  Queries Prometheus  │               │  │
│  │                  │  Visualizes Data     │               │  │
│  │                  └──────────────────────┘               │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  VOLUMES (Persistent Storage)                                   │
│  /var/lib/docker/volumes/                                       │
│  ├── prometheus-monitoring_postgres-data/                      │
│  │   └── Database files, tables, indexes                       │
│  ├── prometheus-monitoring_prometheus-data/                    │
│  │   └── Time-series metrics (30 days)                         │
│  └── prometheus-monitoring_grafana-data/                       │
│      └── Dashboards, users, settings                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Service Dependencies Visualization

```
Start Order (Top to Bottom):

Level 1 (No Dependencies):
┌─────────────────┐
│    postgres     │  ← Starts first
│                 │
│ Health Check:   │
│ pg_isready      │
└────────┬────────┘
         │
         │ Waits for healthy
         ▼
Level 2 (Depends on postgres):
┌─────────────────┐       ┌─────────────────┐
│ postgres-       │       │   app-service   │  ← Start in parallel
│ exporter        │       │                 │
│                 │       │ (no dependencies│
│ Connects to     │       │  but has health │
│ postgres:5432   │       │  check)         │
└────────┬────────┘       └────────┬────────┘
         │                         │
         │                         │
         │                         │
         └──────────┬──────────────┘
                    │
                    │ Both running
                    ▼
Level 3 (Depends on both):
┌─────────────────────────────────┐
│         prometheus              │
│                                 │
│ Scrapes:                        │
│ - app-service:3000/metrics      │
│ - postgres-exporter:9187/metrics│
└────────────────┬────────────────┘
                 │
                 │ Running and collecting
                 ▼
Level 4 (Depends on prometheus):
┌─────────────────────────────────┐
│           grafana               │
│                                 │
│ Datasource:                     │
│ - prometheus:9090               │
│                                 │
│ Auto-loads:                     │
│ - Datasource config             │
│ - Dashboard JSONs               │
└─────────────────────────────────┘

ALL SERVICES NOW RUNNING ✓
```

---

## Volume Mounting Visualization

```
┌──────────────────────────────────────────────────────────────┐
│                    YOUR COMPUTER                             │
│                                                               │
│  Project Directory:                                          │
│  prometheus-monitoring/                                      │
│  ├── app-service/                                            │
│  │   ├── server.js ────────────┐                           │
│  │   ├── package.json          │                           │
│  │   └── Dockerfile            │                           │
│  │                              │                           │
│  ├── prometheus/                │                           │
│  │   ├── prometheus.yml ────┐  │                           │
│  │   └── alerts.yml         │  │                           │
│  │                          │  │                           │
│  ├── grafana/               │  │                           │
│  │   ├── datasources/       │  │                           │
│  │   │   └── prometheus.yml─┼──┼───┐                       │
│  │   └── dashboards/ ───────┼──┼───┼──┐                    │
│  │                          │  │   │  │                    │
│  └── postgres-exporter/     │  │   │  │                    │
│      ├── init.sql ────────┐ │  │   │  │                    │
│      └── queries.yaml ────┼─┼──┼───┼──┼──┐                 │
│                           │ │  │   │  │  │                 │
└───────────────────────────┼─┼──┼───┼──┼──┼─────────────────┘
                            │ │  │   │  │  │
                    MOUNTED │ │  │   │  │  │ INTO CONTAINERS
                            │ │  │   │  │  │
┌───────────────────────────┼─┼──┼───┼──┼──┼─────────────────┐
│              DOCKER       │ │  │   │  │  │                 │
│                           ▼ ▼  ▼   ▼  ▼  ▼                 │
│  ┌────────────────────────────────────────────────┐        │
│  │  postgres Container                            │        │
│  │  /docker-entrypoint-initdb.d/init.sql ◄────────┼────────┤ Read-only
│  └────────────────────────────────────────────────┘        │
│  ┌────────────────────────────────────────────────┐        │
│  │  postgres-exporter Container                   │        │
│  │  /etc/postgres-exporter/queries.yaml ◄─────────┼────────┤ Read-only
│  └────────────────────────────────────────────────┘        │
│  ┌────────────────────────────────────────────────┐        │
│  │  prometheus Container                          │        │
│  │  /etc/prometheus/prometheus.yml ◄──────────────┼────────┤ Read-only
│  │  /etc/prometheus/alerts.yml ◄──────────────────┘        │
│  └────────────────────────────────────────────────┘        │
│  ┌────────────────────────────────────────────────┐        │
│  │  grafana Container                             │        │
│  │  /etc/grafana/provisioning/datasources/ ◄──────┼────────┤ Read-only
│  │  /etc/grafana/provisioning/dashboards/ ◄───────┘        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  NAMED VOLUMES (Docker-Managed):                           │
│  /var/lib/docker/volumes/                                  │
│  ┌────────────────────────────────────────────────┐        │
│  │  postgres-data Volume                          │        │
│  │  Mounted to: postgres:/var/lib/postgresql/data │        │
│  │  Contains: Database files (persistent)         │        │
│  │  Size: ~50-100 MB                              │        │
│  └────────────────────────────────────────────────┘        │
│  ┌────────────────────────────────────────────────┐        │
│  │  prometheus-data Volume                        │        │
│  │  Mounted to: prometheus:/prometheus            │        │
│  │  Contains: Time-series metrics (30 days)       │        │
│  │  Size: ~1-5 GB                                 │        │
│  └────────────────────────────────────────────────┘        │
│  ┌────────────────────────────────────────────────┐        │
│  │  grafana-data Volume                           │        │
│  │  Mounted to: grafana:/var/lib/grafana          │        │
│  │  Contains: Dashboards, settings, users         │        │
│  │  Size: ~50-100 MB                              │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

KEY:
─►  Bind Mount (File/Directory from host → container)
     Changes on host immediately reflect in container
     Used for: Configuration files, source code

─►  Named Volume (Docker-managed storage)
     Persists data between container restarts
     Used for: Databases, metrics, application data
```

---

## Lifecycle Management

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE COMMANDS                   │
└─────────────────────────────────────────────────────────────┘

docker-compose up -d
│
├─► Creates: Network, Volumes
├─► Builds: Custom images
├─► Pulls: External images
├─► Starts: All containers
└─► Result: Stack running
         │
         │ YOUR STACK IS RUNNING
         ▼
    ┌─────────────────────┐
    │  5 Containers       │
    │  1 Network          │
    │  3 Volumes          │
    │  All Connected      │
    └──────────┬──────────┘
               │
               ├─► docker-compose ps
               │   Shows: Status of all services
               │
               ├─► docker-compose logs
               │   Shows: Output from all containers
               │
               ├─► docker-compose restart
               │   Restarts: All containers (keeps config)
               │
               ├─► docker-compose stop
               │   Stops: Containers (keeps everything)
               │   Can restart later with: docker-compose start
               │
               ├─► docker-compose down
               │   ├─► Stops containers
               │   ├─► Removes containers
               │   ├─► Removes network
               │   └─► Keeps volumes (data safe)
               │
               └─► docker-compose down -v
                   ├─► Stops containers
                   ├─► Removes containers
                   ├─► Removes network
                   └─► REMOVES VOLUMES (data deleted!)
```

---

## Data Persistence Explained

```
┌─────────────────────────────────────────────────────────────┐
│              CONTAINER WITHOUT VOLUME                        │
│                                                               │
│  ┌─────────────────────────────────────┐                    │
│  │  Container Filesystem (Temporary)    │                    │
│  │  ┌────────────────────────────────┐ │                    │
│  │  │  /var/lib/postgresql/data      │ │                    │
│  │  │  ├── table1.db                 │ │                    │
│  │  │  ├── table2.db                 │ │                    │
│  │  │  └── indexes/                  │ │                    │
│  │  └────────────────────────────────┘ │                    │
│  └─────────────────────────────────────┘                    │
│                  │                                            │
│                  │ docker-compose down                        │
│                  ▼                                            │
│           ❌ ALL DATA LOST!                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               CONTAINER WITH VOLUME                          │
│                                                               │
│  ┌─────────────────────────────────────┐                    │
│  │  Container Filesystem               │                    │
│  │  ┌────────────────────────────────┐ │                    │
│  │  │  /var/lib/postgresql/data      │ │                    │
│  │  │         │                       │ │                    │
│  │  │         │ Mounted From          │ │                    │
│  │  │         ▼                       │ │                    │
│  │  └─────────┼───────────────────────┘ │                    │
│  └────────────┼─────────────────────────┘                    │
│               │                                               │
│               │ Volume Mount                                  │
│               ▼                                               │
│  ┌──────────────────────────────────────┐                   │
│  │  Docker Volume (Persistent)          │                   │
│  │  /var/lib/docker/volumes/postgres-   │                   │
│  │  data/_data/                          │                   │
│  │  ├── table1.db                        │                   │
│  │  ├── table2.db                        │                   │
│  │  └── indexes/                         │                   │
│  └──────────────────────────────────────┘                   │
│                  │                                            │
│                  │ docker-compose down                        │
│                  ▼                                            │
│  ┌──────────────────────────────────────┐                   │
│  │  ✓ Data Still Exists in Volume!      │                   │
│  │  Can restart container and data       │                   │
│  │  will be there                        │                   │
│  └──────────────────────────────────────┘                   │
│                  │                                            │
│                  │ docker-compose up -d                       │
│                  ▼                                            │
│  ┌──────────────────────────────────────┐                   │
│  │  ✓ Container starts with existing    │                   │
│  │    data from volume                   │                   │
│  └──────────────────────────────────────┘                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Docker Compose File Structure Breakdown

```
docker-compose.yml
│
├─► version: '3.8'
│   │
│   └─► Specifies Docker Compose syntax version
│
├─► services:
│   │
│   ├─► app-service:
│   │   ├─► build: ./app-service
│   │   │   └─► Build from Dockerfile
│   │   ├─► ports: ["3000:3000"]
│   │   │   └─► Map host port → container port
│   │   ├─► networks: [monitoring]
│   │   │   └─► Connect to network
│   │   └─► volumes: [...]
│   │       └─► Mount files/directories
│   │
│   ├─► postgres:
│   │   ├─► image: postgres:15-alpine
│   │   │   └─► Use pre-built image
│   │   ├─► environment:
│   │   │   └─► Set env variables
│   │   ├─► volumes:
│   │   │   ├─► Named: postgres-data:/var/lib/postgresql/data
│   │   │   │   └─► Persistent storage
│   │   │   └─► Bind: ./init.sql:/docker-entrypoint-initdb.d/
│   │   │       └─► Mount config file
│   │   └─► healthcheck:
│   │       └─► Monitor container health
│   │
│   ├─► postgres-exporter:
│   │   ├─► image: prometheuscommunity/postgres-exporter
│   │   ├─► depends_on:
│   │   │   └─► postgres: {condition: service_healthy}
│   │   │       └─► Wait for postgres to be healthy
│   │   └─► environment:
│   │       └─► Connection string to postgres
│   │
│   ├─► prometheus:
│   │   ├─► image: prom/prometheus:latest
│   │   ├─► command: [...]
│   │   │   └─► Override container command
│   │   ├─► volumes:
│   │   │   ├─► ./prometheus.yml:/etc/prometheus/prometheus.yml
│   │   │   └─► prometheus-data:/prometheus
│   │   └─► depends_on: [app-service, postgres-exporter]
│   │       └─► Wait for data sources
│   │
│   └─► grafana:
│       ├─► image: grafana/grafana:latest
│       ├─► environment:
│       │   └─► Admin credentials, settings
│       ├─► volumes:
│       │   ├─► grafana-data:/var/lib/grafana
│       │   ├─► ./datasources:/etc/grafana/provisioning/datasources
│       │   └─► ./dashboards:/etc/grafana/provisioning/dashboards
│       └─► depends_on: [prometheus]
│
├─► networks:
│   └─► monitoring:
│       └─► driver: bridge
│           └─► Creates virtual network for containers
│
└─► volumes:
    ├─► postgres-data:
    │   └─► Docker-managed volume for PostgreSQL
    ├─► prometheus-data:
    │   └─► Docker-managed volume for Prometheus
    └─► grafana-data:
        └─► Docker-managed volume for Grafana
```

---

## Comparison: Manual vs Docker Compose

```
MANUAL APPROACH:
┌─────────────────────────────────────────────────────────────┐
│  You (Human)                                                 │
│     │                                                        │
│     ├─► Remember: Need 5 services                           │
│     ├─► Remember: Correct startup order                     │
│     ├─► Remember: All command flags                         │
│     ├─► Type: docker network create ...                     │
│     ├─► Type: docker volume create ... (×3)                 │
│     ├─► Type: docker run ... (×5, each 3-10 lines)         │
│     ├─► Wait: For each service to start                     │
│     ├─► Check: Logs for errors (×5)                         │
│     └─► Hope: Everything works                              │
│                                                              │
│  Total: ~80 lines of commands                               │
│  Time: 10-15 minutes                                        │
│  Errors: Likely (typos, wrong order, forgot flags)         │
└─────────────────────────────────────────────────────────────┘

DOCKER COMPOSE APPROACH:
┌─────────────────────────────────────────────────────────────┐
│  You (Human)                                                 │
│     │                                                        │
│     └─► Type: docker-compose up -d                          │
│           │                                                  │
│           ▼                                                  │
│  Docker Compose (Automation)                                │
│     │                                                        │
│     ├─► Reads: docker-compose.yml                           │
│     ├─► Creates: Networks, volumes automatically            │
│     ├─► Builds: Images as needed                            │
│     ├─► Starts: Services in correct order                   │
│     ├─► Waits: For dependencies automatically               │
│     ├─► Monitors: Health checks                             │
│     └─► Reports: Status                                     │
│                                                              │
│  Total: 1 command                                           │
│  Time: 30-60 seconds                                        │
│  Errors: Rare (configuration is tested and version-         │
│          controlled)                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

**Docker Compose is your orchestrator that:**

1. ✅ Reads configuration from YAML file
2. ✅ Creates infrastructure (networks, volumes)
3. ✅ Builds/pulls images
4. ✅ Starts containers in correct order
5. ✅ Manages dependencies
6. ✅ Provides simple commands for lifecycle management
7. ✅ Makes entire stack portable and reproducible

**Result:** Complex multi-container app → Single command!
