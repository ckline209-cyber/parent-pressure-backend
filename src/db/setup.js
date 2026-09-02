import pool from './connection.js';

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  age INT,
  gender VARCHAR(20),
  height_cm INT,
  weight_kg DECIMAL(5,2),
  fitness_level VARCHAR(50),
  dietary_restrictions JSONB,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_active BOOLEAN DEFAULT false,
  subscription_start_date TIMESTAMP,
  subscription_end_date TIMESTAMP,
  google_play_subscription_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty_level VARCHAR(50),
  frequency_per_week INT,
  is_stock BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  instructions TEXT,
  muscle_groups JSONB,
  equipment_needed VARCHAR(255),
  order_in_workout INT,
  target_reps INT,
  target_sets INT,
  rest_seconds INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES workouts(id),
  assigned_date TIMESTAMP,
  completed_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_workout_id UUID NOT NULL REFERENCES user_workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  sets_completed INT,
  reps_per_set JSONB,
  weight_used_kg DECIMAL(6,2),
  rest_taken_seconds INT,
  rpe INT,
  notes TEXT,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_type VARCHAR(50),
  meal_date DATE,
  total_calories DECIMAL(7,2),
  total_protein_g DECIMAL(6,2),
  total_carbs_g DECIMAL(6,2),
  total_fat_g DECIMAL(6,2),
  notes TEXT,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_name VARCHAR(255),
  usda_food_id VARCHAR(255),
  serving_size_grams DECIMAL(7,2),
  servings_count DECIMAL(6,2),
  calories_per_serving DECIMAL(7,2),
  protein_per_serving DECIMAL(6,2),
  carbs_per_serving DECIMAL(6,2),
  fat_per_serving DECIMAL(6,2),
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_nutrition_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_calories DECIMAL(7,2),
  target_protein_g DECIMAL(6,2),
  target_carbs_g DECIMAL(6,2),
  target_fat_g DECIMAL(6,2),
  effective_from DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight_kg DECIMAL(5,2),
  body_fat_percentage DECIMAL(5,2),
  notes TEXT,
  snapshot_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50),
  subscription_tier VARCHAR(50),
  amount_usd DECIMAL(7,2),
  google_play_order_id VARCHAR(255),
  event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_workouts_user_id ON user_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_user_id ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(meal_date);
`;

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database schema...');
    await pool.query(schema);
    console.log('✓ Database schema created successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();