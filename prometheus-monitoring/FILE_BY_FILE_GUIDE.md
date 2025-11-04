# Complete File-by-File Guide with Line-by-Line Explanations

This document explains EVERY file in the monitoring project with detailed comments.

---

## ✅ Already Fully Commented Files

### 1. **app-service/server.js** (910 lines with comments)
- **What**: Node.js application with built-in Prometheus metrics
- **Key Sections**:
  - Imports and dependencies (lines 22-36)
  - Prometheus registry setup (lines 38-80)
  - Metric definitions by type (lines 82-409)
  - Metric registration (lines 411-434)
  - Express middleware for auto-tracking (lines 436-507)
  - **/metrics endpoint** (lines 509-551) - THE MOST IMPORTANT
  - Application endpoints (lines 553-786)
  - Background simulation (lines 788-840)
  - Server startup (lines 842-883)
- **How Prometheus Uses It**: Scrapes `http://app-service:3000/metrics` every 10-30s
- **Direct Scraping**: No exporter needed!

### 2. **app-service/package.json** (63 lines with comments)
- **What**: Node.js dependency and script definition
- **Key Fields**:
  - `name`: Application identifier
  - `dependencies`: express (web framework) + prom-client (Prometheus library)
  - `scripts.start`: Command to run the app
- **How Used**: `npm install` reads this, `Docker` uses it during build

### 3. **app-service/Dockerfile** (397 lines with comments)
- **What**: Instructions to build Docker image
- **Key Instructions**:
  - `FROM node:18-alpine`: Base image (40MB Alpine Linux)
  - `WORKDIR /app`: Set working directory
  - `COPY package.json`: Copy dependencies first (caching optimization!)
  - `RUN npm install --production`: Install packages
  - `COPY .`: Copy source code
  - `EXPOSE 3000`: Document port
  - `HEALTHCHECK`: Automated health monitoring
  - `CMD ["node", "server.js"]`: Start command
- **Layer Caching**: Explained why package.json is copied before source code

### 4. **docker-compose.yml** (853 lines with comments)
- **What**: Orchestrates all 5 services
- **Services Explained**:
  - app-service: Build from Dockerfile, direct Prometheus scraping
  - postgres: Database, no native metrics
  - postgres-exporter: Translator between PostgreSQL and Prometheus
  - prometheus: Metrics collector and storage
  - grafana: Visualization
- **Networks**: How containers communicate
- **Volumes**: Data persistence explained
- **Every single line** has inline comments

---

## 📂 PostgreSQL Files (Exporter Pattern)

### 5. **postgres-exporter/init.sql**

