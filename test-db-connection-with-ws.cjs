/**
 * Database connection test script that explicitly configures WebSocket
 */
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// This is the crucial step that may be missing in your application
neonConfig.webSocketConstructor = ws;

async function testDatabaseConnection() {
  console.log('Testing database connection with WebSocket configuration...');
  
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL environment variable is not set');
      return;
    }
    
    console.log('Database URL is set');
    
    // Create a new pool with WS configuration
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL 
    });
    
    console.log('Pool created, trying to connect...');
    
    // Try a simple query
    const result = await pool.query('SELECT NOW()');
    console.log('Connection successful!');
    console.log('Current time from DB:', result.rows[0].now);
    
    // Check database version
    const versionResult = await pool.query('SELECT version()');
    console.log('Database version:', versionResult.rows[0].version);
    
    // Get table names
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Available tables:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // Clean up
    await pool.end();
    console.log('Connection pool closed');
    
  } catch (error) {
    console.error('Database connection error:');
    console.error(`Error code: ${error.code || 'undefined'}`);
    console.error(`Error message: ${error.message}`);
    
    if (error.detail) {
      console.error(`Error detail: ${error.detail}`);
    }
  }
}

// Run the test
testDatabaseConnection();