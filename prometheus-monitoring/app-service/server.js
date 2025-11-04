// ==============================================================================
// ENTERPRISE NODE.JS APPLICATION WITH BUILT-IN PROMETHEUS METRICS
// ==============================================================================
//
// This application demonstrates DIRECT SCRAPING - it has native Prometheus
// support and exposes metrics at /metrics endpoint WITHOUT needing an exporter.
//
// WHAT THIS FILE DOES:
// 1. Creates an Express.js web server
// 2. Integrates Prometheus client library
// 3. Defines custom business and technical metrics
// 4. Exposes /metrics endpoint for Prometheus to scrape
// 5. Provides sample API endpoints that generate metrics
//
// WHY THIS APPROACH?
// Modern applications can include Prometheus client libraries to expose
// metrics directly. This is faster, simpler, and more accurate than using
// an external exporter.
//
// ==============================================================================

// ==============================================================================
// IMPORTS AND DEPENDENCIES
// ==============================================================================

// EXPRESS: Web framework for Node.js
// Handles HTTP requests, routing, middleware
// Why? Makes it easy to create REST APIs and serve endpoints
const express = require('express');

// PROM-CLIENT: Official Prometheus client library for Node.js
// Provides classes to create metrics (Counter, Gauge, Histogram, Summary)
// Automatically collects Node.js runtime metrics (CPU, memory, etc.)
// Formats metrics in Prometheus text format for scraping
// Why? This is what makes our app "Prometheus-ready"
const client = require('prom-client');

// ==============================================================================
// APPLICATION INITIALIZATION
// ==============================================================================

// Create Express application instance
// This is the main application object that will handle HTTP requests
const app = express();

// Define the port our application will listen on
// Port 3000 is standard for Node.js development
// This must match the port exposed in docker-compose.yml
const PORT = 3000;

// ==============================================================================
// PROMETHEUS REGISTRY SETUP
// ==============================================================================

// REGISTRY: Central collection of all metrics
// Think of it as a "catalog" that keeps track of all metrics we define
// When Prometheus scrapes /metrics, we return all metrics from this registry
//
// WHY CREATE A REGISTRY?
// - Organizes all metrics in one place
// - Prevents duplicate metric names
// - Makes it easy to export all metrics at once
const register = new client.Registry();

// COLLECT DEFAULT METRICS
// This automatically creates and tracks Node.js runtime metrics:
// - process_cpu_seconds_total (CPU usage)
// - process_resident_memory_bytes (memory usage)
// - nodejs_heap_size_used_bytes (heap memory)
// - nodejs_eventloop_lag_seconds (event loop performance)
// - nodejs_gc_duration_seconds (garbage collection)
// - And many more...
//
// WHY USE DEFAULT METRICS?
// These are essential for monitoring application health and performance.
// Without them, you'd have to implement each one manually.
//
// PARAMETERS:
// - register: Add default metrics to our registry
client.collectDefaultMetrics({ register });

// ==============================================================================
// ENTERPRISE METRICS DEFINITIONS
// ==============================================================================
// Here we define CUSTOM metrics specific to our business needs.
// Prometheus supports 4 metric types:
//
// 1. COUNTER: Always increases (requests, errors, sales)
//    - Can only go up
//    - Resets to 0 on restart
//    - Use rate() in PromQL to get per-second rate
//
// 2. GAUGE: Can go up or down (active users, temperature, queue size)
//    - Can increase or decrease
//    - Represents current state
//
// 3. HISTOGRAM: Measures distribution (request duration, response size)
//    - Counts observations in configurable buckets
//    - Calculates sum and count
//    - Use histogram_quantile() to get percentiles (p50, p95, p99)
//
// 4. SUMMARY: Similar to histogram but calculates quantiles on client
//    - More accurate but more expensive
//    - Not used in this example
// ==============================================================================

// ------------------------------------------------------------------------------
// SECTION 1: HTTP REQUEST METRICS
// ------------------------------------------------------------------------------

