import { google } from 'googleapis';

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME;
const KEY_FILE = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_FILE;

// Subscription states where the user still has access - ACTIVE and IN_GRACE_PERIOD are
// self-explanatory; CANCELED means the user turned off auto-renew but Google still honors
// access until expiryTime, so it belongs here too.
const ENTITLED_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_CANCELED',
]);

let publisherClient = null;

function getClient() {
  if (publisherClient) return publisherClient;
  if (!PACKAGE_NAME || !KEY_FILE) return null;

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  publisherClient = google.androidpublisher({ version: 'v3', auth });
  return publisherClient;
}

export const isGooglePlayBillingConfigured = () => getClient() !== null;

// Asks Google directly whether a purchase token is real and what it's entitled to -
// the client's own claims about plan/price are never trusted.
export async function verifySubscriptionPurchase(purchaseToken) {
  const client = getClient();
  if (!client) throw new Error('Google Play billing verification is not configured');

  const { data } = await client.purchases.subscriptionsv2.get({
    packageName: PACKAGE_NAME,
    token: purchaseToken,
  });

  const lineItem = data.lineItems?.[0];
  if (!lineItem) throw new Error('Purchase token has no subscription line items');

  const expiryTime = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
  const subscriptionState = data.subscriptionState;

  return {
    subscriptionState,
    productId: lineItem.productId,
    basePlanId: lineItem.offerDetails?.basePlanId ?? null,
    expiryTime,
    latestOrderId: data.latestOrderId ?? null,
    acknowledgementState: data.acknowledgementState,
    isEntitled: ENTITLED_STATES.has(subscriptionState) && expiryTime !== null && expiryTime > new Date(),
  };
}

// Google auto-refunds a subscription purchase if it isn't acknowledged within 3 days,
// so this must run once per purchase after we've verified and granted entitlement.
export async function acknowledgeSubscriptionPurchase({ productId, purchaseToken }) {
  const client = getClient();
  if (!client) throw new Error('Google Play billing verification is not configured');

  await client.purchases.subscriptions.acknowledge({
    packageName: PACKAGE_NAME,
    subscriptionId: productId,
    token: purchaseToken,
    requestBody: {},
  });
}

export function getManagementUrl(productId) {
  if (!PACKAGE_NAME || !productId) {
    return 'https://play.google.com/store/account/subscriptions';
  }
  const params = new URLSearchParams({ sku: productId, package: PACKAGE_NAME });
  return `https://play.google.com/store/account/subscriptions?${params.toString()}`;
}
