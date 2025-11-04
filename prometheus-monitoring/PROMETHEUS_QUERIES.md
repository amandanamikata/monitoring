# Prometheus Query Examples

This document contains useful PromQL queries for the monitoring stack.

## HTTP/Request Metrics

### Request Rate
```promql
# Overall request rate (requests per second)
rate(http_requests_total[5m])

# Request rate by route
sum by(route) (rate(http_requests_total[5m]))

# Request rate by status code
sum by(status_code) (rate(http_requests_total[5m]))

# Error rate (4xx and 5xx)
sum(rate(http_requests_total{status_code=~"4..|5.."}[5m]))
```

### Request Latency
```promql
# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# 99th percentile latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Median latency (50th percentile)
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))

# Average latency
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# Latency by route
histogram_quantile(0.95, sum by(route, le) (rate(http_request_duration_seconds_bucket[5m])))
```

### Error Metrics
```promql
# Error rate
rate(application_errors_total[5m])

# Errors by type
sum by(error_type) (application_errors_total)

# Critical errors only
rate(application_errors_total{severity="critical"}[5m])

# Error percentage
sum(rate(application_errors_total[5m])) / sum(rate(http_requests_total[5m])) * 100
```

## Business Metrics

### Orders
```promql
# Total orders by status
sum by(status) (orders_total)

# Order rate
rate(orders_total[5m])

# Failed order rate
rate(orders_total{status="failed"}[5m])

# Completed orders in last hour
increase(orders_total{status="completed"}[1h])

# Order completion rate
sum(rate(orders_total{status="completed"}[5m])) / sum(rate(orders_total[5m])) * 100
```

### Revenue
```promql
# Total revenue by category
sum by(product_category) (revenue_total_dollars)

# Revenue rate (dollars per second)
rate(revenue_total_dollars[5m])

# Revenue in last hour
increase(revenue_total_dollars[1h])

# Average order value
sum(revenue_total_dollars) / sum(orders_total{status="completed"})
```

### Users
```promql
# Current active users
sum(active_users_current)

# Active users by type
active_users_current

# User registration rate
rate(user_registrations_total[5m])

# Registrations by method
sum by(registration_method) (user_registrations_total)

# Premium vs free users
active_users_current{user_type="premium"} / sum(active_users_current)
```

## Application Performance

### Cache Performance
```promql
# Cache hit rate
sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))

# Cache hit rate by type
sum by(cache_type) (rate(cache_hits_total[5m])) /
(sum by(cache_type) (rate(cache_hits_total[5m])) + sum by(cache_type) (rate(cache_misses_total[5m])))

# Cache misses
rate(cache_misses_total[5m])
```

### Database Queries
```promql
# Query latency (95th percentile)
histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))

# Query rate by type
sum by(query_type) (rate(database_query_duration_seconds_count[5m]))

# Slow queries (>1s)
sum(rate(database_query_duration_seconds_bucket{le="1.0"}[5m])) -
sum(rate(database_query_duration_seconds_bucket{le="+Inf"}[5m]))
```

### Connections and Queues
```promql
# Active connections by type
active_connections_current

# Total connections
sum(active_connections_current)

# Queue size by queue name
queue_size_current

# Queue growth rate
deriv(queue_size_current[5m])
```

## Node.js Runtime Metrics

### Memory
```promql
# Process memory usage
process_resident_memory_bytes

# Heap usage
nodejs_heap_size_used_bytes

# Heap usage percentage
nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes * 100

# Memory growth rate (MB per minute)
rate(process_resident_memory_bytes[5m]) * 60 / 1024 / 1024
```

### CPU
```promql
# CPU usage (0-1 scale)
rate(process_cpu_seconds_total[5m])

# CPU usage percentage
rate(process_cpu_seconds_total[5m]) * 100
```

### Event Loop
```promql
# Event loop lag
nodejs_eventloop_lag_seconds

# Event loop lag > 100ms
nodejs_eventloop_lag_seconds > 0.1
```

## PostgreSQL Metrics

### Database Size and Connections
```promql
# Database size
pg_database_size_bytes{datname="enterprise_db"}

# Database size in GB
pg_database_size_bytes{datname="enterprise_db"} / 1024 / 1024 / 1024

# Active connections
sum(pg_stat_activity_connections)

# Connections by state
pg_stat_activity_connections

# Connection saturation (assuming max 100 connections)
sum(pg_stat_activity_connections) / 100 * 100
```

### Query Performance
```promql
# Slow queries count
pg_slow_queries_slow_queries

# Cache hit ratio
pg_cache_hit_ratio_ratio

# Cache hit ratio percentage
pg_cache_hit_ratio_ratio * 100
```