// HTTP REQUEST DURATION (Histogram)
// Tracks how long each HTTP request takes to complete
//
// METRIC TYPE: Histogram
// WHY HISTOGRAM? Request durations have a distribution. We want to know:
// - What's the median response time? (50th percentile)
// - What's the 95th percentile? (95% of requests are faster than this)
// - What's the 99th percentile? (SLA compliance)
const httpRequestDuration = new client.Histogram({
  // NAME: Metric name in Prometheus
  // Convention: lowercase with underscores, ends with unit (_seconds, _bytes, _total)
  name: 'http_request_duration_seconds',

  // HELP: Human-readable description
  // Shows up in Prometheus UI and documentation
  help: 'Duration of HTTP requests in seconds',

  // LABEL NAMES: Dimensions for filtering and aggregating
  // Each unique combination of label values creates a separate time series
  // Example: {method="GET", route="/api/users", status_code="200"}
  //
  // WHY THESE LABELS?
  // - method: GET vs POST behave differently
  // - route: Different endpoints have different performance
  // - status_code: Errors might be slower or faster than success
  labelNames: ['method', 'route', 'status_code'],

  // BUCKETS: Histogram boundaries in seconds
  // Observations are counted in these buckets
  // Format: [0.1, 0.5, 1, 2, 5] means:
  // - bucket_le_0.1: requests <= 0.1 seconds (100ms)
  // - bucket_le_0.5: requests <= 0.5 seconds (500ms)
  // - bucket_le_1: requests <= 1 second
  // - bucket_le_2: requests <= 2 seconds
  // - bucket_le_5: requests <= 5 seconds
  // - bucket_le_inf: all requests (infinity bucket)
  //
  // WHY THESE BUCKETS?
  // Tuned for web application response times:
  // - 100ms: Excellent
  // - 500ms: Good
  // - 1s: Acceptable
  // - 2s: Slow
  // - 5s: Very slow
  buckets: [0.1, 0.5, 1, 2, 5]
});

// HTTP REQUEST TOTAL (Counter)
// Counts total number of HTTP requests
//
// METRIC TYPE: Counter
// WHY COUNTER? We want to count requests over time.
// Use rate(http_requests_total[5m]) in PromQL to get requests per second.
const httpRequestTotal = new client.Counter({
  // NAME: Total count of requests
  // Convention: Counters often end with _total
  name: 'http_requests_total',

  // HELP: Description
  help: 'Total number of HTTP requests',

  // LABELS: Same as duration metric for consistency
  // Allows correlating request count with request duration
  labelNames: ['method', 'route', 'status_code']
});

// ------------------------------------------------------------------------------
// SECTION 2: BUSINESS METRICS
// ------------------------------------------------------------------------------
// These metrics track business KPIs, not just technical performance.
// They answer questions like:
// - How many orders are we processing?
// - What's our revenue?
// - How many users are active?
// ------------------------------------------------------------------------------

// ORDERS TOTAL (Counter)
// Tracks total number of orders by status and payment method
//
// BUSINESS VALUE:
// - Sales volume tracking
// - Payment method preferences
// - Failed order rate (alert if too high)
const ordersTotal = new client.Counter({
  name: 'orders_total',
  help: 'Total number of orders processed',

  // LABELS:
  // - status: 'completed', 'pending', 'failed'
  //   Allows us to track conversion rate and failure rate
  // - payment_method: 'credit_card', 'paypal', 'bank_transfer'
  //   Helps understand customer preferences
  labelNames: ['status', 'payment_method']
});

// REVENUE TOTAL (Counter)
// Tracks total revenue in dollars by product category
//
// METRIC TYPE: Counter
// WHY COUNTER? Revenue accumulates over time.
//
// BUSINESS VALUE:
// - Financial tracking
// - Category performance
// - Revenue growth rate
//
// NOTE: This is a counter, not a gauge. It only goes up.
// To see revenue rate: rate(revenue_total_dollars[1h]) gives $ per second
const revenueTotal = new client.Counter({
  name: 'revenue_total_dollars',
  help: 'Total revenue in dollars',

  // LABELS:
  // - product_category: 'electronics', 'clothing', 'food', 'books'
  //   Shows which categories generate most revenue
  labelNames: ['product_category']
});

// ACTIVE USERS (Gauge)
// Tracks current number of active users
//
// METRIC TYPE: Gauge (not Counter!)
// WHY GAUGE? Active users go up AND down. It's a current state measurement.
// When users log out or sessions expire, this decreases.
//
// BUSINESS VALUE:
// - Real-time user engagement
// - Capacity planning
// - User type distribution (premium vs free)
const activeUsers = new client.Gauge({
  name: 'active_users_current',
  help: 'Current number of active users',

  // LABELS:
  // - user_type: 'premium', 'free'
  //   Helps track user segment engagement
  labelNames: ['user_type']
});