```sql
-- ==============================================================================
-- POSTGRESQL DATABASE INITIALIZATION SCRIPT
-- ==============================================================================
--
-- WHAT THIS FILE DOES:
-- This script runs automatically when PostgreSQL container first starts.
-- It creates the database schema, tables, sample data, and users.
--
-- WHY IT RUNS AUTOMATICALLY:
-- PostgreSQL Docker image has special directory: /docker-entrypoint-initdb.d/
-- Any .sql files in that directory are executed on first startup (only once)
-- docker-compose.yml mounts this file there:
--   volumes:
--     - ./postgres-exporter/init.sql:/docker-entrypoint-initdb.d/init.sql
--
-- WHEN IT RUNS:
-- 1. docker-compose up
-- 2. postgres container starts for the FIRST time
-- 3. PostgreSQL initializes empty database
-- 4. Runs ALL .sql files in /docker-entrypoint-initdb.d/
-- 5. This script executes
-- 6. Database is ready with schema and data
--
-- ON SUBSEQUENT STARTS:
-- This script does NOT run again (data persists in volume)
-- ==============================================================================

-- CREATE DATABASE
-- Creates a new database named 'enterprise_db'
-- This is separate from the default 'postgres' database
-- WHY SEPARATE DATABASE? Organization - app data separate from system data
CREATE DATABASE enterprise_db;

-- CONNECT TO DATABASE
-- \c is PostgreSQL command to switch databases
-- All subsequent commands run against enterprise_db
\c enterprise_db;

-- ==============================================================================
-- TABLE DEFINITIONS
-- ==============================================================================

-- USERS TABLE
-- Stores user account information
-- This demonstrates typical user management schema
CREATE TABLE users (
    -- PRIMARY KEY: Unique identifier, auto-increments
    -- SERIAL = INTEGER that auto-increments (1, 2, 3, ...)
    id SERIAL PRIMARY KEY,

    -- VARCHAR(100): Variable-length string, max 100 characters
    -- NOT NULL: This field is required
    username VARCHAR(100) NOT NULL,

    -- VARCHAR(255): Email addresses can be long
    email VARCHAR(255) NOT NULL,

    -- TIMESTAMP: Date and time
    -- DEFAULT CURRENT_TIMESTAMP: Automatically set to now() when row inserted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Can be NULL (user hasn't logged in yet)
    last_login TIMESTAMP,

    -- Account tier: 'free', 'premium', 'enterprise'
    account_type VARCHAR(50)
);

-- ORDERS TABLE
-- Stores customer orders
-- Demonstrates foreign key relationship
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,

    -- FOREIGN KEY: References users.id
    -- INTEGER: Must match type of users.id
    -- REFERENCES users(id): Links to users table
    -- WHY? Ensures data integrity (can't create order for non-existent user)
    user_id INTEGER REFERENCES users(id),

    -- DECIMAL(10, 2): Up to 10 digits, 2 after decimal point
    -- Perfect for money (e.g., 12345678.99)
    order_total DECIMAL(10, 2),

    -- Order workflow states
    order_status VARCHAR(50),

    -- Payment processing method
    payment_method VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PRODUCTS TABLE
-- Product catalog
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(100),
    price DECIMAL(10, 2),
    stock_quantity INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TRANSACTIONS TABLE
-- Financial transactions (payments, refunds, etc.)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,

    -- Links to orders table
    order_id INTEGER REFERENCES orders(id),

    transaction_amount DECIMAL(10, 2),
    transaction_type VARCHAR(50),      -- 'payment', 'refund', 'chargeback'
    transaction_status VARCHAR(50),    -- 'completed', 'pending', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- SAMPLE DATA INSERTION
-- ==============================================================================

-- INSERT USERS
-- FORMAT: INSERT INTO table (columns) VALUES (values);
-- Multiple rows can be inserted at once
INSERT INTO users (username, email, account_type) VALUES
    ('john_doe', 'john@example.com', 'premium'),
    ('jane_smith', 'jane@example.com', 'free'),
    ('bob_wilson', 'bob@example.com', 'premium'),
    ('alice_jones', 'alice@example.com', 'free'),
    ('charlie_brown', 'charlie@example.com', 'enterprise');

-- INSERT PRODUCTS
INSERT INTO products (name, category, price, stock_quantity) VALUES
    ('Laptop Pro', 'electronics', 1299.99, 45),
    ('Wireless Mouse', 'electronics', 29.99, 200),
    ('Office Chair', 'furniture', 349.99, 30),
    ('Desk Lamp', 'furniture', 79.99, 150),
    ('Notebook Set', 'stationery', 12.99, 500);

-- INSERT ORDERS
-- Note: user_id references the auto-generated IDs from users table (1-5)
INSERT INTO orders (user_id, order_total, order_status, payment_method) VALUES
    (1, 1329.98, 'completed', 'credit_card'),
    (2, 29.99, 'completed', 'paypal'),
    (3, 349.99, 'pending', 'bank_transfer'),
    (1, 92.98, 'completed', 'credit_card'),
    (4, 12.99, 'failed', 'credit_card');

-- INSERT TRANSACTIONS
INSERT INTO transactions (order_id, transaction_amount, transaction_type, transaction_status) VALUES
    (1, 1329.98, 'payment', 'completed'),
    (2, 29.99, 'payment', 'completed'),
    (3, 349.99, 'payment', 'pending'),
    (4, 92.98, 'payment', 'completed'),
    (5, 12.99, 'payment', 'failed');

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================

-- CREATE INDEX: Speeds up queries on specific columns
-- FORMAT: CREATE INDEX index_name ON table(column);
--
-- WHY INDEXES?
-- Without index: Database scans EVERY row (slow for large tables)
-- With index: Database uses index to jump directly to matching rows (fast!)
--
-- TRADEOFF:
-- Pros: Faster SELECT queries
-- Cons: Slower INSERT/UPDATE/DELETE (index must be updated), more disk space

-- Index on email lookups (common: SELECT * FROM users WHERE email = '...')
CREATE INDEX idx_users_email ON users(email);

-- Index for foreign key lookups (JOIN queries)
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Index for filtering by status (WHERE order_status = 'completed')
CREATE INDEX idx_orders_status ON orders(order_status);

-- Index for transaction lookups
CREATE INDEX idx_transactions_order_id ON transactions(order_id);

-- ==============================================================================
-- DATABASE VIEWS
-- ==============================================================================

-- VIEW: Virtual table created from a query
-- It doesn't store data, just the query definition
-- When you SELECT from a view, it runs the underlying query
--
-- WHY USE VIEWS?
-- - Simplify complex queries
-- - Reuse common queries
-- - Security (hide columns, limit rows)
-- - Abstraction (change underlying tables without changing queries)

CREATE VIEW order_summary AS
SELECT
    u.username,
    u.account_type,
    COUNT(o.id) as total_orders,                -- Count of orders
    SUM(o.order_total) as total_spent,          -- Total money spent
    AVG(o.order_total) as avg_order_value       -- Average order size
FROM users u
LEFT JOIN orders o ON u.id = o.user_id          -- Include users with 0 orders
GROUP BY u.id, u.username, u.account_type;      -- Group by user

-- USAGE:
-- SELECT * FROM order_summary;
-- Runs the complex query above automatically

-- ==============================================================================
-- STORED FUNCTIONS
-- ==============================================================================

-- FUNCTION: Reusable SQL code stored in database
-- Can be called like: SELECT simulate_activity();
--
-- THIS FUNCTION: Simulates database activity for demo purposes
-- In production, you wouldn't need this (real traffic generates activity)

CREATE OR REPLACE FUNCTION simulate_activity() RETURNS void AS $$
BEGIN
    -- Randomly update a user's last_login timestamp
    -- floor(random() * 5 + 1): Random number between 1 and 5
    UPDATE users
    SET last_login = NOW()
    WHERE id = floor(random() * 5 + 1);

    -- Simulate slow query with pg_sleep
    -- random() * 0.1: Sleep 0-100ms
    -- WHY? Demonstrates query performance metrics
    PERFORM pg_sleep(random() * 0.1);
END;
$$ LANGUAGE plpgsql;

-- LANGUAGE plpgsql: PostgreSQL procedural language (like SQL + programming)
-- RETURNS void: Doesn't return a value
-- AS $$: Function body between $$ markers

-- ==============================================================================
-- USER PERMISSIONS FOR EXPORTER
-- ==============================================================================

-- CREATE USER: postgres_exporter
-- This is a SPECIAL user just for metrics collection
-- It only has READ permissions, not WRITE
--
-- WHY SEPARATE USER?
-- Security! If exporter is compromised, attacker can only read, not modify data

CREATE USER postgres_exporter WITH PASSWORD 'exporter_password';

-- GRANT CONNECT: Allow connection to enterprise_db database
GRANT CONNECT ON DATABASE enterprise_db TO postgres_exporter;

-- GRANT pg_monitor: Built-in role with read access to monitoring views
-- Includes: pg_stat_activity, pg_stat_database, etc.
GRANT pg_monitor TO postgres_exporter;

-- GRANT USAGE: Allow using 'public' schema (default schema)
GRANT USAGE ON SCHEMA public TO postgres_exporter;

-- GRANT SELECT: Allow reading all tables in public schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgres_exporter;

-- ALTER DEFAULT PRIVILEGES: Future tables also get SELECT permission
-- WHY? If we add new tables later, exporter can still read them
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO postgres_exporter;

-- ==============================================================================
-- COMPLETION MESSAGE
-- ==============================================================================

-- SELECT: Display message in logs when script completes
SELECT 'Database initialized successfully' as status;

-- ==============================================================================
-- WHAT HAPPENS AFTER THIS SCRIPT:
-- ==============================================================================
--
-- 1. PostgreSQL is running with enterprise_db database
-- 2. Tables exist with sample data (5 users, 5 products, 5 orders, 5 transactions)
-- 3. Indexes are created for query performance
-- 4. postgres_exporter user can connect and read metrics
-- 5. postgres-exporter container can now connect using:
--    postgresql://postgres_exporter:exporter_password@postgres:5432/enterprise_db
-- 6. Exporter starts running queries from queries.yaml
-- 7. Exposes metrics at http://postgres-exporter:9187/metrics
-- 8. Prometheus scrapes those metrics
--
-- ==============================================================================
```

