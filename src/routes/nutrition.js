import express from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const sumTotals = (meals) =>
  meals.reduce(
    (totals, meal) => ({
      calories: totals.calories + Number(meal.total_calories ?? 0),
      protein_g: totals.protein_g + Number(meal.total_protein_g ?? 0),
      carbs_g: totals.carbs_g + Number(meal.total_carbs_g ?? 0),
      fat_g: totals.fat_g + Number(meal.total_fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

router.get('/daily/:date', authenticate, async (req, res, next) => {
  try {
    const { date } = req.params;
    if (!DATE_PATTERN.test(date)) {
      throw new AppError('invalid_request', 'Date must be in YYYY-MM-DD format', 400);
    }

    const mealsResult = await pool.query(
      `SELECT id, meal_type, meal_date, total_calories, total_protein_g, total_carbs_g, total_fat_g, notes, logged_at
       FROM meals WHERE user_id = $1 AND meal_date = $2 ORDER BY logged_at`,
      [req.user.sub, date]
    );
    const meals = mealsResult.rows;

    const foodsResult = await pool.query(
      `SELECT id, meal_id, food_name, usda_food_id, serving_size_grams, servings_count,
              calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving
       FROM foods WHERE meal_id = ANY($1)`,
      [meals.map((m) => m.id)]
    );

    const foodsByMeal = new Map();
    for (const food of foodsResult.rows) {
      const list = foodsByMeal.get(food.meal_id) ?? [];
      list.push(food);
      foodsByMeal.set(food.meal_id, list);
    }

    res.json({
      date,
      meals: meals.map((meal) => ({ ...meal, foods: foodsByMeal.get(meal.id) ?? [] })),
      totals: sumTotals(meals),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/meals', authenticate, async (req, res, next) => {
  const { meal_type, meal_date, notes, foods } = req.body;

  if (!meal_type || !meal_date || !Array.isArray(foods) || foods.length === 0) {
    return next(new AppError('invalid_request', 'meal_type, meal_date, and at least one food are required', 400));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const totals = foods.reduce(
      (acc, food) => {
        const servings = Number(food.servings_count ?? 1);
        return {
          calories: acc.calories + Number(food.calories_per_serving ?? 0) * servings,
          protein_g: acc.protein_g + Number(food.protein_per_serving ?? 0) * servings,
          carbs_g: acc.carbs_g + Number(food.carbs_per_serving ?? 0) * servings,
          fat_g: acc.fat_g + Number(food.fat_per_serving ?? 0) * servings,
        };
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );

    const mealResult = await client.query(
      `INSERT INTO meals (user_id, meal_type, meal_date, total_calories, total_protein_g, total_carbs_g, total_fat_g, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, meal_type, meal_date, total_calories, total_protein_g, total_carbs_g, total_fat_g, notes, logged_at`,
      [req.user.sub, meal_type, meal_date, totals.calories, totals.protein_g, totals.carbs_g, totals.fat_g, notes || null]
    );
    const meal = mealResult.rows[0];

    const insertedFoods = [];
    for (const food of foods) {
      const foodResult = await client.query(
        `INSERT INTO foods (meal_id, food_name, usda_food_id, serving_size_grams, servings_count,
                             calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, meal_id, food_name, usda_food_id, serving_size_grams, servings_count,
                   calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving`,
        [
          meal.id,
          food.food_name,
          food.usda_food_id || null,
          food.serving_size_grams ?? null,
          food.servings_count ?? 1,
          food.calories_per_serving ?? 0,
          food.protein_per_serving ?? 0,
          food.carbs_per_serving ?? 0,
          food.fat_per_serving ?? 0,
        ]
      );
      insertedFoods.push(foodResult.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ meal: { ...meal, foods: insertedFoods } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/meals/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM meals WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.user.sub,
    ]);
    if (result.rows.length === 0) {
      throw new AppError('not_found', 'Meal not found', 404);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