// USER REGISTRATIONS (Counter)
// Tracks total number of new user signups
//
// METRIC TYPE: Counter
// WHY COUNTER? Registrations only increase, never decrease.
//
// BUSINESS VALUE:
// - Growth tracking
// - Registration method effectiveness
// - Marketing campaign success
const userRegistrations = new client.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',

  // LABELS:
  // - registration_method: 'email', 'google_oauth', 'facebook_oauth', 'phone'
  //   Shows which registration methods are most popular
  labelNames: ['registration_method']
});

// ------------------------------------------------------------------------------
// SECTION 3: APPLICATION PERFORMANCE METRICS
// ------------------------------------------------------------------------------
// These track internal application performance for optimization.
// ------------------------------------------------------------------------------

// DATABASE QUERY DURATION (Histogram)
// Tracks how long database queries take
//
// METRIC TYPE: Histogram
// WHY HISTOGRAM? Query times have a distribution. We need percentiles.
//
// OPERATIONAL VALUE:
// - Identify slow queries
// - Detect N+1 query problems
// - Monitor database performance degradation
const databaseQueryDuration = new client.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',

  // LABELS:
  // - query_type: 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
  //   Different operations have different performance characteristics
  // - table: 'users', 'orders', 'products', 'transactions'
  //   Identifies which tables are slow
  labelNames: ['query_type', 'table'],

  // BUCKETS: Database query times (smaller buckets than HTTP requests)
  // Format: [0.01, 0.05, 0.1, 0.5, 1, 2] in seconds
  // - 10ms: Excellent (primary key lookup)
  // - 50ms: Good (indexed query)
  // - 100ms: Acceptable
  // - 500ms: Slow (full table scan?)
  // - 1s+: Very slow (needs optimization)
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
});

// CACHE HIT TOTAL (Counter)
// Counts successful cache lookups
//
// METRIC TYPE: Counter
// WHY COUNTER? Cache hits accumulate over time.
//
// OPERATIONAL VALUE:
// - Cache effectiveness
// - Calculate hit rate: hits / (hits + misses)
const cacheHitTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',

  // LABELS:
  // - cache_type: 'redis', 'memcached'
  //   If using multiple cache systems
  labelNames: ['cache_type']
});

// CACHE MISS TOTAL (Counter)
// Counts failed cache lookups (had to fetch from database)
//
// METRIC TYPE: Counter
// WHY SEPARATE FROM HITS? Makes rate calculations easier in PromQL.
//
// USAGE IN PROMQL:
// Cache hit rate = cache_hits_total / (cache_hits_total + cache_misses_total)
const cacheMissTotal = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type']
});

// ------------------------------------------------------------------------------
// SECTION 4: ERROR TRACKING METRICS
// ------------------------------------------------------------------------------

// APPLICATION ERRORS TOTAL (Counter)
// Tracks all application errors by type and severity
//
// METRIC TYPE: Counter
// WHY COUNTER? Errors accumulate. We want to track error rate over time.
//
// OPERATIONAL VALUE:
// - Error rate monitoring
// - Alert on high error rates
// - Identify error patterns
// - Track error resolution
const errorTotal = new client.Counter({
  name: 'application_errors_total',
  help: 'Total number of application errors',

  // LABELS:
  // - error_type: 'validation', 'database', 'network', 'authentication'
  //   Categorizes errors for root cause analysis
  // - severity: 'low', 'medium', 'high', 'critical'
  //   Prioritizes errors for alerting
  labelNames: ['error_type', 'severity']
});

// ------------------------------------------------------------------------------
// SECTION 5: INFRASTRUCTURE METRICS
// ------------------------------------------------------------------------------

// ACTIVE CONNECTIONS (Gauge)
// Tracks current number of active connections
//
// METRIC TYPE: Gauge
// WHY GAUGE? Connections open and close, so this goes up and down.
//
// OPERATIONAL VALUE:
// - Capacity planning
// - Connection pool sizing
// - Detect connection leaks
const activeConnections = new client.Gauge({
  name: 'active_connections_current',
  help: 'Current number of active connections',

  // LABELS:
  // - connection_type: 'http', 'database', 'websocket'
  //   Different connection types have different limits
  labelNames: ['connection_type']
});

