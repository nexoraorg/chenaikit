# Database Seeding System

## Overview

Comprehensive database seeding system for development, test, and production environments.

## Commands

- pnpm run seed:dev - Seed development database
- pnpm run seed:test - Seed test database  
- pnpm run seed:prod - Seed production database
- pnpm run seed:reset - Reset and reseed development
- pnpm run seed:validate - Validate existing data

## Environment Variables

- SEED_USERS - Number of users (default: 50)
- SEED_API_KEYS - Number of API keys (default: 100)
- SEED_API_USAGE - Number of usage records (default: 500)
- SEED_ADMIN_EMAIL - Admin email for production
- SEED_ADMIN_PASSWORD - Admin password for production

## Features

- Environment-specific seeds
- Factory pattern for data generation
- Proper relationship handling
- Batch inserts for performance
- CLI commands
- Data validation

## Usage

# Development
SEED_USERS=100 SEED_API_KEYS=200 pnpm run seed:dev

# Test
pnpm run seed:test

# Validate
pnpm run seed:validate