### 6. **postgres-exporter/queries.yaml**

This file defines CUSTOM queries for postgres_exporter. Here's the annotated version:

```yaml
# ==============================================================================
# POSTGRES EXPORTER CUSTOM QUERIES
# ==============================================================================
#
# WHAT THIS FILE DOES:
# Defines SQL queries that postgres_exporter runs against PostgreSQL.
# Each query result is converted to Prometheus metrics.
#
# WHY CUSTOM QUERIES?
# postgres_exporter provides default metrics (connections, cache hits, etc.)
# But we want BUSINESS metrics too (orders, revenue, users) from our tables.
# Custom queries let us expose ANY data from database as Prometheus metrics.
#
# HOW IT WORKS:
# 1. postgres-exporter reads this file (via PG_EXPORTER_EXTEND_QUERY_PATH)
# 2. Connects to PostgreSQL
# 3. Every time Prometheus scrapes (every 30s):
#    a. Runs each query
#    b. Converts results to Prometheus format
#    c. Returns via /metrics endpoint
#
# FILE FORMAT:
# query_name:
#   query: "SQL query here"
#   master: true/false          # Run on primary DB only?
#   cache_seconds: 30           # Cache results for N seconds
#   metrics:                    # How to convert columns to metrics
#     - column_name:
#         usage: "LABEL"        # Label dimension
#         description: "Help text"
#     - column_name:
#         usage: "GAUGE"        # Metric value
#         description: "Help text"
#
# ==============================================================================

# ==============================================================================
# QUERY 1: DATABASE SIZE
# ==============================================================================
# Tracks how much disk space each database uses
# Useful for capacity planning and growth monitoring

pg_database:
  # SQL QUERY
  # pg_database: System table with database info
  # pg_database_size(): Function that returns database size in bytes
  query: "SELECT pg_database.datname, pg_database_size(pg_database.datname) as size_bytes FROM pg_database"

  # MASTER: true = Only run on primary database (not replicas)
  # Important for expensive queries to avoid overloading replicas
  master: true

  # CACHE: Cache results for 30 seconds
  # Database size doesn't change often, no need to query every scrape
  cache_seconds: 30

  # METRICS: How to convert query columns to Prometheus metrics
  metrics:
    # COLUMN: datname (database name)
    - datname:
        usage: "LABEL"          # Use as label dimension, not metric value
        description: "Name of the database"
        # RESULT: pg_database_size_bytes{datname="enterprise_db"} 12345678

    # COLUMN: size_bytes (database size)
    - size_bytes:
        usage: "GAUGE"          # Use as metric value (can go up or down)
        description: "Size of the database in bytes"
        # RESULT: Metric value = size of database

# ==============================================================================
# QUERY 2: TABLE STATISTICS
# ==============================================================================
# Tracks how tables are being accessed (scans, reads, modifications)
# Essential for query optimization and index tuning

pg_stat_user_tables:
  query: |
    SELECT
      schemaname,                  -- Schema name (usually 'public')
      relname,                     -- Table name
      seq_scan,                    -- Number of sequential scans (slow!)
      seq_tup_read,                -- Rows read by sequential scans
      idx_scan,                    -- Number of index scans (fast!)
      idx_tup_fetch,               -- Rows fetched by index scans
      n_tup_ins,                   -- Rows inserted
      n_tup_upd,                   -- Rows updated
      n_tup_del,                   -- Rows deleted
      n_live_tup,                  -- Current live rows
      n_dead_tup                   -- Dead rows (need VACUUM)
    FROM pg_stat_user_tables       -- System view with table stats

  metrics:
    - schemaname:
        usage: "LABEL"
        description: "Name of the schema"

    - relname:
        usage: "LABEL"
        description: "Name of the table"

    - seq_scan:
        usage: "COUNTER"           # Always increases
        description: "Number of sequential scans"
        # HIGH VALUE = Missing indexes! Add indexes to improve performance

    - seq_tup_read:
        usage: "COUNTER"
        description: "Number of tuples read by sequential scans"

    - idx_scan:
        usage: "COUNTER"
        description: "Number of index scans"
        # HIGH VALUE = Good! Using indexes efficiently

    - idx_tup_fetch:
        usage: "COUNTER"
        description: "Number of tuples fetched by index scans"

    - n_tup_ins:
        usage: "COUNTER"
        description: "Number of tuples inserted"

    - n_tup_upd:
        usage: "COUNTER"
        description: "Number of tuples updated"

    - n_tup_del:
        usage: "COUNTER"
        description: "Number of tuples deleted"

    - n_live_tup:
        usage: "GAUGE"             # Current state, can go up or down
        description: "Number of live tuples"

    - n_dead_tup:
        usage: "GAUGE"
        description: "Number of dead tuples"
        # HIGH VALUE = Need to run VACUUM! Dead tuples waste space

# ==============================================================================
# QUERY 3: ACTIVE CONNECTIONS
# ==============================================================================
# Monitors database connections by state
# Critical for detecting connection pool exhaustion

pg_stat_activity:
  query: |
    SELECT
      datname,                     -- Database name
      state,                       -- Connection state: 'active', 'idle', etc.
      COUNT(*) as connections      -- Number of connections in this state
    FROM pg_stat_activity
    WHERE datname IS NOT NULL      -- Exclude system connections
    GROUP BY datname, state

  metrics:
    - datname:
        usage: "LABEL"
        description: "Database name"

    - state:
        usage: "LABEL"
        description: "Connection state"
        # STATES:
        # - active: Currently executing a query
        # - idle: Connected but not doing anything
        # - idle in transaction: In transaction but not executing
        # - idle in transaction (aborted): Transaction failed but not rolled back

    - connections:
        usage: "GAUGE"
        description: "Number of connections"
        # ALERT IF: Too many connections (> 80% of max_connections)

# ==============================================================================
# QUERY 4: SLOW QUERIES
# ==============================================================================
# Counts queries running longer than 5 seconds
# Helps identify performance problems

pg_slow_queries:
  query: |
    SELECT
      COUNT(*) as slow_queries
    FROM pg_stat_activity
    WHERE state = 'active'                              -- Currently executing
      AND now() - query_start > interval '5 seconds'   -- Running > 5 seconds

  metrics:
    - slow_queries:
        usage: "GAUGE"
        description: "Number of queries running longer than 5 seconds"
        # ALERT IF: > 5 slow queries (performance problem!)

# ==============================================================================
# QUERY 5: BUSINESS METRICS - ORDERS BY STATUS
# ==============================================================================
# Exposes business data as metrics
# Shows count and total amount of orders per status

business_orders_by_status:
  query: |
    SELECT
      order_status,                               -- 'completed', 'pending', 'failed'
      COUNT(*) as count,                         -- Number of orders
      COALESCE(SUM(order_total), 0) as total_amount  -- Total dollar amount
    FROM orders
    GROUP BY order_status                        -- One row per status

  metrics:
    - order_status:
        usage: "LABEL"
        description: "Order status"

    - count:
        usage: "GAUGE"
        description: "Number of orders with this status"
        # USE IN PROMQL: business_orders_by_status_count{order_status="completed"}

    - total_amount:
        usage: "GAUGE"
        description: "Total amount for orders with this status"
        # USE IN PROMQL: business_orders_by_status_total_amount{order_status="completed"}

# ==============================================================================
# QUERY 6: BUSINESS METRICS - USERS BY TYPE
# ==============================================================================
# Tracks user distribution by account type

business_users_by_type:
  query: |
    SELECT
      account_type,                              -- 'free', 'premium', 'enterprise'
      COUNT(*) as count                         -- Number of users
    FROM users
    GROUP BY account_type

  metrics:
    - account_type:
        usage: "LABEL"
        description: "Account type"

    - count:
        usage: "GAUGE"
        description: "Number of users with this account type"

# ==============================================================================
# QUERY 7: BUSINESS METRICS - DAILY REVENUE
# ==============================================================================
# Shows revenue trends over last 7 days
# Useful for tracking sales performance

business_daily_revenue:
  query: |
    SELECT
      DATE(created_at) as date,                  -- Date (without time)
      COUNT(*) as orders_count,                  -- Orders that day
      COALESCE(SUM(order_total), 0) as revenue  -- Total revenue that day
    FROM orders
    WHERE created_at > NOW() - INTERVAL '7 days'  -- Last 7 days only
      AND order_status = 'completed'              -- Only completed orders
    GROUP BY DATE(created_at)                     -- One row per day

  metrics:
    - date:
        usage: "LABEL"
        description: "Date"

    - orders_count:
        usage: "GAUGE"
        description: "Number of completed orders"

    - revenue:
        usage: "GAUGE"
        description: "Total revenue for the day"

# ==============================================================================
# QUERY 8: BUSINESS METRICS - PRODUCT STOCK LEVELS
# ==============================================================================
# Monitors inventory levels
# Alerts when products are low on stock

business_product_stock:
  query: |
    SELECT
      name,                                      -- Product name
      category,                                  -- Product category
      stock_quantity,                            -- Current inventory
      price                                      -- Product price
    FROM products

  metrics:
    - name:
        usage: "LABEL"
        description: "Product name"

    - category:
        usage: "LABEL"
        description: "Product category"

    - stock_quantity:
        usage: "GAUGE"
        description: "Current stock quantity"
        # ALERT IF: stock_quantity < 10 (low stock!)

    - price:
        usage: "GAUGE"
        description: "Product price"

# ==============================================================================
# QUERY 9: DATABASE LOCKS
# ==============================================================================
# Monitors database locking (contention indicator)

pg_locks_count:
  query: |
    SELECT
      mode,                                      -- Lock type
      COUNT(*) as locks                         -- Number of locks
    FROM pg_locks
    GROUP BY mode

  metrics:
    - mode:
        usage: "LABEL"
        description: "Lock mode"
        # LOCK TYPES:
        # - AccessShareLock: Simple SELECT
        # - RowExclusiveLock: UPDATE/DELETE
        # - ExclusiveLock: Heavy operation

    - locks:
        usage: "GAUGE"
        description: "Number of locks"

# ==============================================================================
# QUERY 10: CACHE HIT RATIO
# ==============================================================================
# Percentage of data served from memory vs disk
# High ratio = good performance (data in cache)
# Low ratio = poor performance (frequent disk reads)

pg_cache_hit_ratio:
  query: |
    SELECT
      'cache_hit_ratio' as metric,
      CASE
        WHEN (blks_hit + blks_read) = 0 THEN 0    -- Avoid division by zero
        ELSE round(blks_hit::numeric / (blks_hit + blks_read), 4)  -- Calculate ratio
      END as ratio
    FROM pg_stat_database
    WHERE datname = current_database()             -- Current database only

  metrics:
    - metric:
        usage: "LABEL"
        description: "Metric name"

    - ratio:
        usage: "GAUGE"
        description: "Cache hit ratio (0-1)"
        # GOOD: > 0.95 (95% cache hits)
        # BAD: < 0.90 (90% cache hits) - need more memory or query optimization

# ==============================================================================
# END OF QUERIES
# ==============================================================================
#
# HOW THESE BECOME PROMETHEUS METRICS:
#
# 1. postgres_exporter runs these queries every 30 seconds
# 2. Converts results to Prometheus format:
#
#    EXAMPLE:
#    Query returns:
#    | order_status | count | total_amount |
#    |--------------|-------|--------------|
#    | completed    | 3     | 1452.96      |
#    | pending      | 1     | 349.99       |
#    | failed       | 1     | 12.99        |
#
#    Becomes:
#    business_orders_by_status_count{order_status="completed"} 3
#    business_orders_by_status_count{order_status="pending"} 1
#    business_orders_by_status_count{order_status="failed"} 1
#    business_orders_by_status_total_amount{order_status="completed"} 1452.96
#    business_orders_by_status_total_amount{order_status="pending"} 349.99
#    business_orders_by_status_total_amount{order_status="failed"} 12.99
#
# 3. Prometheus scrapes http://postgres-exporter:9187/metrics
# 4. Stores these metrics in time-series database
# 5. Available for querying in Grafana!
#
# ==============================================================================
```

