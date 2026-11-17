/* KC: Open Trail store settings. THE OWNER FILLS THESE IN. Nothing here is secret: Stripe price ids and the
   worker's address are public values. Never put a Stripe secret key, a password or a personal address in this file.

   While a value still says OWNER_FILLS_IN the store shows that item as "Coming soon" and can never start a checkout.
   Steps are in marketing/kc-open-trail/MONETIZATION.md.

   WORKER_URL       the https address of the deployed Dewclaw worker, with no slash at the end,
                    e.g. 'https://dewclaw.your-account.workers.dev'
   STRIPE_PRICE_IDS one Stripe price id ('price_...') per item. The same ids go into the worker's STRIPE_PRICES
                    setting; the worker, not this file, decides what is charged and what is granted. Leaving one
                    item as OWNER_FILLS_IN is also how to hold that item back.
   SUPPORT_CONTACT  where a grown-up asks for a refund or help (a support email address or an https contact page).
   PLAY_BILLING     only matters inside the Google Play app (js/channel.js). 'off' (the default): the Play app has no
                    real-money store at all, no prices and no checkout. 'on': the Play app sells the same 16 items through
                    Google Play Billing. Turn it on only after (1) the 16 products exist and are active in Play Console
                    with ids equal to the names below, (2) the worker has OT_PLAY_PACKAGE and the Google service account,
                    and (3) WORKER_URL above is filled in. The Play app never uses Stripe, whatever is set here. */
export const WORKER_URL = 'OWNER_FILLS_IN';

export const STRIPE_PRICE_IDS = {
  ot_gems_80: 'OWNER_FILLS_IN',          /* $0.99  */
  ot_gems_500: 'OWNER_FILLS_IN',         /* $4.99  */
  ot_gems_1200: 'OWNER_FILLS_IN',        /* $9.99  */
  ot_gems_2600: 'OWNER_FILLS_IN',        /* $19.99 */
  ot_gems_7000: 'OWNER_FILLS_IN',        /* $49.99 */
  ot_starter: 'OWNER_FILLS_IN',          /* $4.99  */
  ot_trail_pass: 'OWNER_FILLS_IN',       /* $5.99  */
  ot_pack_forest: 'OWNER_FILLS_IN',      /* $3.99  */
  ot_pack_galaxy: 'OWNER_FILLS_IN',      /* $3.99  */
  ot_pack_roadtrip: 'OWNER_FILLS_IN',    /* $3.99  */
  ot_pack_halloween: 'OWNER_FILLS_IN',   /* $3.99  */
  ot_treat_3: 'OWNER_FILLS_IN',          /* $1.99  */
  ot_treat_10: 'OWNER_FILLS_IN',         /* $4.99  */
  ot_supporter: 'OWNER_FILLS_IN',        /* $9.99  */
  ot_everything: 'OWNER_FILLS_IN',       /* $24.99 */
  ot_tip_3: 'OWNER_FILLS_IN'             /* $3.00  */
};

export const SUPPORT_CONTACT = 'OWNER_FILLS_IN';

export const PLAY_BILLING = 'off';
