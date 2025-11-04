# ==============================================================================
# DOCKERFILE FOR NODE.JS APPLICATION WITH PROMETHEUS METRICS
# ==============================================================================
#
# WHAT IS A DOCKERFILE?
# A Dockerfile is a text file containing instructions to build a Docker image.
# Think of it as a recipe that tells Docker how to create a container for your app.
#
# WHY DO WE NEED THIS?
# - Packages application and all dependencies into a portable container
# - Ensures consistent environment (works same on dev, test, prod)
# - Isolates app from host system
# - Makes deployment simple (just run the image)
#
# HOW IS THIS USED?
# 1. Docker Compose reads docker-compose.yml
# 2. Sees "build: ./app-service"
# 3. Looks for Dockerfile in app-service directory
# 4. Executes each instruction in order
# 5. Creates Docker image
# 6. Runs container from that image
#
# DOCKERFILE LAYERS:
# Each instruction (FROM, COPY, RUN, etc.) creates a new "layer"
# Docker caches layers, so if nothing changed, it reuses the cached layer
# This makes rebuilds MUCH faster
#
# ==============================================================================

# ==============================================================================
# BASE IMAGE SELECTION
# ==============================================================================

# FROM instruction specifies the base image to start from
# Format: FROM image:tag
#
# WHAT IS node:18-alpine?
# - node: Official Node.js Docker image from Docker Hub
# - 18: Node.js version 18 (LTS - Long Term Support)
# - alpine: Based on Alpine Linux (minimal Linux distribution)
#
# WHY Alpine?
# - Tiny size: ~40MB vs ~350MB for regular node image
# - Faster download and build times
# - Less surface area for security vulnerabilities
# - Contains just enough to run Node.js applications
#
# ALTERNATIVES:
# - node:18 (Debian-based, larger but more compatible)
# - node:18-slim (Debian-based but smaller)
# - node:20-alpine (newer Node.js version)
#
# WHERE DOES THIS IMAGE COME FROM?
# Docker Hub: https://hub.docker.com/_/node
# Docker automatically downloads it if not present locally
FROM node:18-alpine

# ==============================================================================
# METADATA (Optional but Recommended)
# ==============================================================================

# LABEL adds metadata to the image
# Format: LABEL key="value"
#
# WHY ADD LABELS?
# - Documentation (who maintains this, what version, etc.)
# - Automation (tools can read labels to make decisions)
# - Organization (filter images by labels)
#
# COMMON LABELS:
# - maintainer: Who to contact about this image
# - version: Image version
# - description: What this image contains
#
# VIEW LABELS: docker inspect <image> | grep Labels -A 10
LABEL maintainer="your-email@example.com"
LABEL description="Enterprise Node.js application with Prometheus metrics"
LABEL version="1.0.0"

# ==============================================================================
# WORKING DIRECTORY SETUP
# ==============================================================================

# WORKDIR sets the working directory inside the container
# All subsequent commands (RUN, COPY, CMD) execute in this directory
#
# WHAT THIS DOES:
# - Creates /app directory if it doesn't exist
# - Changes to that directory (like 'cd /app')
# - All relative paths are now relative to /app
#
# WHY /app?
# - Convention (most Node.js Dockerfiles use /app)
# - Clean separation from system directories
# - Easy to find application files
#
# WHAT IF WE DON'T USE WORKDIR?
# Commands would execute in / (root), mixing app files with system files (messy!)
WORKDIR /app

# ==============================================================================
# DEPENDENCY INSTALLATION (OPTIMIZATION)
# ==============================================================================

# COPY package.json first (separate from source code)
# Format: COPY <source-on-host> <destination-in-container>
#
# WHY COPY package.json FIRST (before source code)?
# DOCKER LAYER CACHING OPTIMIZATION!
#
# How it works:
# 1. First build:
#    - Copy package.json → Layer 1
#    - Run npm install → Layer 2 (downloads packages, slow!)
#    - Copy source code → Layer 3
#
# 2. Second build (after changing server.js):
#    - Copy package.json → Layer 1 (UNCHANGED, use cache)
#    - Run npm install → Layer 2 (UNCHANGED, use cache!) ← HUGE TIME SAVER
#    - Copy source code → Layer 3 (changed, rebuild)
#
# RESULT: npm install only runs when package.json changes, not on every code change!
# This saves MINUTES on each build (npm install is slow)
#
# BAD APPROACH (don't do this):
# COPY . .                    ← Copy everything
# RUN npm install            ← Runs every time ANY file changes (slow!)
#
# GOOD APPROACH (what we're doing):
# COPY package.json .        ← Copy just package.json
# RUN npm install           ← Only runs when package.json changes (fast!)
# COPY . .                  ← Copy rest of source code
COPY package.json ./

