import express from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  isGooglePlayBillingConfigured,
  verifySubscriptionPurchase,
  acknowledgeSubscriptionPurchase,
  getManagementUrl,
} from '../utils/googlePlayBilling.js';

const router = express.Router();

const UNIQUE_VIOLATION = '23505';

router.get('/status', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT subscription_tier, subscription_active, subscription_start_date, subscription_end_date
       FROM users WHERE id = $1`,
      [req.user.sub]
    );
    if (result.rows.length === 0) {
      throw new AppError('not_found', 'User not found', 404);
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Called by the app right after Play Billing hands it a purchase token. The token is
// verified against Google directly - nothing about plan, price, or active state is
// ever trusted from the client.
router.post('/verify-purchase', authenticate, async (req, res, next) => {
  const { purchaseToken } = req.body;
  if (!purchaseToken) {
    return next(new AppError('invalid_request', 'purchaseToken is required', 400));
  }
  if (!isGooglePlayBillingConfigured()) {
    return next(new AppError('not_configured', 'Google Play billing verification is not configured on this server', 503));
  }

  try {
    const purchase = await verifySubscriptionPurchase(purchaseToken);

    if (!purchase.isEntitled) {
      return next(new AppError('invalid_purchase', `Purchase is not active (state: ${purchase.subscriptionState})`, 400));
    }

    if (purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
      await acknowledgeSubscriptionPurchase({ productId: purchase.productId, purchaseToken });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `UPDATE users
         SET subscription_tier = 'premium', subscription_active = true,
             subscription_start_date = COALESCE(subscription_start_date, NOW()),
             subscription_end_date = $1,
             google_play_purchase_token = $2, google_play_product_id = $3,
             google_play_base_plan_id = $4, google_play_subscription_id = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING subscription_tier, subscription_active, subscription_start_date, subscription_end_date`,
        [purchase.expiryTime, purchaseToken, purchase.productId, purchase.basePlanId, purchase.latestOrderId, req.user.sub]
      );

      await client.query(
        `INSERT INTO subscription_events (user_id, event_type, subscription_tier, google_play_order_id, google_play_purchase_token)
         VALUES ($1, 'verify_purchase', 'premium', $2, $3)`,
        [req.user.sub, purchase.latestOrderId, purchaseToken]
      );

      await client.query('COMMIT');
      res.json({ subscription: userResult.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === UNIQUE_VIOLATION) {
        return next(new AppError('invalid_request', 'This purchase token is already linked to a different account', 409));
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// Google Play is the system of record for cancellation, not us - a subscription stays
// active until it actually expires even after the user cancels auto-renew, and we only
// find out definitively via the Play Store UI or a real-time developer notification
// (see /webhook/google-play). So "cancel" just hands the app a deep link into the
// Play Store's own subscription management screen instead of flipping a DB flag.
router.get('/cancel', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT google_play_product_id FROM users WHERE id = $1`,
      [req.user.sub]
    );
    if (result.rows.length === 0) {
      throw new AppError('not_found', 'User not found', 404);
    }
    res.json({ managementUrl: getManagementUrl(result.rows[0].google_play_product_id) });
  } catch (err) {
    next(err);
  }
});

// Push endpoint for Google Play Real-time Developer Notifications (via a Cloud Pub/Sub
// push subscription) - this is how we learn about renewals, cancellations, expirations,
// and grace/hold-period transitions that happen outside the app (e.g. in the Play Store
// UI, or a failed renewal charge). Protected by a shared secret query param rather than
// authenticate, since Pub/Sub push requests don't carry a user access token.
router.post('/webhook/google-play', async (req, res, next) => {
  try {
    const expectedSecret = process.env.GOOGLE_PLAY_WEBHOOK_SECRET;
    if (expectedSecret && req.query.token !== expectedSecret) {
      return res.status(401).end();
    }

    const dataB64 = req.body?.message?.data;
    if (!dataB64) return res.status(204).end();

    const payload = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf8'));
    const notification = payload.subscriptionNotification;
    if (!notification?.purchaseToken) return res.status(204).end();

    const purchase = await verifySubscriptionPurchase(notification.purchaseToken);

    await pool.query(
      `UPDATE users
       SET subscription_active = $1,
           subscription_tier = CASE WHEN $1 THEN 'premium' ELSE 'free' END,
           subscription_end_date = $2,
           updated_at = NOW()
       WHERE google_play_purchase_token = $3`,
      [purchase.isEntitled, purchase.expiryTime, notification.purchaseToken]
    );

    await pool.query(
      `INSERT INTO subscription_events (user_id, event_type, subscription_tier, google_play_purchase_token)
       SELECT id, 'play_notification', CASE WHEN $1 THEN 'premium' ELSE 'free' END, $2
       FROM users WHERE google_play_purchase_token = $2`,
      [purchase.isEntitled, notification.purchaseToken]
    );

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