// QUEUE SIZE (Gauge)
// Tracks current size of processing queues
//
// METRIC TYPE: Gauge
// WHY GAUGE? Queue size increases and decreases as jobs are added/processed.
//
// OPERATIONAL VALUE:
// - Detect queue buildup (processing too slow)
// - Alert on queue saturation
// - Capacity planning for workers
const queueSize = new client.Gauge({
  name: 'queue_size_current',
  help: 'Current size of processing queues',

  // LABELS:
  // - queue_name: 'email', 'processing', 'notifications'
  //   Different queues for different tasks
  labelNames: ['queue_name']
});

// ==============================================================================
// REGISTER METRICS WITH PROMETHEUS
// ==============================================================================
// All metrics must be registered before they can be scraped.
// Registration adds them to the registry we created earlier.
//
// WHY REGISTER?
// - Makes metrics available at /metrics endpoint
// - Prevents duplicate metric names
// - Validates metric definitions
// ==============================================================================

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(ordersTotal);
register.registerMetric(revenueTotal);
register.registerMetric(activeUsers);
register.registerMetric(userRegistrations);
register.registerMetric(databaseQueryDuration);
register.registerMetric(cacheHitTotal);
register.registerMetric(cacheMissTotal);
register.registerMetric(errorTotal);
register.registerMetric(activeConnections);
register.registerMetric(queueSize);

// ==============================================================================
// EXPRESS MIDDLEWARE FOR AUTOMATIC REQUEST TRACKING
// ==============================================================================
// This middleware automatically tracks every HTTP request.
// It runs BEFORE all route handlers, captures timing, and records metrics.
//
// HOW IT WORKS:
// 1. Request comes in → middleware starts timer
// 2. Request is processed by route handler
// 3. Response is sent → 'finish' event fires
// 4. Middleware calculates duration and records metrics
//
// WHY MIDDLEWARE?
// - Automatic tracking (no manual code in each endpoint)
// - Consistent measurement across all routes
// - Captures timing for ALL requests (even 404s)
// ==============================================================================

app.use((req, res, next) => {
  // START TIMER
  // Record timestamp when request arrives (in milliseconds)
  // Date.now() returns milliseconds since Unix epoch
  const start = Date.now();

  // LISTEN FOR RESPONSE COMPLETION
  // The 'finish' event fires after response is fully sent to client
  // This is the right time to record metrics
  //
  // WHY 'finish' AND NOT 'end'?
  // - 'finish': All data sent to operating system (more accurate)
  // - 'end': Response headers sent (too early, body might still be sending)
  res.on('finish', () => {
    // CALCULATE DURATION
    // Subtract start time from current time to get milliseconds
    // Divide by 1000 to convert to seconds (Prometheus convention)
    const duration = (Date.now() - start) / 1000;

    // DETERMINE ROUTE
    // req.route.path gives the route pattern (e.g., "/api/users/:id")
    // If no route matched, fall back to req.path (e.g., "/unknown")
    // This handles 404s and other unmatched routes
    const route = req.route ? req.route.path : req.path;

    // RECORD HISTOGRAM OBSERVATION
    // .labels() sets the label values for this observation
    // .observe() records the duration value
    //
    // WHAT HAPPENS INTERNALLY:
    // - Histogram determines which bucket this duration falls into
    // - Increments that bucket's counter
    // - Updates sum and count
    //
    // PARAMETERS:
    // - req.method: HTTP method (GET, POST, PUT, DELETE, etc.)
    // - route: The matched route pattern
    // - res.statusCode: HTTP status code (200, 404, 500, etc.)
    // - duration: Time in seconds
    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);

    // RECORD COUNTER INCREMENT
    // .labels() sets the label values
    // .inc() increments the counter by 1
    //
    // RESULT: Count of requests with these label values increases by 1
    httpRequestTotal.labels(req.method, route, res.statusCode).inc();
  });

  // CONTINUE TO NEXT MIDDLEWARE/ROUTE HANDLER
  // This must be called or the request will hang
  // It passes control to the next function in the middleware chain
  next();
});

