import express from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const workoutsResult = await pool.query(
      `SELECT id, name, description, difficulty_level, frequency_per_week
       FROM workouts WHERE is_stock = true ORDER BY name`
    );
    const workouts = workoutsResult.rows;

    const exercisesResult = await pool.query(
      `SELECT id, workout_id, name, muscle_groups, equipment_needed,
              order_in_workout, target_sets, target_reps, rest_seconds
       FROM exercises WHERE workout_id = ANY($1) ORDER BY order_in_workout`,
      [workouts.map((w) => w.id)]
    );

    const exercisesByWorkout = new Map();
    for (const exercise of exercisesResult.rows) {
      const list = exercisesByWorkout.get(exercise.workout_id) ?? [];
      list.push(exercise);
      exercisesByWorkout.set(exercise.workout_id, list);
    }

    res.json({
      workouts: workouts.map((workout) => ({
        ...workout,
        exercises: exercisesByWorkout.get(workout.id) ?? [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/start', authenticate, async (req, res, next) => {
  try {
    const { id: workoutId } = req.params;

    const workout = await pool.query('SELECT id FROM workouts WHERE id = $1', [workoutId]);
    if (workout.rows.length === 0) {
      throw new AppError('not_found', 'Workout not found', 404);
    }

    const result = await pool.query(
      `INSERT INTO user_workouts (user_id, workout_id, assigned_date)
       VALUES ($1, $2, NOW())
       RETURNING id, workout_id, assigned_date`,
      [req.user.sub, workoutId]
    );

    res.status(201).json({ userWorkout: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
