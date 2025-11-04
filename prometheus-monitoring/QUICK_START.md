# Quick Start Guide

## 1. Start Everything
```bash
cd prometheus-monitoring
docker-compose up -d
```

## 2. Wait for Services (30 seconds)
```bash
docker-compose ps
```

## 3. Access Services

| Service | URL | Login |
|---------|-----|-------|
| Application | http://localhost:3000 | - |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3001 | admin/admin |

## 4. Generate Test Data
```bash
# Generate orders
for i in {1..50}; do curl -X POST http://localhost:3000/api/orders; done

# Generate user registrations
for i in {1..30}; do curl -X POST http://localhost:3000/api/users/register; done
```

## 5. View Dashboards in Grafana

1. Go to http://localhost:3001
2. Login: `admin` / `admin`
3. Click **Dashboards** → **Browse**
4. Open:
   - **Enterprise Application Metrics**
   - **PostgreSQL Database Metrics (via Exporter)**

## 6. View Metrics in Prometheus

1. Go to http://localhost:9090
2. Try these queries:

```promql
# Request rate
rate(http_requests_total[5m])

# Active users
active_users_current

# Database connections
pg_stat_activity_connections

# Orders by status
sum by(status) (orders_total)
```

## Key Differences

### Direct Scraping (Node.js App)
- ✅ Metrics at: http://localhost:3000/metrics
- ✅ No exporter needed
- ✅ App has built-in Prometheus client
- ✅ Scraped directly by Prometheus

### Exporter Pattern (PostgreSQL)
- ✅ Metrics at: http://localhost:9187/metrics
- ✅ Uses postgres_exporter as bridge
- ✅ PostgreSQL doesn't speak Prometheus natively
- ✅ Exporter translates SQL to Prometheus format

## Troubleshooting

**Services not starting?**
```bash
docker-compose logs
```

**No metrics in Grafana?**
- Wait 30 seconds for initial scrape
- Check Prometheus targets: http://localhost:9090/targets
- All should show "UP"

**Port conflicts?**
```bash
# Check what's using the port
sudo lsof -i :3000
```

## Stop Everything
```bash
docker-compose down

# Or remove all data
docker-compose down -v
```