// ==============================================================================
// PROMETHEUS METRICS ENDPOINT
// ==============================================================================
// This is THE MOST IMPORTANT ENDPOINT in the entire file!
// Prometheus scrapes this endpoint to collect all metrics.
//
// ENDPOINT: GET /metrics
// RESPONSE FORMAT: Prometheus text format (plain text, not JSON)
// CONTENT-TYPE: application/openmetrics-text or text/plain
//
// WHAT PROMETHEUS DOES:
// 1. Every 10-30 seconds (configured in prometheus.yml)
// 2. Sends HTTP GET to http://app-service:3000/metrics
// 3. Receives all metrics in text format
// 4. Parses and stores them in time-series database
//
// EXAMPLE OUTPUT:
// # HELP http_requests_total Total number of HTTP requests
// # TYPE http_requests_total counter
// http_requests_total{method="GET",route="/",status_code="200"} 1523
// http_requests_total{method="POST",route="/api/orders",status_code="201"} 847
// ==============================================================================

app.get('/metrics', async (req, res) => {
  // SET CONTENT-TYPE HEADER
  // Tells Prometheus what format the metrics are in
  // register.contentType returns the correct MIME type
  // Usually: "text/plain; version=0.0.4" or "application/openmetrics-text"
  res.set('Content-Type', register.contentType);

  // GENERATE AND SEND METRICS
  // register.metrics() does the heavy lifting:
  // 1. Iterates through all registered metrics
  // 2. Formats each metric in Prometheus text format
  // 3. Returns a string with all metrics
  //
  // WHY ASYNC/AWAIT?
  // Some metrics (like default metrics) may need async operations
  // to collect their current values
  //
  // res.end() sends the response and closes the connection
  res.end(await register.metrics());
});

// ==============================================================================
// APPLICATION ENDPOINTS
// ==============================================================================
// These are sample API endpoints that generate metrics when called.
// In a real application, these would be your actual business logic endpoints.
// ==============================================================================

// ------------------------------------------------------------------------------
// ROOT ENDPOINT (Documentation)
// ------------------------------------------------------------------------------

app.get('/', (req, res) => {
  // Returns a JSON list of available endpoints
  // Useful for exploring the API
  res.json({
    message: 'Enterprise Metrics Application',
    endpoints: [
      '/metrics - Prometheus metrics',
      '/api/orders - Simulate order creation',
      '/api/users/register - Simulate user registration',
      '/api/users/active - Get active users',
      '/api/cache/test - Test cache operations',
      '/api/database/query - Simulate database query',
      '/health - Health check'
    ]
  });
});

// ------------------------------------------------------------------------------
// HEALTH CHECK ENDPOINT
// ------------------------------------------------------------------------------
// Used by Docker health checks and load balancers
// Returns 200 OK if application is healthy
//
// USED IN:
// - docker-compose.yml healthcheck
// - Kubernetes liveness/readiness probes
// - Load balancer health checks

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ------------------------------------------------------------------------------
// ORDER CREATION ENDPOINT
// ------------------------------------------------------------------------------
// POST /api/orders
// Simulates creating an order and records business metrics
//
// METRICS RECORDED:
// - orders_total (counter) - incremented by 1
// - revenue_total_dollars (counter) - incremented by order amount
//
// IN A REAL APP:
// This would save to database, process payment, send confirmation email, etc.

app.post('/api/orders', express.json(), (req, res) => {
  // SIMULATE RANDOM ORDER DATA
  // In real app, this would come from req.body
  const statuses = ['completed', 'pending', 'failed'];
  const paymentMethods = ['credit_card', 'paypal', 'bank_transfer'];
  const categories = ['electronics', 'clothing', 'food', 'books'];

  // Pick random values
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const payment = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const amount = Math.floor(Math.random() * 500) + 10; // $10-$510

  // RECORD METRICS
  // Increment order counter with status and payment labels
  ordersTotal.labels(status, payment).inc();

  // Increment revenue counter with category label
  // .inc(amount) increments by the specified amount (not just 1)
  revenueTotal.labels(category).inc(amount);

  // RETURN RESPONSE
  // In real app, return created order with ID from database
  res.json({
    orderId: Math.random().toString(36).substr(2, 9), // Random ID
    status,
    payment,
    category,
    amount
  });
});

// ------------------------------------------------------------------------------
// USER REGISTRATION ENDPOINT
// ------------------------------------------------------------------------------
// POST /api/users/register
// Simulates user signup and tracks registration method
//
// METRICS RECORDED:
// - user_registrations_total (counter) - incremented by 1

app.post('/api/users/register', express.json(), (req, res) => {
  // SIMULATE REGISTRATION METHODS
  const methods = ['email', 'google_oauth', 'facebook_oauth', 'phone'];
  const method = methods[Math.floor(Math.random() * methods.length)];

  // RECORD METRIC
  // Track which registration method was used
  userRegistrations.labels(method).inc();

  // RETURN RESPONSE
  res.json({
    userId: Math.random().toString(36).substr(2, 9),
    method,
    timestamp: new Date().toISOString()
  });
});

