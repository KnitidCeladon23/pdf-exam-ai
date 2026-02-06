-- PostgreSQL initialization script
-- This file is automatically executed when the database is first created

-- Enable UUID extension (if needed in the future)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set default timezone
SET timezone = 'UTC';

-- Performance tuning for Prisma
ALTER DATABASE "pdf-exam-ai" SET client_encoding TO 'UTF8';
ALTER DATABASE "pdf-exam-ai" SET default_transaction_isolation TO 'read committed';
ALTER DATABASE "pdf-exam-ai" SET timezone TO 'UTC';

-- Grant all privileges to postgres user
GRANT ALL PRIVILEGES ON DATABASE "pdf-exam-ai" TO postgres;

-- Log initialization
SELECT 'Database initialized successfully' AS status;