# RUN executes commands during image build (not when container starts)
# Format: RUN <command>
#
# npm install --production
# ├─ Reads package.json dependencies
# ├─ Downloads packages from npm registry
# ├─ Installs to node_modules/ directory
# └─ --production flag: Skip devDependencies (smaller image)
#
# WHAT ARE DEVDEPENDENCIES?
# - Development tools: linters (eslint), test frameworks (jest), etc.
# - Not needed in production (container only runs the app, doesn't develop it)
# - Skipping them saves space (can be 50-100MB+)
#
# WHAT HAPPENS HERE:
# 1. npm reads package.json (we just copied it)
# 2. Downloads express and prom-client from npm registry
# 3. Installs them in /app/node_modules/
# 4. Creates package-lock.json (if doesn't exist)
#
# WHY THIS IS A SEPARATE LAYER:
# - Cached until package.json changes
# - Faster rebuilds when only source code changes
RUN npm install --production

# ==============================================================================
# SOURCE CODE COPY
# ==============================================================================

# COPY all application source code
# Format: COPY <source> <destination>
#
# WHAT DOES '.' MEAN?
# - First '.': Current directory on host (app-service/)
# - Second '.': Current directory in container (/app - set by WORKDIR)
#
# WHAT GETS COPIED:
# All files in app-service/ directory:
# - server.js (our main application)
# - package.json (already copied above, but that's OK)
# - Any other files we might add later
#
# WHAT DOESN'T GET COPIED:
# - node_modules/ (we just installed it with npm install)
# - .dockerignore file can exclude files (like .git, .env, etc.)
#
# WHY COPY THIS LAST?
# - Source code changes frequently (every time you edit server.js)
# - Copying it last means previous layers (npm install) stay cached
# - Only this layer needs to rebuild when code changes
#
# RESULT IN CONTAINER:
# /app/
#  ├── node_modules/        (from npm install)
#  │   ├── express/
#  │   └── prom-client/
#  ├── package.json         (from first COPY and this COPY)
#  ├── package-lock.json    (from npm install)
#  └── server.js            (from this COPY)
COPY . .

# ==============================================================================
# PORT DOCUMENTATION
# ==============================================================================

# EXPOSE documents which port the container listens on
# Format: EXPOSE <port>
#
# WHAT THIS DOES:
# - Documents that app listens on port 3000
# - Shows up in 'docker ps' and 'docker inspect'
# - Serves as documentation for other developers
#
# WHAT THIS DOESN'T DO:
# - DOESN'T actually publish the port to host machine
# - DOESN'T open firewall rules
# - DOESN'T map ports
#
# HOW TO ACTUALLY EXPOSE PORT:
# In docker-compose.yml: ports: ["3000:3000"]
# Or with docker run: docker run -p 3000:3000 image
#
# WHY DOCUMENT IT IF IT DOESN'T DO ANYTHING?
# - Best practice (documents intent)
# - Tools like docker-compose can read this
# - Helps other developers understand the application
#
# OUR APP:
# server.js has: app.listen(3000) ← App listens on port 3000
# This EXPOSE says: "Hey, this container uses port 3000"
# docker-compose.yml maps: "3000:3000" ← Makes it accessible from host
EXPOSE 3000

# ==============================================================================
# HEALTH CHECK (Optional but Recommended)
# ==============================================================================

# HEALTHCHECK tells Docker how to test if container is healthy
# Format: HEALTHCHECK [OPTIONS] CMD <command>
#
# WHY HEALTH CHECKS?
# - Docker can detect if app crashed or hung
# - Orchestrators (Kubernetes, Docker Swarm) use this for restart decisions
# - Load balancers know when to send traffic
# - docker ps shows health status
#
# OPTIONS:
# --interval=30s      Check every 30 seconds
# --timeout=3s        Wait max 3 seconds for response
# --start-period=40s  Grace period (don't fail immediately after start)
# --retries=3         Mark unhealthy after 3 consecutive failures
#
# CMD wget OPTIONS:
# wget                   HTTP client (like curl)
# --no-verbose           Don't print progress
# --tries=1              Only try once
# --spider               Don't download, just check if URL exists
# --output-document=/dev/null  Discard output
# http://localhost:3000/health   Our health check endpoint
#
# WHAT HAPPENS:
# 1. Wait 40 seconds after container starts (start-period)
# 2. Every 30 seconds (interval):
#    a. Run: wget http://localhost:3000/health
#    b. If succeeds (exit code 0): healthy
#    c. If fails 3 times in a row: unhealthy
#
# HEALTH STATES:
# - starting: During start-period (first 40 seconds)
# - healthy: Health check passing
# - unhealthy: Health check failing 3+ times
#
# SEE HEALTH STATUS:
# docker ps                    Shows health status
# docker inspect <container>   Detailed health check results
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --output-document=/dev/null http://localhost:3000/health || exit 1