// ------------------------------------------------------------------------------
// ACTIVE USERS ENDPOINT
// ------------------------------------------------------------------------------
// GET /api/users/active
// Returns current active user counts
//
// METRICS RECORDED:
// - active_users_current (gauge) - set to current value

app.get('/api/users/active', (req, res) => {
  // SIMULATE ACTIVE USER COUNTS
  // In real app, query from Redis or database
  const premium = Math.floor(Math.random() * 100) + 50; // 50-150
  const free = Math.floor(Math.random() * 500) + 200;   // 200-700

  // RECORD METRICS
  // .set() sets the gauge to an absolute value (doesn't increment)
  // WHY .set() AND NOT .inc()?
  // Because this is current state, not a cumulative count
  activeUsers.labels('premium').set(premium);
  activeUsers.labels('free').set(free);

  // RETURN RESPONSE
  res.json({ premium, free, total: premium + free });
});

// ------------------------------------------------------------------------------
// CACHE TEST ENDPOINT
// ------------------------------------------------------------------------------
// GET /api/cache/test
// Simulates cache lookup and tracks hit/miss rate
//
// METRICS RECORDED:
// - cache_hits_total or cache_misses_total (counter)

app.get('/api/cache/test', (req, res) => {
  // SIMULATE CACHE OPERATION
  const cacheTypes = ['redis', 'memcached'];
  const cacheType = cacheTypes[Math.floor(Math.random() * cacheTypes.length)];

  // 70% hit rate (30% chance of miss)
  const isHit = Math.random() > 0.3;

  // RECORD METRIC
  // Increment either hit or miss counter
  if (isHit) {
    cacheHitTotal.labels(cacheType).inc();
  } else {
    cacheMissTotal.labels(cacheType).inc();
  }

  // RETURN RESPONSE
  res.json({ cacheType, hit: isHit });
});

// ------------------------------------------------------------------------------
// DATABASE QUERY ENDPOINT
// ------------------------------------------------------------------------------
// GET /api/database/query
// Simulates database query and tracks duration
//
// METRICS RECORDED:
// - database_query_duration_seconds (histogram)

app.get('/api/database/query', async (req, res) => {
  // SIMULATE QUERY PARAMETERS
  const queryTypes = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  const tables = ['users', 'orders', 'products', 'transactions'];

  const queryType = queryTypes[Math.floor(Math.random() * queryTypes.length)];
  const table = tables[Math.floor(Math.random() * tables.length)];

  // SIMULATE QUERY DURATION (0-0.5 seconds)
  const duration = Math.random() * 0.5;

  // START TIMER
  // .startTimer() returns a function that, when called, records the duration
  // This is convenient for measuring execution time
  const end = databaseQueryDuration.labels(queryType, table).startTimer();

  // SIMULATE ASYNC QUERY EXECUTION
  // Wait for the simulated duration
  // In real app, this would be: await db.query(...)
  await new Promise(resolve => setTimeout(resolve, duration * 1000));

  // STOP TIMER AND RECORD METRIC
  // Calling end() calculates elapsed time and records it as histogram observation
  end();

  // RETURN RESPONSE
  res.json({ queryType, table, duration: duration.toFixed(3) });
});

// ------------------------------------------------------------------------------
// ERROR SIMULATION ENDPOINT
// ------------------------------------------------------------------------------
// GET /api/error
// Simulates an error and tracks it
//
// METRICS RECORDED:
// - application_errors_total (counter)

app.get('/api/error', (req, res) => {
  // SIMULATE ERROR
  const errorTypes = ['validation', 'database', 'network', 'authentication'];
  const severities = ['low', 'medium', 'high', 'critical'];

  const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
  const severity = severities[Math.floor(Math.random() * severities.length)];

  // RECORD ERROR METRIC
  errorTotal.labels(errorType, severity).inc();

  // RETURN ERROR RESPONSE
  // Return 500 Internal Server Error
  res.status(500).json({ error: errorType, severity });
});

// ==============================================================================
// BACKGROUND METRIC SIMULATION
// ==============================================================================
// This runs continuously in the background to simulate changing metrics.
// In a real application, you wouldn't need this - metrics would change
// naturally as users interact with the system.
//
// WHY THIS EXISTS IN THE DEMO:
// - Generates metric data even when no one is calling endpoints
// - Makes dashboards more interesting to look at
// - Demonstrates gauge metrics that change over time
// ==============================================================================

