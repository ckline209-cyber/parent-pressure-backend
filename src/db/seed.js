import pool from './connection.js';

const stockWorkouts = [
  {
    name: 'Upper Body Strength',
    description: 'Full upper body session covering chest, back, shoulders, and arms.',
    difficulty_level: 'beginner',
    frequency_per_week: 3,
    exercises: [
      { name: 'Barbell Bench Press', muscle_groups: ['chest', 'triceps', 'shoulders'], equipment_needed: 'barbell', target_sets: 4, target_reps: 8, rest_seconds: 90 },
      { name: 'Bent-Over Row', muscle_groups: ['back', 'biceps'], equipment_needed: 'barbell', target_sets: 4, target_reps: 8, rest_seconds: 90 },
      { name: 'Overhead Press', muscle_groups: ['shoulders', 'triceps'], equipment_needed: 'barbell', target_sets: 3, target_reps: 10, rest_seconds: 75 },
      { name: 'Lat Pulldown', muscle_groups: ['back', 'biceps'], equipment_needed: 'cable machine', target_sets: 3, target_reps: 10, rest_seconds: 60 },
      { name: 'Dumbbell Curl', muscle_groups: ['biceps'], equipment_needed: 'dumbbells', target_sets: 3, target_reps: 12, rest_seconds: 45 },
      { name: 'Triceps Pushdown', muscle_groups: ['triceps'], equipment_needed: 'cable machine', target_sets: 3, target_reps: 12, rest_seconds: 45 },
    ],
  },
  {
    name: 'Lower Body Strength',
    description: 'Full lower body session covering quads, hamstrings, glutes, and calves.',
    difficulty_level: 'beginner',
    frequency_per_week: 3,
    exercises: [
      { name: 'Barbell Back Squat', muscle_groups: ['quads', 'glutes'], equipment_needed: 'barbell', target_sets: 4, target_reps: 8, rest_seconds: 120 },
      { name: 'Romanian Deadlift', muscle_groups: ['hamstrings', 'glutes'], equipment_needed: 'barbell', target_sets: 4, target_reps: 8, rest_seconds: 90 },
      { name: 'Walking Lunge', muscle_groups: ['quads', 'glutes'], equipment_needed: 'dumbbells', target_sets: 3, target_reps: 12, rest_seconds: 60 },
      { name: 'Leg Press', muscle_groups: ['quads', 'glutes'], equipment_needed: 'machine', target_sets: 3, target_reps: 10, rest_seconds: 90 },
      { name: 'Seated Calf Raise', muscle_groups: ['calves'], equipment_needed: 'machine', target_sets: 3, target_reps: 15, rest_seconds: 45 },
      { name: 'Plank', muscle_groups: ['core'], equipment_needed: 'none', target_sets: 3, target_reps: 1, rest_seconds: 45 },
    ],
  },
];

async function seedDatabase() {
  try {
    const existing = await pool.query('SELECT COUNT(*) FROM workouts WHERE is_stock = true');
    if (Number(existing.rows[0].count) > 0) {
      console.log('✓ Stock workouts already present, skipping seed');
      process.exit(0);
    }

    console.log('🌱 Seeding stock workouts and exercises...');

    for (const workout of stockWorkouts) {
      const workoutResult = await pool.query(
        `INSERT INTO workouts (name, description, difficulty_level, frequency_per_week, is_stock)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id`,
        [workout.name, workout.description, workout.difficulty_level, workout.frequency_per_week]
      );
      const workoutId = workoutResult.rows[0].id;

      for (const [index, exercise] of workout.exercises.entries()) {
        await pool.query(
          `INSERT INTO exercises
             (workout_id, name, muscle_groups, equipment_needed, order_in_workout, target_reps, target_sets, rest_seconds)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            workoutId,
            exercise.name,
            JSON.stringify(exercise.muscle_groups),
            exercise.equipment_needed,
            index + 1,
            exercise.target_reps,
            exercise.target_sets,
            exercise.rest_seconds,
          ]
        );
      }

      console.log(`✓ Seeded "${workout.name}" with ${workout.exercises.length} exercises`);
    }

    console.log('✓ Database seeding complete');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
