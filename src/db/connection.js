import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('✓ Database connected:', result.rows[0]);
  }
});

export default pool;