// SET INTERVAL
// Runs the function every 5000 milliseconds (5 seconds)
// setInterval() returns an ID that can be used to stop it with clearInterval()
setInterval(() => {
  // SIMULATE ACTIVE CONNECTION COUNTS
  // These would normally come from:
  // - HTTP: Number of open HTTP connections
  // - Database: Number of active database connections
  const httpConnections = Math.floor(Math.random() * 100) + 20; // 20-120
  const dbConnections = Math.floor(Math.random() * 50) + 10;    // 10-60

  // UPDATE GAUGE METRICS
  // .set() updates the gauge to the current value
  activeConnections.labels('http').set(httpConnections);
  activeConnections.labels('database').set(dbConnections);

  // SIMULATE QUEUE SIZES
  // These would normally come from:
  // - Redis/RabbitMQ/SQS queue length
  // - In-memory job queue size
  const emailQueue = Math.floor(Math.random() * 1000);      // 0-1000
  const processingQueue = Math.floor(Math.random() * 500);  // 0-500

  // UPDATE QUEUE SIZE GAUGES
  queueSize.labels('email').set(emailQueue);
  queueSize.labels('processing').set(processingQueue);

  // RANDOMLY GENERATE ERRORS
  // 20% chance every 5 seconds (simulates occasional errors)
  if (Math.random() > 0.8) {
    const errorTypes = ['validation', 'database', 'network'];
    const severities = ['low', 'medium', 'high'];

    // Record random error
    errorTotal.labels(
      errorTypes[Math.floor(Math.random() * errorTypes.length)],
      severities[Math.floor(Math.random() * severities.length)]
    ).inc();
  }
}, 5000); // Run every 5 seconds

// ==============================================================================
// START SERVER
// ==============================================================================
// Start the Express server and listen for HTTP requests
//
// WHAT HAPPENS WHEN SERVER STARTS:
// 1. Express binds to port 3000
// 2. Server begins accepting HTTP connections
// 3. All routes become accessible
// 4. Prometheus can now scrape /metrics endpoint
// ==============================================================================

app.listen(PORT, () => {
  // LOG STARTUP INFORMATION
  // These console.log statements help confirm the server started correctly
  // They appear in: docker-compose logs app-service

  console.log(`Enterprise Metrics Application running on port ${PORT}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
  console.log('');
  console.log('Exposed Metrics:');

  // LIST ALL CUSTOM METRICS
  // Helps developers know what metrics are available
  console.log('  - http_request_duration_seconds');
  console.log('  - http_requests_total');
  console.log('  - orders_total');
  console.log('  - revenue_total_dollars');
  console.log('  - active_users_current');
  console.log('  - user_registrations_total');
  console.log('  - database_query_duration_seconds');
  console.log('  - cache_hits_total / cache_misses_total');
  console.log('  - application_errors_total');
  console.log('  - active_connections_current');
  console.log('  - queue_size_current');

  // LIST DEFAULT NODE.JS METRICS
  // These are automatically collected by collectDefaultMetrics()
  console.log('  - process_cpu_seconds_total');
  console.log('  - process_resident_memory_bytes');
  console.log('  - nodejs_eventloop_lag_seconds');
});

// ==============================================================================
// END OF FILE
// ==============================================================================
//
// SUMMARY:
// This application demonstrates direct Prometheus integration.
// Key takeaways:
//
// 1. DIRECT SCRAPING: No exporter needed, app exposes /metrics itself
// 2. PROM-CLIENT LIBRARY: Provides all metric types and formatting
// 3. FOUR METRIC TYPES: Counter, Gauge, Histogram, Summary
// 4. LABELS: Add dimensions for filtering and aggregation
// 5. AUTOMATIC TRACKING: Middleware captures all HTTP requests
// 6. BUSINESS + TECHNICAL: Mix business KPIs with technical metrics
//
// PROMETHEUS SCRAPING:
// - Prometheus scrapes GET /metrics every 10-30 seconds
// - Gets all metrics in text format
// - Stores in time-series database
// - Makes available for querying and visualization
//
// TESTING:
// curl http://localhost:3000/metrics
// Should return 100+ lines of metrics in Prometheus format
// ==============================================================================
