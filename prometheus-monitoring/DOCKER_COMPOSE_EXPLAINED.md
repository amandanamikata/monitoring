# Docker Compose: Complete Explanation

## Table of Contents
- [What is Docker Compose?](#what-is-docker-compose)
- [Why Do We Need Docker Compose?](#why-do-we-need-docker-compose)
- [The Problem It Solves](#the-problem-it-solves)
- [How Docker Compose Works](#how-docker-compose-works)
- [Without vs With Docker Compose](#without-vs-with-docker-compose)
- [Key Concepts](#key-concepts)
- [Docker Compose File Structure](#docker-compose-file-structure)
- [Common Commands](#common-commands)
- [Real-World Benefits](#real-world-benefits)

---

## What is Docker Compose?

**Docker Compose** is a tool for defining and running multi-container Docker applications. Instead of running multiple `docker run` commands, you define all your services in a single YAML file and start them all with one command.

### Simple Analogy

Think of Docker Compose like a **restaurant recipe book**:

- **Docker** = Individual ingredients and cooking techniques
- **Docker Compose** = The complete recipe that tells you:
  - Which ingredients you need (containers)
  - How much of each (configuration)
  - In what order to combine them (dependencies)
  - How they should work together (networking)

---

## Why Do We Need Docker Compose?

### Problem 1: Managing Multiple Containers Manually

In a modern application, you typically need multiple services:
- Web application
- Database
- Cache (Redis)
- Message queue
- Monitoring tools

Without Docker Compose, you'd need to:
1. Run each container individually
2. Remember all the configurations
3. Manually create networks
4. Manually create volumes
5. Remember the startup order
6. Type dozens of commands

### Problem 2: Environment Consistency

Different developers or environments might:
- Use different ports
- Use different environment variables
- Miss dependencies
- Start services in wrong order

### Problem 3: Documentation

Without a compose file, you need separate documentation explaining:
- Which containers to run
- How to configure them
- How they connect together

---

## The Problem It Solves

### Scenario: Our Monitoring Stack

Our project has **5 services**:
1. Node.js application
2. PostgreSQL database
3. Postgres exporter
4. Prometheus
5. Grafana

**WITHOUT Docker Compose**, you'd need these commands:

```bash
# 1. Create a network first
docker network create monitoring-network

# 2. Create volumes
docker volume create postgres-data
docker volume create prometheus-data
docker volume create grafana-data

# 3. Start PostgreSQL
docker run -d \
  --name postgres-db \
  --network monitoring-network \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -v postgres-data:/var/lib/postgresql/data \
  -v $(pwd)/postgres-exporter/init.sql:/docker-entrypoint-initdb.d/init.sql \
  postgres:15-alpine

# 4. Wait for postgres to be ready (manually)
sleep 10

# 5. Start postgres exporter
docker run -d \
  --name postgres-exporter \
  --network monitoring-network \
  -p 9187:9187 \
  -e DATA_SOURCE_NAME="postgresql://postgres_exporter:exporter_password@postgres-db:5432/enterprise_db?sslmode=disable" \
  -v $(pwd)/postgres-exporter/queries.yaml:/etc/postgres-exporter/queries.yaml:ro \
  prometheuscommunity/postgres-exporter:latest

# 6. Build and start the application
cd app-service
docker build -t enterprise-app .
cd ..
docker run -d \
  --name enterprise-app \
  --network monitoring-network \
  -p 3000:3000 \
  enterprise-app

# 7. Start Prometheus
docker run -d \
  --name prometheus \
  --network monitoring-network \
  -p 9090:9090 \
  -v $(pwd)/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro \
  -v $(pwd)/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro \
  -v prometheus-data:/prometheus \
  prom/prometheus:latest \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --web.console.libraries=/etc/prometheus/console_libraries \
  --web.console.templates=/etc/prometheus/consoles \
  --storage.tsdb.retention.time=30d \
  --web.enable-lifecycle

# 8. Start Grafana
docker run -d \
  --name grafana \
  --network monitoring-network \
  -p 3001:3000 \
  -e GF_SECURITY_ADMIN_USER=admin \
  -e GF_SECURITY_ADMIN_PASSWORD=admin \
  -e GF_USERS_ALLOW_SIGN_UP=false \
  -v grafana-data:/var/lib/grafana \
  -v $(pwd)/grafana/datasources:/etc/grafana/provisioning/datasources:ro \
  -v $(pwd)/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro \
  grafana/grafana:latest
```

**That's over 60 lines of commands!** And you need to remember all of this every time.

**WITH Docker Compose**, you need ONE command:

```bash
docker-compose up -d
```

That's it! All 5 services start, properly networked, with correct dependencies.

---

## How Docker Compose Works

### 1. Definition Phase (docker-compose.yml)

You create a YAML file that defines:
- Services (containers)
- Networks
- Volumes
- Environment variables
- Dependencies
- Build instructions

### 2. Execution Phase (docker-compose up)

Docker Compose reads the file and:
1. **Creates networks** defined in the file
2. **Creates volumes** defined in the file
3. **Builds images** if needed (from Dockerfile)
4. **Pulls images** from Docker Hub if needed
5. **Starts containers** in dependency order
6. **Connects containers** to networks
7. **Mounts volumes** to containers
8. **Sets environment variables**
9. **Exposes ports** to host machine

### 3. Docker Compose Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR COMPUTER (HOST)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Docker Compose (Orchestrator)                │  │
│  │  Reads: docker-compose.yml                                │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │                                            │
│                     ├─── Creates Networks                        │
│                     ├─── Creates Volumes                         │
│                     └─── Manages Containers                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Docker Engine (Container Runtime)               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                     │                                            │
│        ┌────────────┼────────────┬──────────┬──────────┐        │
│        ▼            ▼            ▼          ▼          ▼        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  App    │ │Postgres │ │Postgres │ │Prometheus│ │Grafana │  │
│  │Container│ │Container│ │Exporter │ │Container│ │Container│  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│       │          │            │           │           │         │
│       └──────────┴────────────┴───────────┴───────────┘         │
│                      │                                           │
│               ┌──────┴──────┐                                   │
│               │   Network   │                                   │
│               │ (monitoring)│                                   │
│               └─────────────┘                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Without vs With Docker Compose

### Example: Starting Just PostgreSQL

#### WITHOUT Docker Compose (Docker CLI)
```bash
# Step 1: Create network
docker network create monitoring-network

# Step 2: Create volume
docker volume create postgres-data

# Step 3: Run container
docker run -d \
  --name postgres-db \
  --network monitoring-network \
  --restart unless-stopped \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -v postgres-data:/var/lib/postgresql/data \
  -v /home/user/init.sql:/docker-entrypoint-initdb.d/init.sql \
  --health-cmd "pg_isready -U postgres" \
  --health-interval 10s \
  --health-timeout 5s \
  --health-retries 5 \
  postgres:15-alpine

# Step 4: Check if running
docker ps

# Step 5: Check logs
docker logs postgres-db
```

**Problems:**
- ❌ Long command with many options
- ❌ Easy to make typos
- ❌ Hard to remember all flags
- ❌ Need to manage network/volumes separately
- ❌ No documentation of configuration
- ❌ Hard to share with team

#### WITH Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: postgres-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - monitoring
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

networks:
  monitoring:
    driver: bridge

volumes:
  postgres-data:
```

```bash
# Start everything
docker-compose up -d

# Check status
docker-compose ps

# Check logs
docker-compose logs postgres
```

**Benefits:**
- ✅ Readable and documented
- ✅ Version controlled
- ✅ Easy to modify
- ✅ Shareable with team
- ✅ Consistent across environments
- ✅ One command to start/stop

---

## Key Concepts

### 1. Services

A **service** is a container definition. Each service becomes one or more containers.

```yaml
services:
  web:        # Service name
    image: nginx

  database:   # Another service
    image: postgres
```

### 2. Networks

**Networks** allow containers to communicate with each other.

```yaml
networks:
  frontend:   # Network for web-facing services
  backend:    # Network for internal services
```

Containers on the same network can reach each other by **service name**:
```javascript
// Inside 'web' container, can connect to database:
const db = connect('postgresql://database:5432/mydb')
//                            ↑
//                     Service name = hostname
```

### 3. Volumes

**Volumes** persist data even when containers are deleted.

```yaml
volumes:
  postgres-data:   # Named volume (managed by Docker)
  app-logs:        # Another volume
```

Types of volumes:
- **Named volumes**: `postgres-data:/var/lib/postgresql/data`
- **Bind mounts**: `./config.yml:/etc/app/config.yml`
- **Anonymous volumes**: `/var/lib/data`

### 4. Environment Variables

Pass configuration to containers:

```yaml
environment:
  DATABASE_URL: postgresql://db:5432/mydb
  NODE_ENV: production
  API_KEY: secret123
```

### 5. Ports

Expose container ports to host machine:

```yaml
ports:
  - "3000:3000"   # host:container
  - "8080:80"     # Map port 8080 on host to port 80 in container
```

### 6. Dependencies

Control startup order:

```yaml
services:
  web:
    depends_on:
      - database   # Start database before web
```

### 7. Health Checks

Monitor container health:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

---

## Docker Compose File Structure

```yaml
# Version of Docker Compose syntax
version: '3.8'

# Define all your containers here
services:

  # First service (container)
  service-name:
    # How to get the image
    image: nginx:latest          # Pull from Docker Hub
    # OR
    build: ./app-directory       # Build from Dockerfile

    # Container name (optional, defaults to projectname_servicename_1)
    container_name: my-nginx

    # Ports to expose (host:container)
    ports:
      - "8080:80"

    # Environment variables
    environment:
      ENV_VAR: value

    # Volumes to mount
    volumes:
      - data:/var/data           # Named volume
      - ./config:/etc/config:ro  # Bind mount (read-only)

    # Networks to join
    networks:
      - frontend

    # Other services this depends on
    depends_on:
      - database

    # Restart policy
    restart: unless-stopped

    # Health check
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Second service
  database:
    image: postgres:15
    # ... more configuration

# Define networks
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge

# Define volumes
volumes:
  data:
  logs:
```

---

## Common Commands

### Starting Services

```bash
# Start all services in background
docker-compose up -d

# Start all services in foreground (see logs)
docker-compose up

# Start specific service
docker-compose up -d app-service

# Build and start
docker-compose up -d --build

# Force recreate containers
docker-compose up -d --force-recreate
```

### Stopping Services

```bash
# Stop all services (containers remain)
docker-compose stop

# Stop specific service
docker-compose stop app-service

# Stop and remove containers
docker-compose down

# Stop, remove containers AND volumes (deletes data)
docker-compose down -v

# Stop, remove containers and images
docker-compose down --rmi all
```

### Viewing Status

```bash
# List running services
docker-compose ps

# View logs from all services
docker-compose logs

# View logs from specific service
docker-compose logs app-service

# Follow logs (like tail -f)
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100
```

### Managing Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart app-service

# Pause services (freeze execution)
docker-compose pause

# Unpause services
docker-compose unpause

# Execute command in running container
docker-compose exec app-service bash

# Run one-off command
docker-compose run app-service npm test
```

### Building and Pulling

```bash
# Build all services with build: directive
docker-compose build

# Build specific service
docker-compose build app-service

# Build without cache
docker-compose build --no-cache

# Pull latest images
docker-compose pull
```

### Scaling Services

```bash
# Run 3 instances of a service
docker-compose up -d --scale app-service=3

# Scale multiple services
docker-compose up -d --scale app=3 --scale worker=5
```

### Configuration

```bash
# Validate compose file
docker-compose config

# View merged configuration
docker-compose config

# View configuration for specific service
docker-compose config app-service
```

---

## Real-World Benefits

### 1. Development Environment

**Before Docker Compose:**
```
New developer joins team:
1. Install PostgreSQL on their machine
2. Install Redis
3. Install Node.js (correct version)
4. Install Python (correct version)
5. Configure everything
6. Hope it works
Time: 2-4 hours, many issues
```

**With Docker Compose:**
```bash
git clone repo
cd repo
docker-compose up -d
# Done! Everything works.
Time: 5 minutes
```

### 2. CI/CD Pipelines

```yaml
# .github/workflows/test.yml
name: Run Tests

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Start services
        run: docker-compose up -d
      - name: Run tests
        run: docker-compose exec -T app npm test
      - name: Cleanup
        run: docker-compose down
```

### 3. Multiple Environments

```bash
# Development
docker-compose -f docker-compose.yml up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up

# Testing
docker-compose -f docker-compose.yml -f docker-compose.test.yml up
```

### 4. Documentation

The `docker-compose.yml` file serves as living documentation:
- What services are needed?
- How are they configured?
- How do they connect?
- What ports are used?

Anyone can read the file and understand the architecture.

---

## How Our Monitoring Stack Uses Docker Compose

Let's break down our specific use case:

### What Docker Compose Does for Us

```yaml
version: '3.8'

services:
  # 1. Builds our Node.js application from source
  app-service:
    build: ./app-service
    ports:
      - "3000:3000"
    networks:
      - monitoring

  # 2. Starts PostgreSQL with initialization
  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./postgres-exporter/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - monitoring

  # 3. Starts exporter after database is ready
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - monitoring

  # 4. Starts Prometheus with our config
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    depends_on:
      - app-service
      - postgres-exporter
    networks:
      - monitoring

  # 5. Starts Grafana with auto-configured dashboards
  grafana:
    image: grafana/grafana:latest
    volumes:
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
    networks:
      - monitoring

# All containers can communicate via 'monitoring' network
networks:
  monitoring:
    driver: bridge

# Data persists even when containers are removed
volumes:
  postgres-data:
  prometheus-data:
  grafana-data:
```

### What Happens When You Run `docker-compose up -d`

```
1. Docker Compose reads docker-compose.yml
2. Creates network: monitoring
3. Creates volumes: postgres-data, prometheus-data, grafana-data
4. Builds app-service from ./app-service/Dockerfile
5. Pulls images: postgres:15-alpine, postgres_exporter, prometheus, grafana
6. Starts postgres container
   ├─ Runs init.sql to create database
   ├─ Waits for health check to pass
7. Starts app-service container
   ├─ Connects to monitoring network
8. Starts postgres-exporter container
   ├─ Waits for postgres to be healthy (depends_on)
   ├─ Connects to postgres
   ├─ Exposes metrics
9. Starts prometheus container
   ├─ Waits for app-service and postgres-exporter
   ├─ Reads prometheus.yml
   ├─ Starts scraping metrics
10. Starts grafana container
    ├─ Waits for prometheus
    ├─ Auto-configures datasource
    ├─ Loads dashboards

All done! Stack is running.
```

---

## Comparison: Manual vs Docker Compose

| Task | Manual Docker Commands | Docker Compose |
|------|----------------------|----------------|
| Start services | 10+ commands | `docker-compose up -d` |
| Stop services | `docker stop` for each | `docker-compose down` |
| Restart service | `docker restart name` | `docker-compose restart service` |
| View logs | `docker logs name` | `docker-compose logs service` |
| Update config | Stop, remove, recreate | `docker-compose up -d` |
| Share with team | Document all commands | Share docker-compose.yml |
| Networking | Manually create network | Automatic |
| Volumes | Manually create volume | Automatic |
| Dependencies | Manual ordering | Automatic with depends_on |
| Environment vars | Long -e flags | Clean YAML format |
| Consistency | Varies by user | Identical everywhere |

---

## When to Use Docker Compose

### ✅ Use Docker Compose When:

- Running multiple containers that work together
- Need consistent development environments
- Want to version control infrastructure
- Testing locally before deploying
- Running integration tests
- Prototyping microservices
- Teaching/learning Docker

### ❌ Don't Use Docker Compose When:

- Production orchestration (use Kubernetes, Docker Swarm, ECS)
- Single container applications (just use `docker run`)
- Need advanced scheduling/scaling
- Multi-host deployments
- Need high availability features

---

## Summary

**Docker Compose is essential because:**

1. ✅ **Simplicity**: One command instead of dozens
2. ✅ **Consistency**: Same environment everywhere
3. ✅ **Documentation**: Configuration as code
4. ✅ **Version Control**: Track infrastructure changes
5. ✅ **Portability**: Works on any machine with Docker
6. ✅ **Efficiency**: Faster development and testing
7. ✅ **Collaboration**: Easy to share with team
8. ✅ **Automation**: Perfect for CI/CD pipelines

**For our monitoring project:**
- Without Docker Compose: 60+ lines of commands, easy to make mistakes
- With Docker Compose: 1 command, guaranteed to work

That's why Docker Compose is the standard tool for multi-container applications!
