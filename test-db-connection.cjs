/**
 * Simple script to test database connection (CommonJS version)
 */
const { Pool } = require('@neondatabase/serverless');

async function testDatabaseConnection() {
  console.log('Testing database connection...');
  
  try {
    // Make sure DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL environment variable is not set');
      return;
    }
    
    console.log('Database URL is set');
    
    // Create a new pool without the ws workaround 
    // to see if that's causing issues
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
    
    // Try to get table names to verify schema access
    try {
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      console.log('Available tables:');
      tablesResult.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
    } catch (tableError) {
      console.error('Error fetching tables:', tableError.message);
    }
    
    // Clean up
    await pool.end();
    console.log('Connection pool closed');
    
  } catch (error) {
    console.error('Database connection error:');
    console.error(`Error code: ${error.code}`);
    console.error(`Error message: ${error.message}`);
    
    if (error.detail) {
      console.error(`Error detail: ${error.detail}`);
    }
    
    // Provide some troubleshooting guidance
    console.log('\nTroubleshooting tips:');
    console.log('1. Check if your DATABASE_URL is correct');
    console.log('2. Check if the Neon database service is up and running');
    console.log('3. Verify network connectivity from Replit to external services');
    console.log('4. Check if the database requires additional configuration');
  }
}

// Run the test
testDatabaseConnection();