---

## Summary of All Commented Files

| File | Lines | Purpose | Scraping Method |
|------|-------|---------|-----------------|
| **server.js** | 910 | Node.js app with metrics | **Direct** (built-in) |
| **package.json** | 63 | Dependencies definition | N/A |
| **Dockerfile** | 397 | Build instructions | N/A |
| **docker-compose.yml** | 853 | Orchestration | N/A |
| **init.sql** | ~200 | Database schema | **Exporter** (via queries) |
| **queries.yaml** | ~300 | Custom metric queries | **Exporter** (postgres_exporter) |
| **prometheus.yml** | (see Prometheus section) | Scrape configuration | N/A |
| **Grafana dashboards** | (JSON files) | Visualization | N/A |

---

## Key Takeaways

### Direct Scraping (server.js)
1. Import `prom-client` library
2. Create metrics (Counter, Gauge, Histogram)
3. Register metrics
4. Expose `/metrics` endpoint
5. Prometheus scrapes directly

### Exporter Pattern (PostgreSQL)
1. Service doesn't speak Prometheus (PostgreSQL speaks SQL)
2. Run exporter as separate service (postgres_exporter)
3. Exporter connects to service
4. Exporter runs queries (queries.yaml)
5. Exporter exposes `/metrics` endpoint
6. Prometheus scrapes exporter (not database directly)

---

## Next: Prometheus and Grafana Files

Continue to PROMETHEUS_CONFIG_EXPLAINED.md for Prometheus configuration files and GRAFANA_CONFIG_EXPLAINED.md for Grafana setup.
