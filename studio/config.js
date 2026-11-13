/* KCBeyond AI studio settings.
   While `cloud` is empty nothing is for sale: Rainfort Plus sounds are free
   for everyone and the PrintProfit listing writer is hidden. */
self.STUDIO_CONFIG = {
  /* Your studio server address from studio-worker/SETUP.md, for example
     "https://kcbeyond-studio.yourname.workers.dev". */
  cloud: "",

  /* The price lines shown on the buy buttons. They must match the prices
     you created in Stripe. */
  prices: {
    rainfort_plus: "$9.99, one time",
    listing_pack: "$5 for 100 listings"
  }
};
