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

router.get('/started/:id', authenticate, async (req, res, next) => {
  try {
    const { id: userWorkoutId } = req.params;

    const userWorkoutResult = await pool.query(
      `SELECT uw.id, uw.workout_id, uw.assigned_date, uw.completed_date, uw.notes,
              w.name AS workout_name
       FROM user_workouts uw
       JOIN workouts w ON w.id = uw.workout_id
       WHERE uw.id = $1 AND uw.user_id = $2`,
      [userWorkoutId, req.user.sub]
    );
    const userWorkout = userWorkoutResult.rows[0];
    if (!userWorkout) {
      throw new AppError('not_found', 'Started workout not found', 404);
    }

    const exercisesResult = await pool.query(
      `SELECT id, name, muscle_groups, equipment_needed, order_in_workout,
              target_sets, target_reps, rest_seconds
       FROM exercises WHERE workout_id = $1 ORDER BY order_in_workout`,
      [userWorkout.workout_id]
    );

    const logsResult = await pool.query(
      `SELECT id, exercise_id, sets_completed, reps_per_set, weight_used_kg,
              rest_taken_seconds, rpe, notes, logged_at
       FROM exercise_logs WHERE user_workout_id = $1 ORDER BY logged_at`,
      [userWorkoutId]
    );

    res.json({
      userWorkout,
      exercises: exercisesResult.rows,
      logs: logsResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/started/:id/complete', authenticate, async (req, res, next) => {
  try {
    const { id: userWorkoutId } = req.params;

    const result = await pool.query(
      `UPDATE user_workouts SET completed_date = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, workout_id, assigned_date, completed_date`,
      [userWorkoutId, req.user.sub]
    );
    if (result.rows.length === 0) {
      throw new AppError('not_found', 'Started workout not found', 404);
    }

    res.json({ userWorkout: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/logs', authenticate, async (req, res, next) => {
  try {
    const {
      user_workout_id,
      exercise_id,
      sets_completed,
      reps_per_set,
      weight_used_kg,
      rest_taken_seconds,
      rpe,
      notes,
    } = req.body;

    if (!user_workout_id || !exercise_id) {
      throw new AppError('invalid_request', 'user_workout_id and exercise_id are required', 400);
    }

    const userWorkout = await pool.query(
      'SELECT id FROM user_workouts WHERE id = $1 AND user_id = $2',
      [user_workout_id, req.user.sub]
    );
    if (userWorkout.rows.length === 0) {
      throw new AppError('not_found', 'Started workout not found', 404);
    }

    const exercise = await pool.query('SELECT id FROM exercises WHERE id = $1', [exercise_id]);
    if (exercise.rows.length === 0) {
      throw new AppError('not_found', 'Exercise not found', 404);
    }

    const result = await pool.query(
      `INSERT INTO exercise_logs
         (user_workout_id, exercise_id, sets_completed, reps_per_set, weight_used_kg, rest_taken_seconds, rpe, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, exercise_id, sets_completed, reps_per_set, weight_used_kg, rest_taken_seconds, rpe, notes, logged_at`,
      [
        user_workout_id,
        exercise_id,
        sets_completed ?? null,
        reps_per_set ? JSON.stringify(reps_per_set) : null,
        weight_used_kg ?? null,
        rest_taken_seconds ?? null,
        rpe ?? null,
        notes || null,
      ]
    );

    res.status(201).json({ log: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Deterministic rule-based progression, not an LLM call - see CLAUDE.md next-steps rationale.
// Weight-bearing exercises progress by adding weight; bodyweight exercises (no logged weight) progress by reps.
const WEIGHT_INCREMENT_KG = 2.5;

router.get('/exercises/:id/progression', authenticate, async (req, res, next) => {
  try {
    const { id: exerciseId } = req.params;

    const exerciseResult = await pool.query(
      'SELECT id, name, target_reps FROM exercises WHERE id = $1',
      [exerciseId]
    );
    const exercise = exerciseResult.rows[0];
    if (!exercise) {
      throw new AppError('not_found', 'Exercise not found', 404);
    }

    const lastLogResult = await pool.query(
      `SELECT el.reps_per_set, el.weight_used_kg, el.rpe
       FROM exercise_logs el
       JOIN user_workouts uw ON uw.id = el.user_workout_id
       WHERE el.exercise_id = $1 AND uw.user_id = $2
       ORDER BY el.logged_at DESC LIMIT 1`,
      [exerciseId, req.user.sub]
    );
    const lastLog = lastLogResult.rows[0];
    const targetReps = exercise.target_reps;

    if (!lastLog) {
      return res.json({
        exercise_id: exerciseId,
        has_history: false,
        suggested_weight_kg: null,
        suggested_reps: targetReps,
        rationale: 'No previous log for this exercise yet - start with a comfortable weight and log your first set.',
      });
    }

    const repsPerSet = lastLog.reps_per_set || [];
    const hitAllSets = targetReps != null && repsPerSet.length > 0 && repsPerSet.every((r) => r >= targetReps);
    const rpe = lastLog.rpe;
    const rpeOk = rpe === null || rpe === undefined || rpe <= 8;
    const lastWeight = lastLog.weight_used_kg !== null ? Number(lastLog.weight_used_kg) : null;

    let suggestedWeight = lastWeight;
    let suggestedReps = targetReps;
    let rationale;

    if (lastWeight === null) {
      if (hitAllSets && rpeOk) {
        suggestedReps = targetReps + 1;
        rationale = `You hit ${targetReps}+ reps on every set last time - try ${suggestedReps} reps next session.`;
      } else {
        rationale = `You didn't hit ${targetReps} reps on every set last time - repeat the same target and focus on form.`;
      }
    } else if (hitAllSets && rpeOk) {
      suggestedWeight = lastWeight + WEIGHT_INCREMENT_KG;
      rationale = `You hit ${targetReps}+ reps on every set at ${lastWeight}kg${rpe != null ? ` (RPE ${rpe})` : ''} - try ${suggestedWeight}kg next session.`;
    } else if (hitAllSets) {
      rationale = `You hit your reps but RPE was ${rpe} - repeat ${lastWeight}kg until it feels easier before adding weight.`;
    } else {
      rationale = `You didn't hit ${targetReps} reps on every set at ${lastWeight}kg - repeat ${lastWeight}kg and aim to complete all sets.`;
    }

    res.json({
      exercise_id: exerciseId,
      has_history: true,
      last_weight_kg: lastWeight,
      last_reps_per_set: repsPerSet,
      last_rpe: rpe ?? null,
      suggested_weight_kg: suggestedWeight,
      suggested_reps: suggestedReps,
      rationale,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
