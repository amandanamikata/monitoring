-- Initialize database with sample tables and data
-- This simulates a production database environment

CREATE DATABASE enterprise_db;
\c enterprise_db;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    account_type VARCHAR(50)
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    order_total DECIMAL(10, 2),
    order_status VARCHAR(50),
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(100),
    price DECIMAL(10, 2),
    stock_quantity INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    transaction_amount DECIMAL(10, 2),
    transaction_type VARCHAR(50),
    transaction_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO users (username, email, account_type) VALUES
    ('john_doe', 'john@example.com', 'premium'),
    ('jane_smith', 'jane@example.com', 'free'),
    ('bob_wilson', 'bob@example.com', 'premium'),
    ('alice_jones', 'alice@example.com', 'free'),
    ('charlie_brown', 'charlie@example.com', 'enterprise');

INSERT INTO products (name, category, price, stock_quantity) VALUES
    ('Laptop Pro', 'electronics', 1299.99, 45),
    ('Wireless Mouse', 'electronics', 29.99, 200),
    ('Office Chair', 'furniture', 349.99, 30),
    ('Desk Lamp', 'furniture', 79.99, 150),
    ('Notebook Set', 'stationery', 12.99, 500);

INSERT INTO orders (user_id, order_total, order_status, payment_method) VALUES
    (1, 1329.98, 'completed', 'credit_card'),
    (2, 29.99, 'completed', 'paypal'),
    (3, 349.99, 'pending', 'bank_transfer'),
    (1, 92.98, 'completed', 'credit_card'),
    (4, 12.99, 'failed', 'credit_card');

INSERT INTO transactions (order_id, transaction_amount, transaction_type, transaction_status) VALUES
    (1, 1329.98, 'payment', 'completed'),
    (2, 29.99, 'payment', 'completed'),
    (3, 349.99, 'payment', 'pending'),
    (4, 92.98, 'payment', 'completed'),
    (5, 12.99, 'payment', 'failed');

-- Create indexes for performance monitoring
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_transactions_order_id ON transactions(order_id);

-- Create a view for analytics
CREATE VIEW order_summary AS
SELECT
    u.username,
    u.account_type,
    COUNT(o.id) as total_orders,
    SUM(o.order_total) as total_spent,
    AVG(o.order_total) as avg_order_value
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.username, u.account_type;

-- Function to simulate database activity
CREATE OR REPLACE FUNCTION simulate_activity() RETURNS void AS $$
BEGIN
    -- Randomly update last_login for users
    UPDATE users SET last_login = NOW() WHERE id = floor(random() * 5 + 1);

    -- Simulate slow query with pg_sleep
    PERFORM pg_sleep(random() * 0.1);
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions for postgres_exporter
CREATE USER postgres_exporter WITH PASSWORD 'exporter_password';
GRANT CONNECT ON DATABASE enterprise_db TO postgres_exporter;
GRANT pg_monitor TO postgres_exporter;

GRANT USAGE ON SCHEMA public TO postgres_exporter;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgres_exporter;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO postgres_exporter;

-- Show database statistics
SELECT 'Database initialized successfully' as status;
