#!/bin/bash

# Load Generator Script for Enterprise Monitoring Demo
# This script generates traffic to populate metrics

set -e

APP_URL="http://localhost:3000"
DURATION=${1:-60}  # Duration in seconds, default 60
REQUESTS_PER_SECOND=${2:-2}  # Requests per second, default 2

echo "================================================"
echo "Enterprise Monitoring Load Generator"
echo "================================================"
echo "Duration: ${DURATION} seconds"
echo "Rate: ${REQUESTS_PER_SECOND} requests/second"
echo "Target: ${APP_URL}"
echo "================================================"
echo ""

# Check if the app is running
if ! curl -s "${APP_URL}/health" > /dev/null; then
    echo "❌ Error: Application not reachable at ${APP_URL}"
    echo "Please start the services first: docker-compose up -d"
    exit 1
fi

echo "✅ Application is running"
echo ""
echo "Starting load generation..."
echo "Press Ctrl+C to stop"
echo ""

# Calculate sleep time between requests
SLEEP_TIME=$(echo "scale=3; 1/${REQUESTS_PER_SECOND}" | bc)

# Endpoints to hit
endpoints=(
    "POST /api/orders"
    "POST /api/users/register"
    "GET /api/users/active"
    "GET /api/cache/test"
    "GET /api/database/query"
    "GET /health"
)

start_time=$(date +%s)
request_count=0

while true; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))

    if [ $elapsed -ge $DURATION ]; then
        break
    fi

    # Randomly select an endpoint
    endpoint=${endpoints[$RANDOM % ${#endpoints[@]}]}
    method=$(echo $endpoint | awk '{print $1}')
    path=$(echo $endpoint | awk '{print $2}')

    # Make request (suppress output)
    if [ "$method" = "POST" ]; then
        curl -s -X POST "${APP_URL}${path}" -H "Content-Type: application/json" > /dev/null
    else
        curl -s "${APP_URL}${path}" > /dev/null
    fi

    request_count=$((request_count + 1))

    # Print progress every 10 requests
    if [ $((request_count % 10)) -eq 0 ]; then
        rps=$(echo "scale=2; ${request_count}/${elapsed}" | bc)
        echo "⏱️  ${elapsed}s | 📊 ${request_count} requests | 🚀 ${rps} req/s"
    fi

    # Occasionally hit the error endpoint (5% chance)
    if [ $((RANDOM % 20)) -eq 0 ]; then
        curl -s "${APP_URL}/api/error" > /dev/null
    fi

    sleep $SLEEP_TIME
done

echo ""
echo "================================================"
echo "Load Generation Complete!"
echo "================================================"
echo "Total requests: ${request_count}"
echo "Duration: ${elapsed} seconds"
avg_rps=$(echo "scale=2; ${request_count}/${elapsed}" | bc)
echo "Average rate: ${avg_rps} req/s"
echo ""
echo "View metrics at:"
echo "  - Prometheus: http://localhost:9090"
echo "  - Grafana: http://localhost:3001"
echo "  - Raw metrics: ${APP_URL}/metrics"
echo "================================================"