# ==============================================================================
# CONTAINER STARTUP COMMAND
# ==============================================================================

# CMD specifies the default command to run when container starts
# Format: CMD ["executable", "param1", "param2"]  (JSON array format, preferred)
#    or:  CMD command param1 param2              (shell form)
#
# WHY JSON ARRAY FORMAT?
# - More reliable (doesn't use shell, no variable expansion issues)
# - Better signal handling (SIGTERM, SIGINT work properly)
# - More explicit (exact command and arguments)
#
# WHAT THIS DOES:
# When container starts, Docker executes: node server.js
# This starts our Express application and begins listening on port 3000
#
# CMD VS RUN:
# - RUN: Executes during IMAGE BUILD (docker build)
#        Example: RUN npm install (installs packages into image)
#
# - CMD: Executes when CONTAINER STARTS (docker run)
#        Example: CMD ["node", "server.js"] (runs every time container starts)
#
# CAN YOU HAVE MULTIPLE CMDs?
# No! Only the LAST CMD in Dockerfile is used.
# If you need multiple commands, use a shell script or use &&:
# CMD ["sh", "-c", "command1 && command2"]
#
# CAN YOU OVERRIDE CMD?
# Yes! In docker-compose.yml with 'command:' or 'docker run image <command>'
# Example: docker run image node debug.js (overrides CMD)
#
# WHAT HAPPENS WHEN THIS RUNS:
# 1. Container starts
# 2. Docker executes: node server.js
# 3. Node.js starts
# 4. Loads server.js
# 5. Initializes Express
# 6. Registers Prometheus metrics
# 7. Starts HTTP server on port 3000
# 8. Logs "Enterprise Metrics Application running..."
# 9. Container keeps running until server stops
#
# HOW TO SEE THIS RUNNING:
# docker-compose logs app-service
# Should see: "Enterprise Metrics Application running on port 3000"
CMD ["node", "server.js"]

# ==============================================================================
# BUILD AND RUN SUMMARY
# ==============================================================================
#
# BUILD PROCESS (docker-compose up --build):
# 1. FROM: Pull node:18-alpine image
# 2. WORKDIR: Create /app directory
# 3. COPY package.json: Copy dependency list
# 4. RUN npm install: Install express and prom-client
# 5. COPY .: Copy server.js and other files
# 6. EXPOSE: Document port 3000
# 7. HEALTHCHECK: Set up health check
# 8. CMD: Set default startup command
# Result: Docker image ready to run
#
# RUN PROCESS (docker-compose up):
# 1. Docker creates container from image
# 2. Executes CMD: node server.js
# 3. Server starts on port 3000
# 4. Health check runs every 30 seconds
# 5. Prometheus can scrape http://app-service:3000/metrics
#
# ==============================================================================
# DOCKERFILE BEST PRACTICES USED HERE
# ==============================================================================
#
# ✅ Use Alpine base image (smaller size)
# ✅ Copy package.json before source code (layer caching)
# ✅ Use --production flag (exclude devDependencies)
# ✅ EXPOSE port for documentation
# ✅ Add HEALTHCHECK for monitoring
# ✅ Use JSON array format for CMD
# ✅ Add LABEL metadata
# ✅ Use WORKDIR instead of cd commands
# ✅ Combine related RUN commands (we only have one, so not applicable here)
# ✅ Order instructions from least to most frequently changing
#
# ==============================================================================
# IMAGE SIZE OPTIMIZATION
# ==============================================================================
#
# Current image: ~150-200MB
# Breakdown:
# - node:18-alpine base: ~40MB
# - npm packages: ~30-50MB (express + prom-client + dependencies)
# - Our application code: <1MB
# - OS utilities: ~70MB
#
# Could be smaller:
# - Use multi-stage build (build in one image, run in another): ~100MB
# - Use node:18-alpine-slim: ~80MB
# - But for development/learning, current size is fine!
#
# ==============================================================================
# TROUBLESHOOTING
# ==============================================================================
#
# "npm install fails":
# - Check package.json syntax
# - Try: docker-compose build --no-cache app-service
#
# "Cannot find module 'express'":
# - npm install didn't run
# - Rebuild: docker-compose build app-service
#
# "Port 3000 already in use":
# - Another process using port 3000
# - Change in docker-compose.yml: ports: ["3001:3000"]
#
# "Health check failing":
# - Check server.js has /health endpoint
# - Check app actually started: docker-compose logs app-service
# - Increase start-period: --start-period=60s
#
# ==============================================================================