### Table Statistics
```promql
# Sequential scans (potential performance issue)
rate(pg_stat_user_tables_seq_scan[5m])

# Index scans (good!)
rate(pg_stat_user_tables_idx_scan[5m])

# Index scan ratio
sum(rate(pg_stat_user_tables_idx_scan[5m])) /
(sum(rate(pg_stat_user_tables_idx_scan[5m])) + sum(rate(pg_stat_user_tables_seq_scan[5m])))

# Dead tuples (need vacuum)
pg_stat_user_tables_n_dead_tup

# Dead tuple ratio
pg_stat_user_tables_n_dead_tup / (pg_stat_user_tables_n_live_tup + pg_stat_user_tables_n_dead_tup)
```

### Table Operations
```promql
# Insert rate
rate(pg_stat_user_tables_n_tup_ins[5m])

# Update rate
rate(pg_stat_user_tables_n_tup_upd[5m])

# Delete rate
rate(pg_stat_user_tables_n_tup_del[5m])

# Total write operations
rate(pg_stat_user_tables_n_tup_ins[5m]) +
rate(pg_stat_user_tables_n_tup_upd[5m]) +
rate(pg_stat_user_tables_n_tup_del[5m])
```

### Database Locks
```promql
# Total locks
sum(pg_locks_count_locks)

# Locks by mode
pg_locks_count_locks

# Exclusive locks (potential contention)
pg_locks_count_locks{mode=~".*Exclusive.*"}
```

### Business Metrics from Database
```promql
# Orders by status
business_orders_by_status_count

# Total revenue by order status
business_orders_by_status_total_amount

# Users by account type
business_users_by_type_count

# Product stock levels
business_product_stock_stock_quantity

# Low stock products (<20 items)
business_product_stock_stock_quantity < 20

# Daily revenue
business_daily_revenue_revenue
```

## System Health

### Service Availability
```promql
# All services up
up

# Specific service status
up{job="enterprise-app"}
up{job="postgresql"}

# Services down count
count(up == 0)
```

### Scrape Performance
```promql
# Scrape duration
scrape_duration_seconds

# Failed scrapes
scrape_samples_scraped == 0

# Scrape frequency
rate(scrape_duration_seconds_count[5m])
```

## Alerting Queries

### Critical Alerts
```promql
# High error rate (>10% of requests)
sum(rate(application_errors_total[5m])) / sum(rate(http_requests_total[5m])) > 0.1

# Service down
up == 0

# High latency (p95 > 2s)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2

# High memory usage (>80% of 4GB)
process_resident_memory_bytes > 3221225472

# Many slow queries
pg_slow_queries_slow_queries > 10
```

### Warning Alerts
```promql
# Low cache hit rate (<50%)
sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m]))) < 0.5

# High database connections (>80)
sum(pg_stat_activity_connections) > 80

# High dead tuples (>1000)
pg_stat_user_tables_n_dead_tup > 1000

# Growing queue size
deriv(queue_size_current[5m]) > 0

# Event loop lag (>100ms)
nodejs_eventloop_lag_seconds > 0.1
```

## Advanced Queries

### Rate of Change
```promql
# Memory growth rate (bytes per second)
rate(process_resident_memory_bytes[5m])

# Order growth acceleration
deriv(rate(orders_total[5m])[10m:1m])
```

### Percentages
```promql
# Error percentage
sum(rate(application_errors_total[5m])) / sum(rate(http_requests_total[5m])) * 100

# Failed order percentage
sum(orders_total{status="failed"}) / sum(orders_total) * 100

# Premium user percentage
sum(active_users_current{user_type="premium"}) / sum(active_users_current) * 100
```

### Aggregations
```promql
# Top 5 routes by request count
topk(5, sum by(route) (http_requests_total))

# Bottom 5 products by stock
bottomk(5, business_product_stock_stock_quantity)

# Average across all instances
avg(rate(http_requests_total[5m]))

# Standard deviation of latency
stddev(histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])))
```

### Predictions
```promql
# Predict memory usage in 1 hour (linear regression)
predict_linear(process_resident_memory_bytes[1h], 3600)

# Predict when disk will be full (database size)
predict_linear(pg_database_size_bytes[1h], 3600 * 24) > 10737418240
```

## Tips

1. **Always use rate() for counters**
   - Counters always increase, rate() gives you per-second rate
   - `rate(metric[5m])` not just `metric`

2. **Choose appropriate time ranges**
   - Short ranges (1m-5m) for real-time monitoring
   - Longer ranges (1h-1d) for trends and predictions

3. **Use labels for filtering**
   - `{label="value"}` to filter specific metrics
   - `{label=~"regex"}` for pattern matching

4. **Aggregate wisely**
   - `sum by(label)` keeps specified labels
   - `sum without(label)` removes specified labels

5. **Test queries in Prometheus UI**
   - Go to http://localhost:9090
   - Use the query builder for complex queries
   - Check execution time for performance
