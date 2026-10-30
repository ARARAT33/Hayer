/**
 * Database Migration Runner
 * Manages database schema migrations for HAYER ecosystem
 */

const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config');
const path = require('path');
const fs = require('fs');
const { Umzug, SequelizeStorage } = require('umzug');

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  username: config.db.user,
  password: config.db.password,
  logging: config.env === 'development' ? console.log : false,
  pool: config.db.pool,
  ssl: config.db.ssl,
  dialectOptions: {
    ssl: config.db.ssl ? {
      require: true,
      rejectUnauthorized: false
    } : undefined
  }
});

// Migration runner
const runMigrations = async () => {
  console.log('Running database migrations...');
  
  const migrationsPath = path.join(__dirname, '../../migrations');
  
  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(migrationsPath, { recursive: true });
  }

  const umzug = new Umzug({
    migrations: {
      glob: path.join(migrationsPath, '*.js'),
      resolve: ({ name, path, context }) => {
        const migration = require(path);
        return {
          name,
          up: async () => migration.up(context, DataTypes),
          down: async () => migration.down(context, DataTypes)
        };
      }
    },
    storage: new SequelizeStorage({ sequelize, tableName: 'migrations' }),
    context: { sequelize, DataTypes },
    logger: console
  });

  try {
    const migrations = await umzug.up();
    console.log(`Migrations completed: ${migrations.length} migrations executed`);
    return migrations;
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Rollback migrations
const rollbackMigrations = async (steps = 1) => {
  console.log(`Rolling back ${steps} migration(s)...`);
  
  const migrationsPath = path.join(__dirname, '../../migrations');
  const umzug = new Umzug({
    migrations: {
      glob: path.join(migrationsPath, '*.js'),
      resolve: ({ name, path, context }) => {
        const migration = require(path);
        return {
          name,
          up: async () => migration.up(context, DataTypes),
          down: async () => migration.down(context, DataTypes)
        };
      }
    },
    storage: new SequelizeStorage({ sequelize, tableName: 'migrations' }),
    context: { sequelize, DataTypes },
    logger: console
  });

  try {
    const migrations = await umzug.down({ to: steps });
    console.log(`Rollback completed: ${migrations.length} migrations rolled back`);
    return migrations;
  } catch (error) {
    console.error('Rollback failed:', error);
    process.exit(1);
  }
};

// List migrations
const listMigrations = async () => {
  console.log('Listing migrations...');
  
  const migrationsPath = path.join(__dirname, '../../migrations');
  const umzug = new Umzug({
    migrations: {
      glob: path.join(migrationsPath, '*.js'),
      resolve: ({ name, path, context }) => {
        const migration = require(path);
        return {
          name,
          up: async () => migration.up(context, DataTypes),
          down: async () => migration.down(context, DataTypes)
        };
      }
    },
    storage: new SequelizeStorage({ sequelize, tableName: 'migrations' }),
    context: { sequelize, DataTypes },
    logger: console
  });

  try {
    const executed = await umzug.executed();
    const pending = await umzug.pending();
    
    console.log('\nExecuted migrations:');
    executed.forEach(m => console.log(`  ✓ ${m.name}`));
    
    console.log('\nPending migrations:');
    pending.forEach(m => console.log(`  ○ ${m.name}`));
    
    return { executed, pending };
  } catch (error) {
    console.error('Failed to list migrations:', error);
    process.exit(1);
  }
};

// Main function
const main = async () => {
  const action = process.argv[2];
  
  switch (action) {
    case 'up':
      await runMigrations();
      break;
    case 'down':
      const steps = parseInt(process.argv[3]) || 1;
      await rollbackMigrations(steps);
      break;
    case 'list':
      await listMigrations();
      break;
    default:
      console.log('Usage: node migrate.js [up|down|list]');
      console.log('  up    - Run all pending migrations');
      console.log('  down  - Rollback migrations (default: 1 step)');
      console.log('  list  - List executed and pending migrations');
      process.exit(1);
  }
  
  process.exit(0);
};

// Test database connection first
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    await main();
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
})();

module.exports = { sequelize, runMigrations, rollbackMigrations, listMigrations };
