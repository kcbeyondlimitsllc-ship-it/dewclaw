/* Dewclaw's care engine, cut from index.html by tools/build-pages.mjs. Do not edit: edit index.html and rebuild. */
(function(){
/* =========================================================================
   Plans.

   One source of truth for what each tier costs, what it unlocks, and which
   Stripe price it maps to. The server gates on `rank`; the marketing page
   renders from `features`. Adding a tier means editing this file only.
   ========================================================================= */

/* The member discount on the shop, in percent. Read by the server when it
   prices a basket and by the tier copy below, so the number printed on the
   pricing page is the number charged at checkout. */
const SHOP_DISCOUNT = 25;

/* DewclawMD questions per calendar month, by tier. Each question runs a model
   with live web research, so it has a real cost; the free allowance is
   there so people can see what it does before paying. */
const VETMD_QUOTA = { free: 3, plus: 30, beyond: 100 };

/* What Dewclaw Plus unlocks, in the order the chart shows it. The DewclawMD
   line is added by the app only where a server is answering. */
const PLUS_PERKS = [
  "Exercise and enrichment plan by breed energy",
  "Preventive-care calendar — vaccines, parasites, dental",
  "Breed watchlist — what to screen for and what to ask",
  "Grooming and dental routine by coat type",
  "Weight loss, gain or maintenance program",
  "Every pet in your home",
  "GPS walk tracker and the 7-day potty pattern",
  "All 12 training skills",
  "Sitter sheet and printable charts for the vet"
];

const TIERS = {
  free: {
    key: "free",
    rank: 0,
    name: "Free",
    blurb: "The numbers that matter, for up to three pets.",
    price: 0,
    priceLabel: "$0",
    period: "forever",
    priceEnv: null,
    features: [
      "One saved pet",
      "Life stage, healthy weight range and daily calories",
      "Full feeding plan — portions, meals, treat budget",
      "Weight and life-course charts",
      "Emergency warning signs",
      "Map of dog parks, dog-friendly trails, daycares and vets",
      `${VETMD_QUOTA.free} DewclawMD questions a month`
    ]
  },
  plus: {
    key: "plus",
    rank: 1,
    name: "Dewclaw Plus",
    blurb: "The whole care routine, for the whole household.",
    price: 299,
    priceLabel: "$2.99",
    period: "per month",
    priceEnv: "STRIPE_PRICE_PLUS",
    recommended: true,
    features: PLUS_PERKS
  },
  beyond: {
    key: "beyond",
    rank: 2,
    name: "Dewclaw Plus",
    blurb: "Everything Dewclaw does, for every pet in your home.",
    price: 299,
    priceLabel: "$2.99",
    period: "per month",
    priceEnv: "STRIPE_PRICE_BEYOND",
    features: PLUS_PERKS
  }
};

const ORDER = ["free", "plus", "beyond"];

/* Which tier does a capability need? Everything gates through this map, so
   moving a feature between tiers is a one-line change. */
const REQUIRES = {
  nutrition:  "free",
  urgent:     "free",
  activity:   "plus",
  preventive: "plus",
  grooming:   "plus",
  program:    "plus",
  print:      "plus",
  multipet:   "plus",
  watchlist:  "beyond",
  carelog:    "beyond",
  community:  "beyond",
  shopdiscount: "beyond",
  vetmd:      "free",       /* everyone signed in; the quota is what differs */
  chatread:   "free",       /* reading local chat needs an account, not a plan */
  localchat:  "plus",       /* posting in local chat */
  postevent:  "plus"
};

const rankOf = key => (TIERS[key] || TIERS.free).rank;
const has = (tierKey, capability) => rankOf(tierKey) >= rankOf(REQUIRES[capability] || "beyond");
const tierFor = key => TIERS[key] || TIERS.free;

/* Map a Stripe price id back to a tier — how the webhook knows what someone
   actually bought. */
function tierForPrice(priceId) {
  if (!priceId) return null;
  for (const k of ORDER) {
    const env = TIERS[k].priceEnv;
    if (env && process.env[env] === priceId) return k;
  }
  return null;
}

function publicTiers() {
  return ORDER.map(k => {
    const t = TIERS[k];
    return {
      key: t.key, name: t.name, blurb: t.blurb, priceLabel: t.priceLabel,
      period: t.period, features: t.features, recommended: !!t.recommended, rank: t.rank
    };
  });
}

const vetmdQuota = key => VETMD_QUOTA[key] ?? VETMD_QUOTA.free;

const PetLifeTiers = { SHOP_DISCOUNT, VETMD_QUOTA, vetmdQuota, TIERS, ORDER, REQUIRES, rankOf, has, tierFor, tierForPrice, publicTiers };
if (typeof module !== "undefined" && module.exports) module.exports = PetLifeTiers;
else self.PetLifeTiers = PetLifeTiers;
})();
(function(){
/* =========================================================================
   Second tranche of breed reference data.

   Kept apart from breeds.js so the original curated set stays readable and
   so the two can be reviewed independently. breeds.js merges these in, and
   a name here overrides the same name there.

   Same shape as breeds.js:
     kg  = healthy adult weight range
     yrs = typical lifespan
     e   = energy tier (see ENERGY)
     coat= grooming tier (see COAT)
     w   = predispositions, keyed into COND
   ========================================================================= */

const COND = {
  "Urate bladder stones":"A breed-specific defect in uric acid handling. Keep water intake high, ask about a purine-restricted diet, and treat straining to urinate as an emergency.",
  "Copper storage hepatopathy":"Copper accumulates in the liver over years. Bloodwork catches raised liver values long before symptoms; a low-copper diet manages it.",
  "Dermatomyositis":"An inherited skin and muscle condition of young herding dogs: crusting on the face, ear tips and toes. Sun exposure worsens it.",
  "Congenital heart defects":"Present from birth. A murmur heard at the puppy or kitten exam should be followed with an echocardiogram rather than watched.",
  "Primary lens luxation":"The lens slips out of place and causes sudden, painful glaucoma. There is a DNA test; a red, cloudy, painful eye is a same-day emergency.",
  "Osteochondritis dissecans":"A flap of joint cartilage separates in a fast-growing young dog, usually the shoulder. Controlled growth and lean weight are the preventives.",
  "Renal dysplasia":"Kidneys that never develop properly. Drinking and urinating heavily in a young dog needs bloodwork, not a bigger water bowl.",
  "Cerebellar abiotrophy":"An inherited loss of balance and coordination appearing in young adults. There is no treatment, but there is a test in several breeds.",
  "Transitional cell carcinoma":"Bladder cancer, notably more common in this breed. Repeated 'urinary infections' that keep coming back deserve imaging.",
  "Scotty cramp":"A harmless but alarming movement disorder brought on by excitement. It is not a seizure and it is not painful.",
  "Familial nephropathy":"Inherited kidney failure in young dogs. Ask about DNA testing before breeding and about early urine protein screening.",
  "Protein-losing nephropathy":"Protein leaks out through the kidneys. A urine protein:creatinine ratio at the annual exam is the cheap early warning.",
  "Pulmonic stenosis":"A narrowed valve on the right side of the heart. Usually found as a murmur in a puppy; often correctable with a balloon procedure.",
  "Follicular dysplasia":"Hair follicles that fail in a pattern, leaving symmetrical thinning. Cosmetic rather than painful, but worth distinguishing from thyroid disease.",
  "Primary hyperparathyroidism":"Raised blood calcium in older dogs of this breed: drinking, urinating, weakness. A calcium level on routine bloodwork finds it.",
  "Familial Shar-Pei fever":"Episodes of fever and swollen hocks. Repeated episodes can lead to amyloid deposits in the kidneys, so each one should be recorded.",
  "Alopecia X":"Coat loss over the trunk and tail in plush-coated breeds, sparing the head and legs. Rule out thyroid and adrenal disease first.",
  "Hydrocephalus":"Fluid on the brain in toy breeds: a domed skull, a soft spot that stays open, disorientation. Diagnosed by ultrasound or MRI.",
  "Long bone fractures":"Fine-boned legs break on ordinary jumps. Discourage furniture leaps and use ramps while they are young.",
  "Fanconi syndrome":"The kidneys leak sugar and electrolytes. Glucose in the urine without diabetes is the tell; it is managed, not cured.",
  "Inflammatory bowel disease":"Chronic vomiting, loose stool or weight loss from gut inflammation. Diet trials come before steroids.",
  "Chylothorax":"Lymph fluid collects around the lungs, causing quiet, laboured breathing. Any breathing change is urgent.",
  "Splenic torsion":"The spleen twists on its stalk — sudden pain, a distended belly, collapse. Same emergency category as bloat.",
  "Urinary incontinence":"Leaking while asleep, most often in spayed females. Very treatable; it is not a house-training failure.",
  "Polyneuropathy":"Progressive nerve disease causing weakness, a wobbly gait and a hoarse bark. DNA tests exist in several of these breeds.",
  "Immune-mediated rheumatic disease":"Shifting lameness, fever and stiffness from immune attack on the joints. Easy to mistake for an injury.",
  "Upper airway syndrome":"A breed-specific narrowing of the throat causing noisy breathing and exercise intolerance. Heat makes it worse.",
  "Patent ductus arteriosus":"A vessel that should close at birth stays open. Found as a continuous murmur in a puppy; correctable with surgery.",
  "Idiopathic head tremors":"Brief bobbing of the head in an otherwise alert dog. Distressing to watch, harmless, and not epilepsy — film it for your vet.",
  "Aortic thromboembolism":"A clot thrown from a diseased heart blocks the back legs. Sudden hind-limb paralysis with crying is an emergency within minutes.",
  "Flat-chested kitten syndrome":"A chest deformity in newborn kittens. Most mild cases resolve; severe ones need early veterinary help.",
  "Hereditary myopathy":"An inherited muscle weakness: a head bob, a low-slung stance, tiring quickly. Avoid anaesthesia without telling your vet the breed.",
  "Lordosis":"An inward curve of the spine seen in some short-legged cats. Mild cases need nothing; marked ones compress the chest."
};

const DOGS = {
  /* --- gundogs ------------------------------------------------------- */
  "springer":       {n:"English Springer Spaniel", size:"medium", kg:[18,25], yrs:[12,14], e:"high", coat:"silky", w:["Ear infections","Hip dysplasia","Progressive retinal atrophy","Atopic dermatitis","Dry eye (KCS)"]},
  "welshspringer":  {n:"Welsh Springer Spaniel", size:"medium", kg:[16,20], yrs:[12,15], e:"high", coat:"silky", w:["Hip dysplasia","Ear infections","Glaucoma","Hypothyroidism","Epilepsy"]},
  "brittany":       {n:"Brittany", size:"medium", kg:[14,18], yrs:[12,14], e:"vhigh", coat:"silky", w:["Hip dysplasia","Epilepsy","Ear infections","Hypothyroidism","Atopic dermatitis"]},
  "chessie":        {n:"Chesapeake Bay Retriever", size:"large", kg:[25,36], yrs:[10,13], e:"high", coat:"dense", w:["Hip and elbow dysplasia","Progressive retinal atrophy","Exercise-induced collapse","Von Willebrand disease","Atopic dermatitis"]},
  "flatcoat":       {n:"Flat-Coated Retriever", size:"large", kg:[25,32], yrs:[8,10], e:"high", coat:"silky", w:["Histiocytic sarcoma","Hip dysplasia","Osteosarcoma","Glaucoma","Gastric dilatation-volvulus (bloat)"]},
  "toller":         {n:"Nova Scotia Duck Tolling Retriever", size:"medium", kg:[17,23], yrs:[12,14], e:"vhigh", coat:"double", w:["Addison's disease","Progressive retinal atrophy","Hip dysplasia","Immune-mediated rheumatic disease","Deafness"]},
  "irishsetter":    {n:"Irish Setter", size:"large", kg:[24,32], yrs:[12,15], e:"vhigh", coat:"silky", w:["Gastric dilatation-volvulus (bloat)","Hip dysplasia","Progressive retinal atrophy","Hypothyroidism","Epilepsy"]},
  "englishsetter":  {n:"English Setter", size:"large", kg:[20,36], yrs:[10,12], e:"high", coat:"silky", w:["Congenital deafness","Hip dysplasia","Hypothyroidism","Atopic dermatitis","Elbow dysplasia"]},
  "gordonsetter":   {n:"Gordon Setter", size:"large", kg:[20,36], yrs:[10,12], e:"high", coat:"silky", w:["Hip dysplasia","Progressive retinal atrophy","Gastric dilatation-volvulus (bloat)","Hypothyroidism","Cerebellar abiotrophy"]},
  "pointer":        {n:"Pointer", size:"large", kg:[20,34], yrs:[12,15], e:"vhigh", coat:"short", w:["Hip dysplasia","Congenital deafness","Entropion","Atopic dermatitis","Hypothyroidism"]},
  "gwp":            {n:"German Wirehaired Pointer", size:"large", kg:[23,32], yrs:[12,14], e:"vhigh", coat:"wiry", w:["Hip dysplasia","Von Willebrand disease","Ear infections","Entropion","Elbow dysplasia"]},
  "spinone":        {n:"Spinone Italiano", size:"large", kg:[28,39], yrs:[10,12], e:"moderate", coat:"wiry", w:["Hip and elbow dysplasia","Gastric dilatation-volvulus (bloat)","Ear infections","Entropion","Cerebellar ataxia"]},
  "pwd":            {n:"Portuguese Water Dog", size:"medium", kg:[16,27], yrs:[11,13], e:"vhigh", coat:"curly", w:["Hip dysplasia","Progressive retinal atrophy","Addison's disease","Dilated cardiomyopathy","Cataracts"]},

  /* --- terriers ------------------------------------------------------ */
  "borderterrier":  {n:"Border Terrier", size:"small", kg:[5,7], yrs:[12,15], e:"high", coat:"wiry", w:["Idiopathic head tremors","Patellar luxation","Hip dysplasia","Mitral valve disease","Atopic dermatitis"]},
  "cairn":          {n:"Cairn Terrier", size:"small", kg:[6,7.5], yrs:[13,15], e:"high", coat:"wiry", w:["Patellar luxation","Legg-Calve-Perthes disease","Portosystemic shunt","Atopic dermatitis","Cataracts"]},
  "scottie":        {n:"Scottish Terrier", size:"small", kg:[8,10], yrs:[11,13], e:"moderate", coat:"wiry", w:["Transitional cell carcinoma","Von Willebrand disease","Craniomandibular osteopathy","Scotty cramp","Atopic dermatitis"]},
  "airedale":       {n:"Airedale Terrier", size:"large", kg:[19,32], yrs:[11,14], e:"high", coat:"wiry", w:["Hip dysplasia","Hypothyroidism","Gastric dilatation-volvulus (bloat)","Atopic dermatitis","Von Willebrand disease"]},
  "bullterrier":    {n:"Bull Terrier", size:"medium", kg:[23,32], yrs:[11,14], e:"high", coat:"short", w:["Congenital deafness","Familial nephropathy","Mitral valve disease","Atopic dermatitis","Patellar luxation"]},
  "staffie":        {n:"Staffordshire Bull Terrier", size:"medium", kg:[11,17], yrs:[12,14], e:"high", coat:"short", w:["Hip dysplasia","Cataracts","Atopic dermatitis","Patellar luxation","Mast cell tumors"]},
  "wheaten":        {n:"Soft Coated Wheaten Terrier", size:"medium", kg:[13,18], yrs:[12,14], e:"high", coat:"silky", w:["Protein-losing nephropathy","Renal dysplasia","Inflammatory bowel disease","Atopic dermatitis","Addison's disease"]},
  "foxterrier":     {n:"Smooth Fox Terrier", size:"small", kg:[6.5,8], yrs:[12,15], e:"high", coat:"short", w:["Primary lens luxation","Patellar luxation","Congenital deafness","Legg-Calve-Perthes disease","Cataracts"]},
  "norwich":        {n:"Norwich Terrier", size:"small", kg:[5,5.5], yrs:[12,15], e:"high", coat:"wiry", w:["Upper airway syndrome","Patellar luxation","Hip dysplasia","Epilepsy","Dental disease"]},
  "welshterrier":   {n:"Welsh Terrier", size:"small", kg:[9,10], yrs:[12,15], e:"high", coat:"wiry", w:["Patellar luxation","Primary lens luxation","Hip dysplasia","Atopic dermatitis","Hypothyroidism"]},
  "kerryblue":      {n:"Kerry Blue Terrier", size:"medium", kg:[15,18], yrs:[12,15], e:"high", coat:"curly", w:["Cerebellar abiotrophy","Hip dysplasia","Dry eye (KCS)","Entropion","Atopic dermatitis"]},
  "silkyterrier":   {n:"Silky Terrier", size:"toy", kg:[3.5,4.5], yrs:[13,15], e:"moderate", coat:"silky", w:["Patellar luxation","Legg-Calve-Perthes disease","Dental disease","Tracheal collapse","Diabetes mellitus"]},
  "giantschnauzer": {n:"Giant Schnauzer", size:"giant", kg:[25,48], yrs:[10,12], e:"vhigh", coat:"wiry", w:["Hip dysplasia","Gastric dilatation-volvulus (bloat)","Hypothyroidism","Osteosarcoma","Epilepsy"]},
  "stdschnauzer":   {n:"Standard Schnauzer", size:"medium", kg:[14,20], yrs:[13,16], e:"high", coat:"wiry", w:["Hip dysplasia","Cataracts","Pulmonic stenosis","Follicular dysplasia","Hypothyroidism"]},
  "blackrussian":   {n:"Black Russian Terrier", size:"giant", kg:[36,59], yrs:[10,12], e:"high", coat:"wiry", w:["Hip and elbow dysplasia","Progressive retinal atrophy","Urate bladder stones","Ear infections","Gastric dilatation-volvulus (bloat)"]},
  "tibetanterrier": {n:"Tibetan Terrier", size:"medium", kg:[8,14], yrs:[12,15], e:"moderate", coat:"silky", w:["Progressive retinal atrophy","Hip dysplasia","Primary lens luxation","Patellar luxation","Cataracts"]},

  /* --- toys ----------------------------------------------------------- */
  "papillon":       {n:"Papillon", size:"toy", kg:[2,4.5], yrs:[14,16], e:"high", coat:"silky", w:["Patellar luxation","Dental disease","Progressive retinal atrophy","Von Willebrand disease","Hypoglycemia"]},
  "pomeranian":     {n:"Pomeranian", size:"toy", kg:[1.5,3.5], yrs:[12,16], e:"moderate", coat:"double", w:["Tracheal collapse","Patellar luxation","Dental disease","Alopecia X","Hypoglycemia"]},
  "pekingese":      {n:"Pekingese", size:"toy", kg:[3,6], yrs:[12,15], e:"low", coat:"silky", w:["Brachycephalic airway syndrome","Intervertebral disc disease","Corneal ulcers","Heat intolerance","Dental disease"]},
  "japanesechin":   {n:"Japanese Chin", size:"toy", kg:[1.5,4], yrs:[10,14], e:"low", coat:"silky", w:["Brachycephalic airway syndrome","Patellar luxation","Corneal ulcers","Mitral valve disease","Cataracts"]},
  "brusselsgriffon":{n:"Brussels Griffon", size:"toy", kg:[3.5,5.5], yrs:[12,15], e:"moderate", coat:"wiry", w:["Brachycephalic airway syndrome","Patellar luxation","Corneal ulcers","Hydrocephalus","Dental disease"]},
  "affenpinscher":  {n:"Affenpinscher", size:"toy", kg:[3,6], yrs:[12,15], e:"moderate", coat:"wiry", w:["Brachycephalic airway syndrome","Patellar luxation","Hip dysplasia","Dental disease","Corneal ulcers"]},
  "minpin":         {n:"Miniature Pinscher", size:"toy", kg:[3.5,5], yrs:[12,16], e:"high", coat:"short", w:["Patellar luxation","Legg-Calve-Perthes disease","Progressive retinal atrophy","Dental disease","Hypothyroidism"]},
  "chinesecrested": {n:"Chinese Crested", size:"toy", kg:[3.5,5.5], yrs:[13,18], e:"moderate", coat:"hairless", w:["Dental disease","Patellar luxation","Progressive retinal atrophy","Atopic dermatitis","Legg-Calve-Perthes disease"]},
  "italiangreyhound":{n:"Italian Greyhound", size:"small", kg:[3,6], yrs:[14,15], e:"high", coat:"short", w:["Dental disease","Long bone fractures","Patellar luxation","Progressive retinal atrophy","Anesthesia sensitivity"]},
  "coton":          {n:"Coton de Tulear", size:"small", kg:[3.5,6.5], yrs:[14,16], e:"moderate", coat:"silky", w:["Patellar luxation","Hip dysplasia","Progressive retinal atrophy","Cataracts","Dental disease"]},
  "lhasa":          {n:"Lhasa Apso", size:"small", kg:[5,8], yrs:[12,15], e:"low", coat:"silky", w:["Renal dysplasia","Dry eye (KCS)","Patellar luxation","Intervertebral disc disease","Progressive retinal atrophy"]},

  /* --- hounds --------------------------------------------------------- */
  "basenji":        {n:"Basenji", size:"medium", kg:[9,11], yrs:[13,14], e:"high", coat:"short", w:["Fanconi syndrome","Progressive retinal atrophy","Hypothyroidism","Pyruvate kinase deficiency","Inflammatory bowel disease"]},
  "afghan":         {n:"Afghan Hound", size:"large", kg:[23,27], yrs:[12,14], e:"high", coat:"silky", w:["Anesthesia sensitivity","Hip dysplasia","Cataracts","Hypothyroidism","Chylothorax"]},
  "saluki":         {n:"Saluki", size:"large", kg:[18,29], yrs:[12,14], e:"high", coat:"silky", w:["Anesthesia sensitivity","Dilated cardiomyopathy","Hypothyroidism","Hemangiosarcoma","Dental disease"]},
  "borzoi":         {n:"Borzoi", size:"giant", kg:[27,48], yrs:[9,14], e:"moderate", coat:"silky", w:["Anesthesia sensitivity","Gastric dilatation-volvulus (bloat)","Dilated cardiomyopathy","Osteosarcoma","Degenerative myelopathy"]},
  "wolfhound":      {n:"Irish Wolfhound", size:"giant", kg:[48,70], yrs:[6,10], e:"moderate", coat:"wiry", w:["Dilated cardiomyopathy","Gastric dilatation-volvulus (bloat)","Osteosarcoma","Portosystemic shunt","Hip dysplasia"]},
  "deerhound":      {n:"Scottish Deerhound", size:"giant", kg:[34,50], yrs:[8,11], e:"moderate", coat:"wiry", w:["Dilated cardiomyopathy","Gastric dilatation-volvulus (bloat)","Osteosarcoma","Anesthesia sensitivity","Hypothyroidism"]},
  "elkhound":       {n:"Norwegian Elkhound", size:"medium", kg:[20,25], yrs:[12,15], e:"high", coat:"double", w:["Hip dysplasia","Progressive retinal atrophy","Fanconi syndrome","Obesity","Hypothyroidism"]},
  "plotthound":     {n:"Plott Hound", size:"medium", kg:[18,27], yrs:[12,14], e:"vhigh", coat:"short", w:["Hip dysplasia","Ear infections","Gastric dilatation-volvulus (bloat)","Entropion","Atopic dermatitis"]},
  "coonhound":      {n:"Black and Tan Coonhound", size:"large", kg:[25,34], yrs:[10,12], e:"high", coat:"short", w:["Hip dysplasia","Ear infections","Gastric dilatation-volvulus (bloat)","Hypothyroidism","Obesity"]},
  "redbone":        {n:"Redbone Coonhound", size:"large", kg:[20,32], yrs:[12,15], e:"high", coat:"short", w:["Hip dysplasia","Ear infections","Obesity","Gastric dilatation-volvulus (bloat)","Atopic dermatitis"]},

  /* --- working & guardian ---------------------------------------------- */
  "malamute":       {n:"Alaskan Malamute", size:"giant", kg:[34,39], yrs:[10,14], e:"high", coat:"double", w:["Hip dysplasia","Zinc-responsive dermatosis","Cataracts","Hypothyroidism","Heat intolerance"]},
  "chowchow":       {n:"Chow Chow", size:"medium", kg:[20,32], yrs:[8,12], e:"low", coat:"double", w:["Entropion","Hip and elbow dysplasia","Glaucoma","Heat intolerance","Hypothyroidism"]},
  "sharpei":        {n:"Chinese Shar-Pei", size:"medium", kg:[18,29], yrs:[8,12], e:"low", coat:"short", w:["Familial Shar-Pei fever","Entropion","Skin fold dermatitis","Ear infections","Amyloidosis"]},
  "swissie":        {n:"Greater Swiss Mountain Dog", size:"giant", kg:[38,64], yrs:[8,11], e:"moderate", coat:"short", w:["Hip and elbow dysplasia","Gastric dilatation-volvulus (bloat)","Splenic torsion","Osteochondritis dissecans","Urinary incontinence"]},
  "leonberger":     {n:"Leonberger", size:"giant", kg:[41,77], yrs:[7,9], e:"moderate", coat:"double", w:["Hip and elbow dysplasia","Osteosarcoma","Polyneuropathy","Gastric dilatation-volvulus (bloat)","Heat intolerance"]},
  "anatolian":      {n:"Anatolian Shepherd", size:"giant", kg:[40,68], yrs:[11,13], e:"moderate", coat:"double", w:["Hip dysplasia","Gastric dilatation-volvulus (bloat)","Entropion","Hypothyroidism","Anesthesia sensitivity"]},
  "bullmastiff":    {n:"Bullmastiff", size:"giant", kg:[45,59], yrs:[7,9], e:"moderate", coat:"short", w:["Gastric dilatation-volvulus (bloat)","Hip and elbow dysplasia","Lymphoma","Entropion","Brachycephalic airway syndrome"]},
  "dogue":          {n:"Dogue de Bordeaux", size:"giant", kg:[45,68], yrs:[5,8], e:"moderate", coat:"short", w:["Brachycephalic airway syndrome","Hip dysplasia","Dilated cardiomyopathy","Gastric dilatation-volvulus (bloat)","Heat intolerance"]},
  "neomastiff":     {n:"Neapolitan Mastiff", size:"giant", kg:[50,70], yrs:[7,9], e:"low", coat:"short", w:["Entropion","Hip and elbow dysplasia","Gastric dilatation-volvulus (bloat)","Skin fold dermatitis","Heat intolerance"]},
  "tibetanmastiff": {n:"Tibetan Mastiff", size:"giant", kg:[34,68], yrs:[10,14], e:"moderate", coat:"double", w:["Hip and elbow dysplasia","Hypothyroidism","Polyneuropathy","Entropion","Heat intolerance"]},
  "americanbulldog":{n:"American Bulldog", size:"large", kg:[27,54], yrs:[10,14], e:"high", coat:"short", w:["Hip and elbow dysplasia","Cruciate ligament rupture","Entropion","Atopic dermatitis","Dry eye (KCS)"]},
  "bouvier":        {n:"Bouvier des Flandres", size:"giant", kg:[32,54], yrs:[10,12], e:"high", coat:"wiry", w:["Hip dysplasia","Gastric dilatation-volvulus (bloat)","Glaucoma","Hypothyroidism","Laryngeal paralysis"]},

  /* --- herding --------------------------------------------------------- */
  "cardigan":       {n:"Cardigan Welsh Corgi", size:"small", kg:[11,17], yrs:[12,15], e:"moderate", coat:"double", w:["Intervertebral disc disease","Degenerative myelopathy","Hip dysplasia","Progressive retinal atrophy","Obesity"]},
  "tervuren":       {n:"Belgian Tervuren", size:"large", kg:[20,34], yrs:[12,14], e:"vhigh", coat:"double", w:["Hip dysplasia","Epilepsy","Progressive retinal atrophy","Anesthesia sensitivity","Hypothyroidism"]},
  "oes":            {n:"Old English Sheepdog", size:"large", kg:[27,45], yrs:[10,12], e:"moderate", coat:"double", w:["Hip dysplasia","Hypothyroidism","Cataracts","Cerebellar ataxia","Deafness"]},
  "beardedcollie":  {n:"Bearded Collie", size:"medium", kg:[18,25], yrs:[12,14], e:"high", coat:"double", w:["Hip dysplasia","Addison's disease","Hypothyroidism","Progressive retinal atrophy","Atopic dermatitis"]},
  "roughcollie":    {n:"Rough Collie", size:"large", kg:[18,34], yrs:[12,14], e:"moderate", coat:"double", w:["MDR1 drug sensitivity","Collie eye anomaly","Dermatomyositis","Progressive retinal atrophy","Hip dysplasia"]},
  "miniaussie":     {n:"Miniature American Shepherd", size:"small", kg:[9,14], yrs:[12,15], e:"vhigh", coat:"double", w:["MDR1 drug sensitivity","Collie eye anomaly","Hip dysplasia","Cataracts","Epilepsy"]},
  "schipperke":     {n:"Schipperke", size:"small", kg:[4,7], yrs:[13,15], e:"high", coat:"double", w:["Patellar luxation","Hypothyroidism","Progressive retinal atrophy","Epilepsy","Dental disease"]},
  "keeshond":       {n:"Keeshond", size:"medium", kg:[16,20], yrs:[12,15], e:"moderate", coat:"double", w:["Hip dysplasia","Patellar luxation","Epilepsy","Primary hyperparathyroidism","Hypothyroidism"]},
  "catahoula":      {n:"Catahoula Leopard Dog", size:"large", kg:[18,43], yrs:[10,14], e:"vhigh", coat:"short", w:["Congenital deafness","Hip dysplasia","Progressive retinal atrophy","Atopic dermatitis","Obesity"]},
  "jindo":          {n:"Korean Jindo", size:"medium", kg:[15,23], yrs:[12,15], e:"high", coat:"double", w:["Hip dysplasia","Hypothyroidism","Progressive retinal atrophy","Atopic dermatitis","Cataracts"]},
  "dalmatian":      {n:"Dalmatian", size:"large", kg:[20,32], yrs:[11,13], e:"vhigh", coat:"short", w:["Congenital deafness","Urate bladder stones","Atopic dermatitis","Hip dysplasia","Glaucoma"]},
  "xolo":           {n:"Xoloitzcuintli (Standard)", size:"medium", kg:[11,18], yrs:[13,18], e:"moderate", coat:"hairless", w:["Dental disease","Atopic dermatitis","Patellar luxation","Hip dysplasia","Cataracts"]},

  /* --- popular crosses -------------------------------------------------- */
  "bernedoodle":    {n:"Bernedoodle", size:"large", kg:[23,41], yrs:[12,15], e:"moderate", coat:"curly", w:["Hip and elbow dysplasia","Progressive retinal atrophy","Atopic dermatitis","Ear infections","Histiocytic sarcoma"]},
  "cavapoo":        {n:"Cavapoo", size:"small", kg:[5,11], yrs:[12,15], e:"moderate", coat:"curly", w:["Mitral valve disease","Patellar luxation","Ear infections","Progressive retinal atrophy","Atopic dermatitis"]},
  "cockapoo":       {n:"Cockapoo", size:"small", kg:[5.5,11], yrs:[12,15], e:"moderate", coat:"curly", w:["Ear infections","Patellar luxation","Progressive retinal atrophy","Atopic dermatitis","Hip dysplasia"]},
  "maltipoo":       {n:"Maltipoo", size:"toy", kg:[2.5,5.5], yrs:[12,16], e:"moderate", coat:"curly", w:["Patellar luxation","Dental disease","Portosystemic shunt","Progressive retinal atrophy","Hypoglycemia"]},
  "aussiedoodle":   {n:"Aussiedoodle", size:"medium", kg:[14,30], yrs:[11,13], e:"vhigh", coat:"curly", w:["MDR1 drug sensitivity","Hip dysplasia","Progressive retinal atrophy","Atopic dermatitis","Epilepsy"]},
  "pomsky":         {n:"Pomsky", size:"small", kg:[7,14], yrs:[12,15], e:"high", coat:"double", w:["Patellar luxation","Tracheal collapse","Hip dysplasia","Dental disease","Cataracts"]}
};

const CATS = {
  "birman":         {n:"Birman", size:"cat", kg:[4,5.5], yrs:[13,16], e:"moderate", coat:"longcat", w:["Hypertrophic cardiomyopathy","Polycystic kidney disease","Dental disease","Obesity","Hairball and coat matting"]},
  "tonkinese":      {n:"Tonkinese", size:"cat", kg:[2.7,5.5], yrs:[14,18], e:"high", coat:"shortcat", w:["Asthma","Gingivitis","Amyloidosis","Progressive retinal atrophy","Dental disease"]},
  "himalayan":      {n:"Himalayan", size:"cat", kg:[3,5.5], yrs:[12,15], e:"low", coat:"longcat", w:["Polycystic kidney disease","Brachycephalic airway syndrome","Hairball and coat matting","Dental disease","Progressive retinal atrophy"]},
  "cornishrex":     {n:"Cornish Rex", size:"cat", kg:[2.7,4.5], yrs:[12,16], e:"high", coat:"shortcat", w:["Hypertrophic cardiomyopathy","Patellar luxation","Hereditary myopathy","Heat intolerance","Dental disease"]},
  "selkirkrex":     {n:"Selkirk Rex", size:"cat", kg:[3.5,7], yrs:[13,16], e:"moderate", coat:"longcat", w:["Polycystic kidney disease","Hypertrophic cardiomyopathy","Hip dysplasia","Obesity","Hairball and coat matting"]},
  "americancurl":   {n:"American Curl", size:"cat", kg:[2.3,4.5], yrs:[13,16], e:"moderate", coat:"shortcat", w:["Ear infections","Hypertrophic cardiomyopathy","Dental disease","Obesity","Chronic kidney disease"]},
  "balinese":       {n:"Balinese", size:"cat", kg:[2.5,5], yrs:[12,20], e:"high", coat:"longcat", w:["Progressive retinal atrophy","Amyloidosis","Asthma","Dental disease","Hairball and coat matting"]},
  "bombay":         {n:"Bombay", size:"cat", kg:[3,5], yrs:[12,16], e:"moderate", coat:"shortcat", w:["Hypertrophic cardiomyopathy","Brachycephalic airway syndrome","Obesity","Gingivitis","Dental disease"]},
  "chartreux":      {n:"Chartreux", size:"cat", kg:[3,7], yrs:[12,15], e:"moderate", coat:"shortcat", w:["Patellar luxation","Hip dysplasia","Polycystic kidney disease","Obesity","Dental disease"]},
  "egyptianmau":    {n:"Egyptian Mau", size:"cat", kg:[3,5], yrs:[12,15], e:"high", coat:"shortcat", w:["Hypertrophic cardiomyopathy","Asthma","Pyruvate kinase deficiency","Dental disease","Chronic kidney disease"]},
  "japanesebobtail":{n:"Japanese Bobtail", size:"cat", kg:[2.5,4.5], yrs:[14,18], e:"high", coat:"shortcat", w:["Dental disease","Obesity","Chronic kidney disease","Hypertrophic cardiomyopathy","Feline lower urinary tract disease"]},
  "korat":          {n:"Korat", size:"cat", kg:[2.5,4.5], yrs:[15,18], e:"moderate", coat:"shortcat", w:["Hypertrophic cardiomyopathy","Dental disease","Chronic kidney disease","Obesity","Feline lower urinary tract disease"]},
  "munchkin":       {n:"Munchkin", size:"cat", kg:[2.5,4], yrs:[12,15], e:"moderate", coat:"shortcat", w:["Lordosis","Hip and joint arthritis","Hypertrophic cardiomyopathy","Obesity","Dental disease"]},
  "ocicat":         {n:"Ocicat", size:"cat", kg:[2.7,6.5], yrs:[12,18], e:"high", coat:"shortcat", w:["Hypertrophic cardiomyopathy","Pyruvate kinase deficiency","Amyloidosis","Progressive retinal atrophy","Dental disease"]},
  "ragamuffin":     {n:"Ragamuffin", size:"cat", kg:[4.5,9], yrs:[12,16], e:"low", coat:"longcat", w:["Hypertrophic cardiomyopathy","Polycystic kidney disease","Obesity","Hairball and coat matting","Dental disease"]},
  "singapura":      {n:"Singapura", size:"cat", kg:[1.8,3.6], yrs:[11,15], e:"high", coat:"shortcat", w:["Pyruvate kinase deficiency","Dental disease","Progressive retinal atrophy","Chronic kidney disease","Obesity"]},
  "somali":         {n:"Somali", size:"cat", kg:[3,5], yrs:[12,16], e:"high", coat:"longcat", w:["Pyruvate kinase deficiency","Progressive retinal atrophy","Amyloidosis","Gingivitis","Hairball and coat matting"]},
  "turkishvan":     {n:"Turkish Van", size:"cat", kg:[3,9], yrs:[12,17], e:"high", coat:"longcat", w:["Congenital deafness","Hypertrophic cardiomyopathy","Obesity","Hairball and coat matting","Dental disease"]},
  "britishlonghair":{n:"British Longhair", size:"cat", kg:[4,8], yrs:[12,17], e:"low", coat:"longcat", w:["Hypertrophic cardiomyopathy","Polycystic kidney disease","Obesity","Hairball and coat matting","Dental disease"]}
};

const PetLifeBreedsExtra = { COND, DOGS, CATS };
if (typeof module !== "undefined" && module.exports) module.exports = PetLifeBreedsExtra;
else self.PetLifeBreedsExtra = PetLifeBreedsExtra;
})();
(function(){
/* Breed reference data and shared care lookups.
   Server-side only: this file is required by lib/blueprint.js and never
   shipped to the browser in the hosted build. */


/* ---- shared condition notes (keyed, so breeds stay DRY) ---- */
const COND = {
  "Hip dysplasia":"Loose hip joints that grind into arthritis. Ask about OFA or PennHIP screening; keeping them lean is the single biggest lever you control.",
  "Elbow dysplasia":"Front-limb lameness that usually shows up before two years old. Worth an orthopedic exam if you see a head-bob limp after exercise.",
  "Hip and elbow dysplasia":"Joint malformation leading to early arthritis. Ask about OFA screening; lean body weight delays onset by years.",
  "Gastric dilatation-volvulus (bloat)":"The stomach fills with gas and twists. It kills within hours. Feed measured meals, skip the raised bowl, and ask your surgeon about a preventive gastropexy at spay or neuter.",
  "Obesity":"The most common preventable disease in pets. Weigh food, count treats, and re-score body condition monthly.",
  "Intervertebral disc disease":"Disc material presses on the spinal cord. Use a harness not a collar, block couch and stair jumping, and treat sudden back pain or wobbly hind legs as an emergency.",
  "Brachycephalic airway syndrome":"A short skull with normal-length soft tissue means every breath is work. Avoid heat and exertion; loud snoring and exercise intolerance are surgical red flags, not personality.",
  "Heat intolerance":"This build sheds heat poorly. Walk in the cool hours, never leave them in a car, and learn heatstroke signs.",
  "Dental disease":"Most pets have periodontal disease by age three. Daily brushing plus professional cleaning under anesthesia is what actually works.",
  "Patellar luxation":"Kneecaps that slip out of the groove, causing a skipping gait. Grade it at the annual exam before it becomes arthritis.",
  "Tracheal collapse":"A weak windpipe causing a honking cough. Harness only, keep weight down, avoid smoke.",
  "Progressive retinal atrophy":"Inherited, gradual blindness. A DNA test exists for many breeds; night-vision loss is the first sign.",
  "Cataracts":"Cloudy lens, often reversible with surgery. Also screen for diabetes when they appear suddenly.",
  "Hypothyroidism":"Low thyroid causing weight gain, coat loss, and lethargy. A cheap blood test finds it; a daily pill fixes it.",
  "Cushing's disease":"Excess cortisol: drinking, urinating, panting, pot belly. Confirmed by blood testing.",
  "Addison's disease":"Too little cortisol. Vague waxing-waning illness and collapse under stress. Easily missed, very treatable.",
  "Diabetes mellitus":"Watch for drinking, urinating, and weight loss despite good appetite. Lean body weight cuts the risk sharply.",
  "Epilepsy":"Inherited seizures typically starting between one and five years. Film any seizure; duration guides treatment.",
  "Degenerative myelopathy":"A painless, progressive loss of hind-limb coordination in older dogs. DNA test available.",
  "Dilated cardiomyopathy":"The heart muscle thins and stretches. Ask about a screening echocardiogram and Holter monitor.",
  "Mitral valve disease":"A leaky heart valve; it starts as a murmur years before symptoms. Annual auscultation, then echo once a murmur is heard.",
  "Hypertrophic cardiomyopathy":"The most common feline heart disease; the muscle thickens silently. Ask about screening echo, especially before anesthesia.",
  "Subaortic stenosis":"A congenital narrowing below the aortic valve. Any murmur in a young dog of this breed deserves an echo.",
  "Osteosarcoma":"Aggressive bone cancer. Persistent limb lameness or a firm swelling in a large-breed dog needs radiographs, not rest.",
  "Hemangiosarcoma":"A blood-vessel cancer of the spleen or heart that bleeds suddenly. Sudden weakness or pale gums is an emergency.",
  "Lymphoma":"Check for firm, enlarged lymph nodes under the jaw and behind the knees at home each month.",
  "Mast cell tumors":"Any new skin lump on this breed deserves a needle aspirate rather than a wait-and-see.",
  "Histiocytic sarcoma":"A breed-specific cancer. Report unexplained weight loss, lameness, or lethargy early.",
  "Bladder stones":"Straining, blood, or frequent small urinations. Diet and water intake are the main preventives.",
  "Chronic kidney disease":"Very common in older cats. Annual bloodwork plus urine concentration catches it years before symptoms.",
  "Hyperthyroidism":"An overactive thyroid in cats over eight: weight loss with a big appetite, restlessness, vomiting. Bloodwork confirms it.",
  "Feline lower urinary tract disease":"Straining in the litter box is a life-threatening blockage in male cats. Go in immediately.",
  "Polycystic kidney disease":"Inherited fluid cysts in the kidneys. A DNA test exists; ultrasound confirms.",
  "Ear infections":"Drop or hairy ears trap moisture. Dry them after swimming and check weekly for odor or head shaking.",
  "Atopic dermatitis":"Environmental allergy causing itchy feet, ears, and belly. Modern treatments are far better than steroids.",
  "Cruciate ligament rupture":"A knee ligament tear causing sudden hind-limb lameness. Weight control and steady conditioning lower the risk.",
  "Von Willebrand disease":"An inherited clotting disorder. Test before any elective surgery.",
  "MDR1 drug sensitivity":"A gene variant that makes common drugs (including some dewormers and sedatives) dangerous. One cheek swab, once, for life. Tell every vet.",
  "Collie eye anomaly":"An inherited eye malformation. Screened by an ophthalmologist in puppies.",
  "Anesthesia sensitivity":"Low body fat and altered drug metabolism change the safe protocol. Tell any new vet the breed before sedation.",
  "Portosystemic shunt":"A blood vessel bypasses the liver. Stunted growth, disorientation after meals; bile acid testing diagnoses it.",
  "Dry eye (KCS)":"Reduced tear production. Thick discharge and squinting; a tear test at the annual exam catches it early.",
  "Corneal ulcers":"Prominent eyes injure easily. Squinting or pawing at an eye is a same-day visit.",
  "Glaucoma":"Painful pressure inside the eye. A red, cloudy, or suddenly blind eye is an emergency.",
  "Entropion":"Eyelids that roll inward and scrape the cornea. Surgically correctable.",
  "Skin fold dermatitis":"Deep facial or tail folds trap moisture. Wipe and dry them a few times a week.",
  "Legg-Calve-Perthes disease":"The hip bone loses blood supply in small-breed puppies, causing limping between five and eight months.",
  "Hemivertebrae":"Malformed spinal bones in screw-tailed breeds; can cause hind-limb weakness in young dogs.",
  "Pancreatitis":"Painful inflammation, often triggered by fatty food. No table scraps; watch for a hunched posture and vomiting.",
  "Hyperlipidemia":"High blood fats predisposing to pancreatitis. Fasted bloodwork checks it.",
  "Deafness":"Congenital, often linked to white coats and blue eyes. A BAER test confirms it; train to hand signals.",
  "Exocrine pancreatic insufficiency":"The pancreas stops making digestive enzymes: ravenous appetite, weight loss, greasy stool. Enzyme powder treats it.",
  "Laryngeal paralysis":"Older large dogs with a raspy bark and noisy breathing that worsens in heat. Ask about it before it becomes a crisis.",
  "Exercise-induced collapse":"A genetic condition causing hind-limb collapse after intense exercise. DNA test available.",
  "Sebaceous adenitis":"Immune attack on the oil glands: dull coat, scaling, hair loss along the back.",
  "Wobbler syndrome":"Neck vertebrae compress the spinal cord, causing a wobbly, tippy gait. Use a harness.",
  "Cystinuria":"Cystine stones in the urine. Ask about DNA testing and urine monitoring.",
  "Osteochondrodysplasia":"A cartilage defect present in every folded-ear cat, causing painful arthritis. Watch for stiffness and reluctance to jump.",
  "Asthma":"Coughing that looks like a hairball but produces nothing. Reduce dust, litter dust, and aerosols.",
  "Amyloidosis":"Protein deposits damaging kidneys or liver in certain breeds. Annual bloodwork.",
  "Pyruvate kinase deficiency":"An inherited anemia. A DNA test exists; ask before breeding or surgery.",
  "Hepatic lipidosis":"A cat that stops eating for even two days can develop liver failure. Loss of appetite is urgent, not something to wait out.",
  "Megacolon":"Chronic constipation from poor nerve supply. Track litter box output.",
  "Gingivitis":"Red, painful gum margins. Common in this breed young; needs proactive dental care.",
  "Hairball and coat matting":"Long coats mat behind the ears and in the armpits. Mats pull on skin and hide wounds.",
  "Zinc-responsive dermatosis":"Crusting around the eyes, muzzle, and paws that responds to zinc supplementation.",
  "Spinal muscular atrophy":"An inherited weakness in the hind end appearing in kittens. DNA test available.",
  "Congenital deafness":"Present from birth, common with merle or white coats. BAER test confirms.",
  "Separation anxiety":"Genuine panic when left alone, not misbehavior. Early crate and alone-time training helps; ask about behavioral support.",
  "Cerebellar ataxia":"An inherited coordination disorder appearing in young adults.",
  "Hypoglycemia":"Toy puppies can crash their blood sugar. Small frequent meals until six months.",
  "Pug dog encephalitis":"A breed-specific brain inflammation causing seizures in young adults. Any seizure needs a workup.",
  "Craniomandibular osteopathy":"Painful jaw bone growth in terrier puppies, usually resolving by a year.",
  "Hip and joint arthritis":"Expect stiffness after rest and reluctance on stairs. Joint diets and controlled exercise slow it."
};

/* ---- energy / coat / stage helper tables ---- */
const ENERGY = {
  low:      {mins:[20,30],  label:"Low",       adj:0.85},
  moderate: {mins:[45,60],  label:"Moderate",  adj:1.00},
  high:     {mins:[60,90],  label:"High",      adj:1.15},
  vhigh:    {mins:[90,120], label:"Very high", adj:1.30}
};

const COAT = {
  short:   {brush:"Once a week with a rubber curry brush", bath:"Every 6–12 weeks", shed:"Steady year-round shedding"},
  dense:   {brush:"Twice a week; daily during the spring and fall blowouts", bath:"Every 6–8 weeks", shed:"Heavy seasonal coat blows"},
  double:  {brush:"Two to three times a week with an undercoat rake", bath:"Every 8–12 weeks — never shave the double coat", shed:"Two heavy blowouts a year"},
  silky:   {brush:"Daily — fine hair mats within a day", bath:"Every 3–4 weeks", shed:"Low shedding, high maintenance"},
  curly:   {brush:"Daily to the skin, plus a trim every 6–8 weeks", bath:"With each groom", shed:"Barely sheds; mats instead"},
  wiry:    {brush:"Twice a week; hand-strip or clip every 8–12 weeks", bath:"Every 6–8 weeks", shed:"Low shedding"},
  longcat: {brush:"Daily, especially the armpits and behind the ears", bath:"Rarely — only if greasy or soiled", shed:"Year-round, with mats if skipped"},
  shortcat:{brush:"Weekly — more in spring", bath:"Rarely needed", shed:"Moderate, more indoors"},
  hairless:{brush:"No brushing; wipe the skin down 2–3 times a week", bath:"Weekly — skin oils build up fast", shed:"None, but oily skin and dirty ears"}
};

/* ---- breeds ----------------------------------------------------------
   kg = healthy adult weight range, yrs = typical lifespan            */
const DOGS = {
  "mix-toy":      {n:"Mixed breed — toy (under 10 lb)", size:"toy", kg:[1.5,4.5], yrs:[12,16], e:"moderate", coat:"short", w:["Dental disease","Patellar luxation","Tracheal collapse","Obesity","Hypoglycemia"]},
  "mix-small":    {n:"Mixed breed — small (10–25 lb)", size:"small", kg:[4.5,11], yrs:[12,15], e:"moderate", coat:"short", w:["Dental disease","Patellar luxation","Obesity","Atopic dermatitis","Ear infections"]},
  "mix-medium":   {n:"Mixed breed — medium (25–55 lb)", size:"medium", kg:[11,25], yrs:[11,14], e:"high", coat:"short", w:["Hip dysplasia","Cruciate ligament rupture","Obesity","Dental disease","Atopic dermatitis"]},
  "mix-large":    {n:"Mixed breed — large (55–90 lb)", size:"large", kg:[25,41], yrs:[10,13], e:"high", coat:"short", w:["Hip dysplasia","Cruciate ligament rupture","Gastric dilatation-volvulus (bloat)","Hip and joint arthritis","Obesity"]},
  "mix-giant":    {n:"Mixed breed — giant (90 lb+)", size:"giant", kg:[41,70], yrs:[8,11], e:"moderate", coat:"short", w:["Gastric dilatation-volvulus (bloat)","Hip dysplasia","Osteosarcoma","Hip and joint arthritis","Dilated cardiomyopathy"]},
  "labrador":     {n:"Labrador Retriever", size:"large", kg:[25,36], yrs:[10,12], e:"high", coat:"dense", w:["Obesity","Hip and elbow dysplasia","Exercise-induced collapse","Laryngeal paralysis","Progressive retinal atrophy"]},
  "goldenret":    {n:"Golden Retriever", size:"large", kg:[25,34], yrs:[10,12], e:"high", coat:"double", w:["Hemangiosarcoma","Lymphoma","Hip and elbow dysplasia","Hypothyroidism","Atopic dermatitis"]},
  "gsd":          {n:"German Shepherd Dog", size:"large", kg:[22,40], yrs:[9,13], e:"vhigh", coat:"double", w:["Hip and elbow dysplasia","Degenerative myelopathy","Gastric dilatation-volvulus (bloat)","Exocrine pancreatic insufficiency","Hemangiosarcoma"]},
  "frenchie":     {n:"French Bulldog", size:"small", kg:[8,14], yrs:[10,12], e:"low", coat:"short", w:["Brachycephalic airway syndrome","Intervertebral disc disease","Heat intolerance","Skin fold dermatitis","Atopic dermatitis"]},
  "bulldog":      {n:"Bulldog (English)", size:"medium", kg:[18,25], yrs:[8,10], e:"low", coat:"short", w:["Brachycephalic airway syndrome","Heat intolerance","Hip dysplasia","Skin fold dermatitis","Dental disease"]},
  "poodle-std":   {n:"Poodle (Standard)", size:"large", kg:[20,32], yrs:[12,15], e:"high", coat:"curly", w:["Addison's disease","Gastric dilatation-volvulus (bloat)","Sebaceous adenitis","Hip dysplasia","Progressive retinal atrophy"]},
  "poodle-mini":  {n:"Poodle (Miniature)", size:"small", kg:[5,8], yrs:[13,15], e:"moderate", coat:"curly", w:["Patellar luxation","Legg-Calve-Perthes disease","Progressive retinal atrophy","Epilepsy","Dental disease"]},
  "poodle-toy":   {n:"Poodle (Toy)", size:"toy", kg:[2,4], yrs:[13,16], e:"moderate", coat:"curly", w:["Patellar luxation","Tracheal collapse","Dental disease","Progressive retinal atrophy","Hypoglycemia"]},
  "beagle":       {n:"Beagle", size:"medium", kg:[9,14], yrs:[12,15], e:"moderate", coat:"short", w:["Obesity","Intervertebral disc disease","Epilepsy","Hypothyroidism","Ear infections"]},
  "rottweiler":   {n:"Rottweiler", size:"large", kg:[35,60], yrs:[8,10], e:"high", coat:"short", w:["Hip and elbow dysplasia","Osteosarcoma","Subaortic stenosis","Cruciate ligament rupture","Gastric dilatation-volvulus (bloat)"]},
  "dachshund":    {n:"Dachshund (Standard)", size:"small", kg:[7,15], yrs:[12,16], e:"moderate", coat:"short", w:["Intervertebral disc disease","Obesity","Patellar luxation","Cushing's disease","Dental disease"]},
  "dachshund-mini":{n:"Dachshund (Miniature)", size:"toy", kg:[4,5.5], yrs:[12,16], e:"moderate", coat:"short", w:["Intervertebral disc disease","Obesity","Dental disease","Progressive retinal atrophy","Patellar luxation"]},
  "gsp":          {n:"German Shorthaired Pointer", size:"large", kg:[20,32], yrs:[12,14], e:"vhigh", coat:"short", w:["Hip dysplasia","Gastric dilatation-volvulus (bloat)","Von Willebrand disease","Ear infections","Separation anxiety"]},
  "corgi":        {n:"Pembroke Welsh Corgi", size:"small", kg:[10,14], yrs:[12,13], e:"moderate", coat:"double", w:["Intervertebral disc disease","Degenerative myelopathy","Obesity","Hip dysplasia","Von Willebrand disease"]},
  "aussie":       {n:"Australian Shepherd", size:"medium", kg:[16,32], yrs:[12,15], e:"vhigh", coat:"double", w:["MDR1 drug sensitivity","Hip dysplasia","Collie eye anomaly","Epilepsy","Cataracts"]},
  "yorkie":       {n:"Yorkshire Terrier", size:"toy", kg:[2,3.5], yrs:[13,16], e:"moderate", coat:"silky", w:["Tracheal collapse","Portosystemic shunt","Patellar luxation","Dental disease","Hypoglycemia"]},
  "boxer":        {n:"Boxer", size:"large", kg:[25,32], yrs:[10,12], e:"high", coat:"short", w:["Dilated cardiomyopathy","Mast cell tumors","Subaortic stenosis","Brachycephalic airway syndrome","Hypothyroidism"]},
  "cavalier":     {n:"Cavalier King Charles Spaniel", size:"small", kg:[5.9,8.2], yrs:[9,14], e:"moderate", coat:"silky", w:["Mitral valve disease","Patellar luxation","Ear infections","Dry eye (KCS)","Hip dysplasia"]},
  "doberman":     {n:"Doberman Pinscher", size:"large", kg:[27,45], yrs:[10,12], e:"high", coat:"short", w:["Dilated cardiomyopathy","Von Willebrand disease","Wobbler syndrome","Hypothyroidism","Gastric dilatation-volvulus (bloat)"]},
  "greatdane":    {n:"Great Dane", size:"giant", kg:[45,90], yrs:[7,10], e:"moderate", coat:"short", w:["Gastric dilatation-volvulus (bloat)","Dilated cardiomyopathy","Osteosarcoma","Wobbler syndrome","Hip dysplasia"]},
  "husky":        {n:"Siberian Husky", size:"medium", kg:[16,27], yrs:[12,14], e:"vhigh", coat:"double", w:["Zinc-responsive dermatosis","Progressive retinal atrophy","Hip dysplasia","Cataracts","Hypothyroidism"]},
  "shihtzu":      {n:"Shih Tzu", size:"small", kg:[4,7.5], yrs:[10,16], e:"low", coat:"silky", w:["Brachycephalic airway syndrome","Dental disease","Dry eye (KCS)","Patellar luxation","Intervertebral disc disease"]},
  "bernese":      {n:"Bernese Mountain Dog", size:"giant", kg:[32,52], yrs:[7,10], e:"moderate", coat:"double", w:["Histiocytic sarcoma","Hip and elbow dysplasia","Degenerative myelopathy","Cruciate ligament rupture","Gastric dilatation-volvulus (bloat)"]},
  "bordercollie": {n:"Border Collie", size:"medium", kg:[14,20], yrs:[12,15], e:"vhigh", coat:"double", w:["Collie eye anomaly","MDR1 drug sensitivity","Hip dysplasia","Epilepsy","Deafness"]},
  "sheltie":      {n:"Shetland Sheepdog", size:"small", kg:[6,12], yrs:[12,14], e:"high", coat:"double", w:["MDR1 drug sensitivity","Collie eye anomaly","Hypothyroidism","Dermatomyositis","Patellar luxation"]},
  "minschnauzer": {n:"Miniature Schnauzer", size:"small", kg:[5,9], yrs:[12,15], e:"moderate", coat:"wiry", w:["Hyperlipidemia","Pancreatitis","Bladder stones","Cushing's disease","Diabetes mellitus"]},
  "cocker":       {n:"Cocker Spaniel", size:"medium", kg:[11,14], yrs:[10,14], e:"moderate", coat:"silky", w:["Ear infections","Dry eye (KCS)","Mitral valve disease","Progressive retinal atrophy","Hypothyroidism"]},
  "chihuahua":    {n:"Chihuahua", size:"toy", kg:[1.5,3], yrs:[12,18], e:"moderate", coat:"short", w:["Patellar luxation","Tracheal collapse","Dental disease","Mitral valve disease","Hypoglycemia"]},
  "pug":          {n:"Pug", size:"small", kg:[6,8], yrs:[12,15], e:"low", coat:"short", w:["Brachycephalic airway syndrome","Pug dog encephalitis","Corneal ulcers","Obesity","Hemivertebrae"]},
  "boston":       {n:"Boston Terrier", size:"small", kg:[5,11], yrs:[11,13], e:"moderate", coat:"short", w:["Brachycephalic airway syndrome","Corneal ulcers","Patellar luxation","Cataracts","Hemivertebrae"]},
  "havanese":     {n:"Havanese", size:"small", kg:[3,6], yrs:[14,16], e:"moderate", coat:"silky", w:["Patellar luxation","Cataracts","Deafness","Legg-Calve-Perthes disease","Dental disease"]},
  "maltese":      {n:"Maltese", size:"toy", kg:[1.5,3.5], yrs:[12,15], e:"moderate", coat:"silky", w:["Portosystemic shunt","Patellar luxation","Dental disease","Tracheal collapse","Hypoglycemia"]},
  "bichon":       {n:"Bichon Frise", size:"small", kg:[5,8], yrs:[14,15], e:"moderate", coat:"curly", w:["Bladder stones","Atopic dermatitis","Patellar luxation","Cataracts","Dental disease"]},
  "shiba":        {n:"Shiba Inu", size:"small", kg:[8,11], yrs:[13,16], e:"moderate", coat:"double", w:["Patellar luxation","Atopic dermatitis","Glaucoma","Hip dysplasia","Cataracts"]},
  "acd":          {n:"Australian Cattle Dog", size:"medium", kg:[15,22], yrs:[12,16], e:"vhigh", coat:"dense", w:["Congenital deafness","Progressive retinal atrophy","Hip dysplasia","Elbow dysplasia","Portosystemic shunt"]},
  "weimaraner":   {n:"Weimaraner", size:"large", kg:[25,40], yrs:[10,13], e:"vhigh", coat:"short", w:["Gastric dilatation-volvulus (bloat)","Hip dysplasia","Von Willebrand disease","Separation anxiety","Hypothyroidism"]},
  "vizsla":       {n:"Vizsla", size:"large", kg:[20,30], yrs:[12,14], e:"vhigh", coat:"short", w:["Epilepsy","Hip dysplasia","Sebaceous adenitis","Lymphoma","Separation anxiety"]},
  "stbernard":    {n:"Saint Bernard", size:"giant", kg:[55,82], yrs:[8,10], e:"low", coat:"double", w:["Gastric dilatation-volvulus (bloat)","Hip and elbow dysplasia","Entropion","Osteosarcoma","Heat intolerance"]},
  "newfoundland": {n:"Newfoundland", size:"giant", kg:[45,68], yrs:[9,10], e:"moderate", coat:"double", w:["Subaortic stenosis","Hip and elbow dysplasia","Cystinuria","Gastric dilatation-volvulus (bloat)","Heat intolerance"]},
  "mastiff":      {n:"Mastiff", size:"giant", kg:[54,100], yrs:[6,10], e:"low", coat:"short", w:["Gastric dilatation-volvulus (bloat)","Hip dysplasia","Cystinuria","Dilated cardiomyopathy","Osteosarcoma"]},
  "pyrenees":     {n:"Great Pyrenees", size:"giant", kg:[38,64], yrs:[10,12], e:"moderate", coat:"double", w:["Hip dysplasia","Gastric dilatation-volvulus (bloat)","Patellar luxation","Osteosarcoma","Heat intolerance"]},
  "basset":       {n:"Basset Hound", size:"medium", kg:[20,29], yrs:[10,12], e:"low", coat:"short", w:["Intervertebral disc disease","Ear infections","Obesity","Glaucoma","Elbow dysplasia"]},
  "bloodhound":   {n:"Bloodhound", size:"large", kg:[36,50], yrs:[10,12], e:"moderate", coat:"short", w:["Gastric dilatation-volvulus (bloat)","Hip and elbow dysplasia","Ear infections","Entropion","Skin fold dermatitis"]},
  "jrt":          {n:"Jack Russell Terrier", size:"small", kg:[6,8], yrs:[13,16], e:"vhigh", coat:"wiry", w:["Patellar luxation","Deafness","Legg-Calve-Perthes disease","Glaucoma","Dental disease"]},
  "westie":       {n:"West Highland White Terrier", size:"small", kg:[6,10], yrs:[12,16], e:"moderate", coat:"wiry", w:["Atopic dermatitis","Craniomandibular osteopathy","Legg-Calve-Perthes disease","Dental disease","Cataracts"]},
  "ridgeback":    {n:"Rhodesian Ridgeback", size:"large", kg:[32,40], yrs:[10,12], e:"high", coat:"short", w:["Hip and elbow dysplasia","Hypothyroidism","Gastric dilatation-volvulus (bloat)","Degenerative myelopathy","Elbow dysplasia"]},
  "malinois":     {n:"Belgian Malinois", size:"large", kg:[20,36], yrs:[12,14], e:"vhigh", coat:"dense", w:["Hip dysplasia","Progressive retinal atrophy","Epilepsy","Anesthesia sensitivity","Cataracts"]},
  "akita":        {n:"Akita", size:"large", kg:[32,59], yrs:[10,13], e:"moderate", coat:"double", w:["Hip dysplasia","Hypothyroidism","Sebaceous adenitis","Gastric dilatation-volvulus (bloat)","Progressive retinal atrophy"]},
  "samoyed":      {n:"Samoyed", size:"medium", kg:[16,30], yrs:[12,14], e:"high", coat:"double", w:["Hip dysplasia","Diabetes mellitus","Progressive retinal atrophy","Subaortic stenosis","Heat intolerance"]},
  "whippet":      {n:"Whippet", size:"medium", kg:[9,19], yrs:[12,15], e:"high", coat:"short", w:["Anesthesia sensitivity","Mitral valve disease","Deafness","Dental disease","Cataracts"]},
  "greyhound":    {n:"Greyhound", size:"large", kg:[27,40], yrs:[10,14], e:"moderate", coat:"short", w:["Anesthesia sensitivity","Osteosarcoma","Dental disease","Gastric dilatation-volvulus (bloat)","Hypothyroidism"]},
  "amstaff":      {n:"American Staffordshire / Pit Bull Terrier", size:"large", kg:[16,30], yrs:[12,14], e:"high", coat:"short", w:["Hip dysplasia","Cruciate ligament rupture","Atopic dermatitis","Cerebellar ataxia","Mast cell tumors"]},
  "goldendoodle": {n:"Goldendoodle", size:"large", kg:[20,40], yrs:[10,15], e:"high", coat:"curly", w:["Hip dysplasia","Progressive retinal atrophy","Atopic dermatitis","Ear infections","Von Willebrand disease"]},
  "labradoodle":  {n:"Labradoodle", size:"large", kg:[20,38], yrs:[12,14], e:"high", coat:"curly", w:["Hip and elbow dysplasia","Progressive retinal atrophy","Addison's disease","Ear infections","Atopic dermatitis"]},
  "canecorso":    {n:"Cane Corso", size:"giant", kg:[40,50], yrs:[9,12], e:"high", coat:"short", w:["Hip dysplasia","Entropion","Gastric dilatation-volvulus (bloat)","Epilepsy","Osteosarcoma"]}
};

const CATS = {
  "dsh":          {n:"Domestic Shorthair", size:"cat", kg:[3.5,5.5], yrs:[13,17], e:"moderate", coat:"shortcat", w:["Obesity","Dental disease","Chronic kidney disease","Hyperthyroidism","Feline lower urinary tract disease"]},
  "dlh":          {n:"Domestic Longhair", size:"cat", kg:[3.5,6], yrs:[13,17], e:"moderate", coat:"longcat", w:["Hairball and coat matting","Obesity","Chronic kidney disease","Dental disease","Hyperthyroidism"]},
  "mainecoon":    {n:"Maine Coon", size:"cat", kg:[5.5,11], yrs:[12,15], e:"moderate", coat:"longcat", w:["Hypertrophic cardiomyopathy","Hip dysplasia","Spinal muscular atrophy","Polycystic kidney disease","Obesity"]},
  "persian":      {n:"Persian", size:"cat", kg:[3,5.5], yrs:[12,17], e:"low", coat:"longcat", w:["Polycystic kidney disease","Brachycephalic airway syndrome","Dental disease","Hairball and coat matting","Hypertrophic cardiomyopathy"]},
  "siamese":      {n:"Siamese", size:"cat", kg:[3.5,5.5], yrs:[15,20], e:"high", coat:"shortcat", w:["Asthma","Amyloidosis","Progressive retinal atrophy","Dental disease","Gingivitis"]},
  "ragdoll":      {n:"Ragdoll", size:"cat", kg:[4.5,9], yrs:[12,17], e:"low", coat:"longcat", w:["Hypertrophic cardiomyopathy","Polycystic kidney disease","Bladder stones","Obesity","Hairball and coat matting"]},
  "bengal":       {n:"Bengal", size:"cat", kg:[4,7], yrs:[12,16], e:"vhigh", coat:"shortcat", w:["Hypertrophic cardiomyopathy","Progressive retinal atrophy","Pyruvate kinase deficiency","Patellar luxation","Feline lower urinary tract disease"]},
  "britishsh":    {n:"British Shorthair", size:"cat", kg:[4,8], yrs:[14,20], e:"low", coat:"shortcat", w:["Hypertrophic cardiomyopathy","Polycystic kidney disease","Obesity","Dental disease","Chronic kidney disease"]},
  "sphynx":       {n:"Sphynx", size:"cat", kg:[3.5,5.5], yrs:[9,15], e:"high", coat:"hairless", w:["Hypertrophic cardiomyopathy","Dental disease","Gingivitis","Heat intolerance","Ear infections"]},
  "abyssinian":   {n:"Abyssinian", size:"cat", kg:[3,5], yrs:[12,15], e:"high", coat:"shortcat", w:["Pyruvate kinase deficiency","Progressive retinal atrophy","Amyloidosis","Patellar luxation","Gingivitis"]},
  "scottishfold": {n:"Scottish Fold", size:"cat", kg:[3,6], yrs:[11,15], e:"moderate", coat:"shortcat", w:["Osteochondrodysplasia","Hypertrophic cardiomyopathy","Polycystic kidney disease","Ear infections","Dental disease"]},
  "norwegian":    {n:"Norwegian Forest Cat", size:"cat", kg:[4,9], yrs:[14,16], e:"moderate", coat:"longcat", w:["Hypertrophic cardiomyopathy","Hip dysplasia","Polycystic kidney disease","Obesity","Hairball and coat matting"]},
  "russianblue":  {n:"Russian Blue", size:"cat", kg:[3.5,5.5], yrs:[15,20], e:"moderate", coat:"shortcat", w:["Obesity","Bladder stones","Dental disease","Diabetes mellitus","Chronic kidney disease"]},
  "burmese":      {n:"Burmese", size:"cat", kg:[3.5,5.5], yrs:[16,18], e:"high", coat:"shortcat", w:["Diabetes mellitus","Gingivitis","Hypertrophic cardiomyopathy","Dental disease","Obesity"]},
  "devonrex":     {n:"Devon Rex", size:"cat", kg:[2.5,4.5], yrs:[9,15], e:"high", coat:"shortcat", w:["Hypertrophic cardiomyopathy","Patellar luxation","Hip dysplasia","Dental disease","Heat intolerance"]},
  "orientalsh":   {n:"Oriental Shorthair", size:"cat", kg:[3.5,5.5], yrs:[12,15], e:"high", coat:"shortcat", w:["Amyloidosis","Asthma","Progressive retinal atrophy","Dental disease","Gingivitis"]},
  "siberian":     {n:"Siberian", size:"cat", kg:[4.5,9], yrs:[12,15], e:"moderate", coat:"longcat", w:["Hypertrophic cardiomyopathy","Polycystic kidney disease","Obesity","Gingivitis","Hairball and coat matting"]},
  "exoticsh":     {n:"Exotic Shorthair", size:"cat", kg:[3,6], yrs:[12,15], e:"low", coat:"shortcat", w:["Brachycephalic airway syndrome","Polycystic kidney disease","Dental disease","Hypertrophic cardiomyopathy","Obesity"]},
  "americansh":   {n:"American Shorthair", size:"cat", kg:[3.5,7], yrs:[15,20], e:"moderate", coat:"shortcat", w:["Hypertrophic cardiomyopathy","Obesity","Dental disease","Hip dysplasia","Diabetes mellitus"]},
  "manx":         {n:"Manx", size:"cat", kg:[3.5,5.5], yrs:[12,16], e:"moderate", coat:"shortcat", w:["Megacolon","Feline lower urinary tract disease","Hip and joint arthritis","Dental disease","Obesity"]},
  "turkishangora":{n:"Turkish Angora", size:"cat", kg:[2.5,5], yrs:[12,18], e:"high", coat:"longcat", w:["Congenital deafness","Hypertrophic cardiomyopathy","Polycystic kidney disease","Dental disease","Hairball and coat matting"]},
  "savannah":     {n:"Savannah", size:"cat", kg:[5.5,11], yrs:[12,20], e:"vhigh", coat:"shortcat", w:["Hypertrophic cardiomyopathy","Pyruvate kinase deficiency","Anesthesia sensitivity","Hepatic lipidosis","Obesity"]}
};

const BCS_DESC = {
  1:"Ribs, spine and hip bones visible from a distance. No fat, obvious muscle loss.",
  2:"Ribs easily visible, bony landmarks prominent, minimal muscle over them.",
  3:"Ribs visible without fat cover, waist and abdominal tuck obvious, tops of spine visible.",
  4:"Ribs easily felt with a thin fat cover. Waist clear from above, abdomen tucked from the side.",
  5:"Ribs felt without pressing. Waist visible behind the ribs, abdomen tucked. This is the target.",
  6:"Ribs felt under a slight excess of fat. Waist visible from above but not sharply.",
  7:"Ribs hard to feel under heavy fat. No waist from above, only a slight abdominal tuck.",
  8:"Ribs cannot be felt. Obvious fat over the spine and tail base, no waist, abdomen distended.",
  9:"Heavy fat over the ribs, spine and tail base. Fat on the neck and limbs, obvious distension."
};

const DOG_ACT = [
  ["low","Mostly indoors, short walks"],
  ["normal","Regular daily walks"],
  ["active","Long walks, running, hikes"],
  ["working","Working, sport or daily hard exercise"]
];
const CAT_ACT = [
  ["low","Indoor, low-key, sleeps a lot"],
  ["normal","Indoor with daily play"],
  ["active","Very playful or indoor-outdoor"],
  ["working","Outdoor most of the day"]
];
const ACT_ADJ = {low:0.9, normal:1.0, active:1.15, working:1.35};

const GROWTH_END = {toy:0.75, small:0.83, medium:1.0, large:1.33, giant:1.75, cat:1.0};
const SENIOR_AT  = {toy:11, small:10, medium:9, large:7.5, giant:6, cat:11};

/* The second tranche lives in its own file so both sets stay reviewable.
   A key defined there wins, which is how a curated entry gets corrected
   without editing this file. */
const EXTRA = (typeof module !== "undefined" && module.exports)
  ? require("./breeds-extra") : self.PetLifeBreedsExtra;
Object.assign(COND, EXTRA.COND);
Object.assign(DOGS, EXTRA.DOGS);
Object.assign(CATS, EXTRA.CATS);

const PetLifeBreeds = { COND, ENERGY, COAT, DOGS, CATS, BCS_DESC, DOG_ACT, CAT_ACT, ACT_ADJ, GROWTH_END, SENIOR_AT };
if (typeof module !== "undefined" && module.exports) module.exports = PetLifeBreeds;
else self.PetLifeBreeds = PetLifeBreeds;
})();
(function(){
/* =========================================================================
   The care engine.

   buildChart(input, { tier }) -> a fully structured chart description.

   This runs on the SERVER. A section is computed only when the caller's
   tier reaches the tier that section requires; otherwise it ships as a
   locked stub with a teaser and no content. That is what makes the paywall
   real — a reader who edits the DOM finds nothing to reveal.
   ========================================================================= */

/* Dual-mode: `require` on the server, a preceding <script> in the demo build. */
const {
  COND, ENERGY, COAT, DOGS, CATS, BCS_DESC,
  DOG_ACT, CAT_ACT, ACT_ADJ, GROWTH_END, SENIOR_AT
} = (typeof module !== "undefined" && module.exports) ? require("./breeds") : self.PetLifeBreeds;
const { has, tierFor, REQUIRES } = (typeof module !== "undefined" && module.exports) ? require("./tiers") : self.PetLifeTiers;

/* ---------- small helpers ---------- */
const round = (n, d = 0) => { const f = Math.pow(10, d); return Math.round(n * f) / f; };
const kgToLb = kg => kg * 2.20462;
const lbToKg = lb => lb / 2.20462;
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/* ---------- input normalisation ----------
   Everything from the network is untrusted: coerce, clamp, and fall back. */
function normalize(raw = {}) {
  const species = raw.species === "cat" ? "cat" : "dog";
  const db = species === "dog" ? DOGS : CATS;
  const breedKey = Object.prototype.hasOwnProperty.call(db, raw.breed)
    ? raw.breed
    : (species === "dog" ? "labrador" : "dsh");
  const unit = raw.unit === "kg" ? "kg" : "lb";
  const actList = species === "dog" ? DOG_ACT : CAT_ACT;

  return {
    species, breedKey, unit,
    name: String(raw.name == null ? "" : raw.name).slice(0, 40),
    ageY: clamp(Math.floor(Number(raw.ageY) || 0), 0, 30),
    ageM: clamp(Math.floor(Number(raw.ageM) || 0), 0, 11),
    weight: clamp(Number(raw.weight) || 1, 0.2, 200),
    sex: raw.sex === "f" ? "f" : "m",
    fixed: String(raw.fixed) === "0" ? 0 : 1,
    bcs: clamp(Math.round(Number(raw.bcs) || 5), 1, 9),
    activity: actList.some(a => a[0] === raw.activity) ? raw.activity : "normal",
    kcalCup: clamp(Number(raw.kcalCup) || 360, 100, 900)
  };
}

/* ---------- derived quantities ---------- */
function derive(I) {
  const db = I.species === "dog" ? DOGS : CATS;
  const b = db[I.breedKey];
  const dog = I.species === "dog";
  const age = I.ageY + I.ageM / 12;
  const kg = I.unit === "lb" ? lbToKg(I.weight) : I.weight;
  const g = GROWTH_END[b.size];
  const sr = SENIOR_AT[b.size];

  /* life stage */
  const young = dog ? "Puppy" : "Kitten";
  let stage;
  if (age < g * 0.35)      stage = { key: "infant",    label: young,          note: "Rapid growth" };
  else if (age < g)        stage = { key: "growth",    label: young,          note: "Finishing growth" };
  else if (age < g + 0.5)  stage = { key: "young",     label: "Young adult",  note: "Just finished growing" };
  else if (age < sr * 0.72)stage = { key: "adult",     label: "Adult",        note: "Prime years" };
  else if (age < sr)       stage = { key: "mature",    label: "Mature adult", note: "Screening years begin" };
  else if (age < sr + 3)   stage = { key: "senior",    label: "Senior",       note: "Twice-yearly exams" };
  else                     stage = { key: "geriatric", label: "Geriatric",    note: "Comfort and monitoring" };
  const growing = stage.key === "infant" || stage.key === "growth";
  const old = stage.key === "senior" || stage.key === "geriatric";

  /* ideal weight — each BCS point off 5 is ~10% of ideal body weight */
  let idealKg, projected = false;
  if (growing) { idealKg = (b.kg[0] + b.kg[1]) / 2; projected = true; }
  else {
    idealKg = clamp(kg / Math.max(0.55, 1 + 0.10 * (I.bcs - 5)), b.kg[0] * 0.85, b.kg[1] * 1.15);
  }

  /* energy: RER = 70 * kg^0.75, then a life-stage multiplier */
  const rerOf = w => 70 * Math.pow(Math.max(w, 0.2), 0.75);
  let base, why, basedOn = idealKg;
  if (stage.key === "infant")      { base = dog ? 3.0 : 2.5; why = dog ? "puppy under ~4 months" : "kitten, rapid growth"; basedOn = kg; }
  else if (stage.key === "growth") { base = dog ? 2.0 : 2.5; why = dog ? "puppy still growing" : "kitten still growing";  basedOn = kg; }
  else if (I.bcs >= 7)             { base = dog ? 1.0 : 0.8; why = "supervised weight loss, fed to ideal weight"; }
  else if (I.bcs <= 3)             { base = dog ? 1.7 : 1.4; why = "weight gain, fed to ideal weight"; }
  else {
    base = I.fixed === 1 ? (dog ? 1.6 : 1.2) : (dog ? 1.8 : 1.4);
    why = (I.fixed === 1 ? (I.sex === "f" ? "spayed " : "neutered ") : "intact ") + (dog ? "adult" : "adult cat");
    if (old) { base *= 0.95; why += ", senior adjustment"; }
  }
  let mult = base;
  if (!growing && I.bcs < 7) mult = base * (ACT_ADJ[I.activity] || 1);
  const rer = rerOf(basedOn);

  return {
    b, dog, age, kg, g, sr, stage, growing, old,
    idealKg, projected,
    rer: Math.round(rer),
    mult: round(mult, 2),
    kcal: Math.round(rer * mult),
    energyWhy: why,
    basedOnKg: basedOn,
    waterMl: Math.round((dog ? 55 : 50) * kg)
  };
}

/* ---------- display helpers bound to the chosen unit ---------- */
function makeFmt(unit) {
  return {
    w: (kg, d = 1) => unit === "lb" ? `${round(kgToLb(kg), d)} lb` : `${round(kg, d)} kg`,
    n: (kg, d = 1) => unit === "lb" ? round(kgToLb(kg), d) : round(kg, d),
    unit
  };
}

/* ---------- verdict ---------- */
function verdictOf(I, D, F) {
  if (D.growing) {
    return {
      status: "good", title: "Still growing",
      body: "Body condition scoring is unreliable in a growing animal. Weigh weekly and plot the trend with your vet rather than aiming at an adult target.",
      meta: ""
    };
  }
  const diff = (D.kg - D.idealKg) / D.idealKg * 100;
  const off = Math.abs(diff);
  const gap = F.w(Math.abs(D.kg - D.idealKg));
  if (I.bcs >= 8) return { status: "bad", title: "Obese range",
    body: "At this score the excess weight is already shortening life expectancy and loading the joints. Book a vet visit to rule out thyroid and adrenal causes before starting a restriction plan.",
    meta: `About ${round(off)}% above ideal — roughly ${gap} to lose.` };
  if (I.bcs === 7) return { status: "warn", title: "Overweight",
    body: "This is the most common and most reversible finding in pet medicine. A measured 10–15% calorie cut with weekly weigh-ins usually resolves it in three to six months.",
    meta: `About ${round(off)}% above ideal — roughly ${gap} to lose.` };
  if (I.bcs === 6) return { status: "warn", title: "Slightly overweight",
    body: "Close to ideal, but the trend matters more than the number. Tighten portions now while it is a small correction rather than a program.",
    meta: `About ${round(off)}% above ideal — roughly ${gap} to lose.` };
  if (I.bcs <= 2) return { status: "bad", title: "Underweight",
    body: "Significant weight loss deserves a workup before more food: dental pain, parasites, kidney disease, and hyperthyroidism all present this way.",
    meta: `About ${round(off)}% below ideal.` };
  if (I.bcs === 3) return { status: "warn", title: "Thin",
    body: "Slightly under. If the diet has not changed, ask your vet to check teeth, stool, and bloodwork before simply increasing portions.",
    meta: `About ${round(off)}% below ideal.` };
  return { status: "good", title: "Ideal body condition",
    body: "Ribs easy to feel, waist visible from above, abdomen tucked from the side. Re-score monthly — drift is easier to catch by hand than on a scale.",
    meta: `Hold within about ${F.w(D.idealKg * 0.05)} of this weight.` };
}

/* =========================================================================
   Free sections
   ========================================================================= */
function nutritionSection(I, D, F) {
  const cups = D.kcal / I.kcalCup;
  const meals = D.stage.key === "infant" ? 4 : D.stage.key === "growth" ? 3 : (D.dog ? 2 : 3);
  const rows = [
    { k: "Daily calories", v: `**${D.kcal} kcal** of complete, life-stage-appropriate food`,
      hint: `Calculated from an ideal weight of ${F.w(D.basedOnKg)}, not the current weight.` },
    { k: "Portion", v: `**${round(cups, 2)} cups** per day at ${I.kcalCup} kcal/cup`,
      hint: "Use a kitchen scale rather than a scoop — cup measures run 20–30% off." },
    { k: "Meals", v: `**${meals}** per day, about ${round(cups / meals, 2)} cups each`,
      hint: D.dog && ["large", "giant"].includes(D.b.size)
        ? "Split meals and rest for an hour after eating — deep-chested dogs are at bloat risk."
        : D.dog ? "Consistent meal times steady digestion and house-training."
                : "Cats do better on several small meals; puzzle feeders slow fast eaters." },
    { k: "Treat budget", v: `**${Math.round(D.kcal * 0.10)} kcal** — 10% of the day, subtracted from meals`,
      hint: "Training treats count. So does cheese, so does the crust of toast." },
    { k: "Water", v: "Fresh water always available; wash the bowl daily",
      hint: D.dog ? "" : "Cats drink poorly. Wet food, a wide bowl away from the food, or a fountain all help." },
    { k: "Switching food", v: "Transition over 7 days: 25% new, then 50%, then 75%, then all",
      hint: "A sudden switch is the most common cause of a week of loose stool." }
  ];
  if (D.growing) {
    const big = ["large", "giant"].includes(D.b.size);
    rows.push({ k: "Growth formula", v: `Food labeled for growth${big ? " and large-breed growth" : ""}`,
      hint: big ? "Controlled calcium matters here: overfeeding a large-breed puppy causes permanent joint damage."
                : "Adult maintenance food does not carry enough calcium or protein for growth." });
  }
  if (D.old) {
    rows.push({ k: "Senior adjustment", v: "Keep protein up; drop calories, not muscle",
      hint: "Older animals lose lean mass. Ask your vet before switching to a low-protein diet — it is rarely the right call without kidney values." });
  }
  return { id: "nutrition", code: "Nutrition", title: "Feeding plan",
    derive: `RER ${D.rer} kcal × ${D.mult} = ${D.kcal} kcal/day`, kind: "rows", rows };
}

function urgentSection(I, D) {
  const wl = D.b.w.join(" ");
  const items = [
    "Trouble breathing, open-mouth breathing in a cat, or gums that are blue, white or brick red",
    `Repeated unproductive retching, a swollen or drum-tight belly, restlessness and pacing${D.dog ? " — this is bloat until proven otherwise" : ""}`,
    "Collapse, sudden weakness, or a seizure lasting over two minutes or repeating",
    "Straining in the litter box or unable to pass urine — in male cats this is fatal within a day",
    "Bleeding that will not stop, or a suspected broken bone",
    "Suspected poisoning: chocolate, xylitol, grapes, lilies for cats, antifreeze, human medication",
    "Sudden inability to use the hind legs, or crying out when touched along the back",
    D.dog ? "Refusing food for 24 hours, or refusing water at all"
          : "Refusing food for 48 hours — in cats this alone can trigger liver failure",
    "A painful, red, cloudy or suddenly blind eye",
    "Heatstroke signs: heavy panting, staggering, vomiting, or a temperature over 104°F / 40°C"
  ];
  if (wl.includes("Brachycephalic")) items.push("For this breed specifically: noisy breathing that worsens, or gums going dusky after mild exercise");
  if (wl.includes("Intervertebral disc")) items.push("For this breed specifically: any wobble, knuckling or dragging of the back feet — the window for surgery is measured in hours");
  return { id: "urgent", code: "Urgent signs", title: "Go to a vet now if you see this",
    tone: "urgent", free: true, kind: "list",
    intro: "These are emergencies for any pet. Call your veterinarian or the nearest emergency clinic — do not wait for morning.",
    items };
}

/* =========================================================================
   Pro sections
   ========================================================================= */
function activitySection(I, D, F) {
  const en = ENERGY[D.b.e];
  let target = en.mins.slice();
  if (D.growing) target = [Math.round(en.mins[0] * 0.4), Math.round(en.mins[1] * 0.5)];
  if (D.old) target = [Math.round(en.mins[0] * 0.7), Math.round(en.mins[1] * 0.75)];

  const rows = [];
  if (D.dog) {
    rows.push({ k: "Daily movement", v: `**${target[0]}–${target[1]} minutes** across two or more outings`,
      hint: D.growing ? "Five minutes of structured exercise per month of age, twice a day, is the classic rule while growth plates close."
                      : "Sniffing walks tire a dog more than distance. Let them stop." });
    rows.push({ k: "Structure", v: en.label === "Very high" ? "One hard session plus one long walk, most days"
        : en.label === "High" ? "A brisk walk plus a play or training session" : "Two unhurried walks with sniffing time",
      hint: "Under-exercised dogs of this breed show it as chewing, barking, and pacing, not as laziness." });
    rows.push({ k: "Mental work", v: "10–15 minutes of training, scentwork, or a puzzle feeder daily",
      hint: "Ten minutes of nose work is worth about half an hour of walking for settling a dog." });
  } else {
    rows.push({ k: "Play sessions", v: `**2–3 sessions** of ${Math.max(8, Math.round(target[0] / 3))}–${Math.max(12, Math.round(target[1] / 3))} minutes`,
      hint: "End each session with a catch and a meal — hunt, catch, eat, groom, sleep is the sequence cats are built around." });
    rows.push({ k: "Wand and chase toys", v: "Rotate three or four toys; put the rest away",
      hint: "Novelty is what keeps a cat playing, not quantity." });
    rows.push({ k: "Vertical space", v: "Cat tree, shelves, or a window perch above head height",
      hint: "Vertical territory reduces conflict in multi-cat homes more reliably than extra floor space." });
    rows.push({ k: "Litter boxes", v: "One per cat plus one, in separate quiet locations",
      hint: "Uncovered, large, unscented, scooped daily. Most litter box problems are box problems." });
  }

  const wl = D.b.w.join(" ");
  const cautions = [];
  if (wl.includes("Brachycephalic")) cautions.push("Short-nosed build: exercise in the cool of the day, use a harness, and stop at the first loud or raspy breathing. Heatstroke can happen on a mild day.");
  if (wl.includes("Intervertebral disc")) cautions.push("Long-backed build: block couch and stair jumping, use ramps, and keep them lean. Sudden back pain or dragging hind legs is an emergency.");
  if (wl.includes("bloat")) cautions.push("Deep chest: no hard exercise for an hour either side of a meal.");
  if (D.growing && ["large", "giant"].includes(D.b.size)) cautions.push(`Large-breed puppy: no forced running, repetitive fetch, or agility jumps until the growth plates close around ${Math.round(D.g * 12)} months.`);
  if (wl.includes("Heat intolerance")) cautions.push("This coat or build holds heat. Watch for heavy panting, and give shade and water on every outing.");
  if (D.b.size === "giant" && D.old) cautions.push("Giant breeds age early. Swap long walks for several short ones and add traction rugs on slick floors.");
  if (cautions.length) rows.push({ k: "Cautions", v: cautions.map(c => "• " + c).join("\n") });

  return { id: "activity", code: "Activity", title: "Exercise & enrichment", pro: true,
    derive: `Breed energy: ${en.label}${D.growing ? " · growth-adjusted" : D.old ? " · senior-adjusted" : ""}`,
    kind: "rows", rows };
}

function preventiveSection(I, D) {
  const a = D.age, dog = D.dog, st = D.stage;
  const core = dog ? "DHPP (distemper, hepatitis, parvo, parainfluenza)"
                   : "FVRCP (rhinotracheitis, calici, panleukopenia)";
  const big = ["large", "giant"].includes(D.b.size);
  const rows = [
    ["6–8 weeks", `${core} — first dose`, "vaccine", a < 0.2],
    ["10–12 weeks", `${core} — second dose${dog ? "; leptospirosis if outdoors" : "; FeLV first dose"}`, "vaccine", a >= 0.15 && a < 0.28],
    ["14–16 weeks", `${core} — final dose; rabies`, "vaccine", a >= 0.28 && a < 0.45],
    ["4–6 months", `Spay or neuter discussion${big ? " — large breeds often benefit from waiting past 12 months" : ""}`, "surgery", a >= 0.33 && a < 0.6],
    ["1 year", "Core booster and rabies booster; first adult exam", "vaccine", a >= 0.85 && a < 1.25],
    ["Every year", `Wellness exam, weight and body condition, dental check, heartworm/tick test${dog ? "" : ", FeLV/FIV if outdoors"}`, "exam", st.key === "adult" || st.key === "young"],
    ["Every 3 years", "Core vaccine booster (titer testing is an option — ask)", "vaccine", st.key === "adult" || st.key === "mature"],
    ["Monthly, year-round", dog ? "Heartworm preventive plus flea and tick control" : "Flea control; heartworm preventive in endemic areas", "parasite", true],
    ["1–2 times a year", "Fecal test for intestinal parasites", "parasite", true],
    ["From age 2–3", "Professional dental cleaning under anesthesia, then as advised", "dental", a >= 2],
    [`From age ${D.sr}`, "Exams every 6 months; annual bloodwork, urinalysis and blood pressure", "senior care", ["mature", "senior", "geriatric"].includes(st.key)]
  ];
  if (!dog) rows.push(["From age 7", "Annual thyroid (T4) and kidney (SDMA) screening", "senior care", a >= 7]);
  if (dog && big) rows.push([`From age ${D.sr}`, "Joint assessment and mobility scoring at every visit", "senior care", a >= D.sr]);

  return { id: "preventive", code: "Preventive care", title: "Vaccines, parasites & checkups", pro: true,
    derive: `Core schedule · ${D.stage.label} · confirm local law for rabies`,
    kind: "table", head: ["When", "What", "Type"],
    rows: rows.map(([when, what, type, now]) => ({ when, what, type, now: !!now })) };
}

function watchSection(I, D) {
  const items = D.b.w.map(name => {
    const note = COND[name] || "Ask your vet whether screening for this is recommended at your pet's next visit.";
    const screenable = /DNA|test|screen|echo|OFA|bloodwork|radiograph|titer|BAER|ultrasound/i.test(note);
    return { name, tag: screenable ? "Screenable" : "Monitor", screenable, note };
  });
  items.push({ name: "How to use this list", tag: "", screenable: false,
    note: "These are breed tendencies drawn from population data, not findings in your animal. Most dogs and cats of any breed never develop most of these. Bring the list to your next appointment and ask which two are worth screening for at this age." });
  return { id: "watchlist", code: "Breed watchlist", pro: true,
    title: `What ${D.b.n.replace(/ —.*/, "")}s are prone to`,
    derive: "Predisposition, not diagnosis", kind: "watch", items };
}

function groomSection(I, D) {
  const c = COAT[D.b.coat], wl = D.b.w.join(" ");
  const rows = [
    { k: "Brushing", v: c.brush, hint: c.shed },
    { k: "Bathing", v: c.bath, hint: "Over-bathing strips oils and drives itching. Use a pet shampoo, never human shampoo." },
    { k: "Nails", v: "Trim every 3–4 weeks", hint: "If you hear clicking on hard floors they are already too long, and the quick has grown out with them." },
    { k: "Ears", v: /Ear infections/.test(wl) ? "Check and dry weekly — this breed is prone to infections" : "Check every 2 weeks; clean only when dirty",
      hint: "Odor, redness, head shaking or dark discharge means a vet visit, not more cleaning." },
    { k: "Teeth", v: "Brush daily with pet toothpaste — the single highest-value grooming habit",
      hint: "Never use human toothpaste; xylitol and fluoride are toxic to pets." },
    { k: "Eyes", v: /Dry eye|Corneal|Brachycephalic/.test(wl) ? "Wipe daily; this face shape needs eye monitoring" : "Wipe away discharge as needed",
      hint: "Squinting, pawing at an eye, or a cloudy surface is same-day, not next-week." }
  ];
  if (D.b.coat === "hairless") rows.push({ k: "Skin", v: "Wipe down 2–3 times a week and keep them warm",
    hint: "No coat means oil buildup, sunburn risk, and real difficulty holding body temperature." });
  if (!D.dog) rows.push({ k: "Scratching", v: "One tall sisal post per cat, near where they sleep",
    hint: "Cats scratch to stretch and mark. Give a better option rather than trying to stop the behaviour." });
  return { id: "grooming", code: "Coat & dental", title: "Grooming routine", pro: true,
    derive: `Coat: ${D.b.coat.replace("longcat", "long").replace("shortcat", "short")} · ${c.shed}`,
    kind: "rows", rows };
}

function programSection(I, D, F) {
  if (D.growing) {
    return { id: "program", code: "Program", title: "Growth program", pro: true,
      derive: "Weekly weigh-ins until adult weight", kind: "rows", rows: [
        { k: "Weigh-in", v: "Weekly, same scale, same time of day", hint: "Plot the curve. The shape matters more than any single number." },
        { k: "Target", v: `Reach about **${F.w(D.idealKg)}** as an adult`, hint: "Breed midpoint — your vet will adjust for frame size." },
        { k: "Growth rate", v: "Steady and unhurried beats fast", hint: "Pushing growth in a large-breed puppy causes permanent joint disease. Lean puppies live longer." },
        { k: "Socialization window", v: "Peak learning closes around 12–16 weeks", hint: "Safe, positive exposure to people, surfaces, sounds and handling now prevents most adult fear problems." },
        { k: "Recheck", v: "Every 3–4 weeks until the vaccine series is complete" }
      ] };
  }
  const over = D.kg - D.idealKg;
  if (Math.abs(over) < D.idealKg * 0.03 && I.bcs >= 4 && I.bcs <= 5) {
    return { id: "program", code: "Program", title: "Maintenance program", pro: true,
      derive: "Body condition 4–5 · hold the line", kind: "rows", rows: [
        { k: "Weigh-in", v: "Monthly", hint: "A 5% drift is invisible by eye and easy to correct. A 15% drift is a six-month project." },
        { k: "Body condition", v: "Hands-on score once a month", hint: "Feel the ribs, look for a waist from above and a tuck from the side." },
        { k: "Portion", v: `Hold at **${D.kcal} kcal/day** and re-check after any food change` },
        { k: "Trigger to act", v: `Any change over ${F.w(D.idealKg * 0.05)} in either direction`, hint: "Unexplained loss deserves a vet visit before a diet change." }
      ] };
  }
  const losing = over > 0;
  const rate = losing ? (D.dog ? 0.01 : 0.005) : 0.01;
  const weeks = Math.max(4, Math.round(Math.abs(over) / (D.idealKg * rate)));
  return { id: "program", code: "Program", pro: true,
    title: losing ? "Weight loss program" : "Weight gain program",
    derive: losing ? `Safe rate: ${D.dog ? "1–2%" : "0.5–1%"} of body weight per week` : "Supervised gain — rule out disease first",
    kind: "rows", rows: [
      { k: "Goal", v: `**${F.w(D.idealKg)}** from ${F.w(D.kg)} — about ${F.w(Math.abs(over))} to ${losing ? "lose" : "gain"}`,
        hint: `Roughly ${weeks} weeks at a safe rate. Faster is not better; in cats, rapid loss causes liver failure.` },
      { k: "Daily calories", v: `**${D.kcal} kcal** — ${D.energyWhy}`, hint: "Weigh food on a gram scale. This is the step that makes or breaks the program." },
      { k: "Weigh-in", v: losing ? "Every 2 weeks, same scale" : "Weekly", hint: "No change after 4 weeks means the portion is wrong or someone else is feeding them." },
      { k: "Treats", v: "Cut to 5% of calories; use green beans, or a portion of their own kibble", hint: "Treats are where nearly every failed weight plan actually fails." },
      { k: "Rule out first", v: losing ? "Hypothyroidism (dogs) and Cushing's disease can cause weight gain"
          : "Dental pain, parasites, kidney disease, diabetes and hyperthyroidism all cause weight loss",
        hint: "Ask for bloodwork before assuming the cause is diet." },
      { k: "Vet supervision", v: "Restriction below this level needs a prescription therapeutic diet",
        hint: "Cutting an ordinary food further leaves them short on protein and micronutrients." }
    ] };
}

/* ---------- teasers shown in place of locked content ---------- */
const TEASERS = {
  activity:   ["Daily minutes tuned to breed energy and life stage", "Structure, mental work and enrichment", "Breed-specific exercise cautions"],
  preventive: ["Full vaccine series and booster schedule", "Parasite, dental and senior screening cadence", "What is due for this pet right now"],
  watchlist:  ["Five conditions this breed is predisposed to", "Which are screenable and which to monitor", "What to ask your vet at the next visit"],
  grooming:   ["Brushing and bathing cadence for this coat", "Nails, ears, eyes and dental routine", "Where this breed needs extra attention"],
  program:    ["A target weight and a safe timeline", "Calorie plan and weigh-in cadence", "What to rule out before changing the diet"]
};

function lockSection(s, needTier) {
  const t = tierFor(needTier);
  return { id: s.id, code: s.code, title: s.title, pro: true, locked: true,
    needs: needTier, needsName: t.name, needsPrice: t.priceLabel,
    derive: `${t.name} — ${t.priceLabel}`, teaser: TEASERS[s.id] || [] };
}

/* =========================================================================
   Chart-shaped data for the three visualisations
   ========================================================================= */
function gaugeOf(I, D, F, V) {
  const lo = D.b.kg[0] * 0.7, hi = D.b.kg[1] * 1.35;
  return {
    unit: F.unit,
    min: F.n(lo, 0), max: F.n(hi, 0),
    bandLo: F.n(D.b.kg[0], 0), bandHi: F.n(D.b.kg[1], 0),
    current: F.n(clamp(D.kg, lo, hi), 1),
    currentLabel: F.w(D.kg),
    ideal: F.n(clamp(D.idealKg, lo, hi), 1),
    idealLabel: F.w(D.idealKg),
    status: V.status,
    projected: D.projected
  };
}

function timelineOf(I, D) {
  const end = Math.max(D.b.yrs[1], D.sr + 3, D.age + 0.5);
  const raw = [
    { key: "growth",    label: D.dog ? "Puppy" : "Kitten", from: 0,           to: D.g },
    { key: "adult",     label: "Adult",                    from: D.g,         to: D.sr * 0.72 },
    { key: "mature",    label: "Mature",                   from: D.sr * 0.72, to: D.sr },
    { key: "senior",    label: "Senior",                   from: D.sr,        to: D.sr + 3 },
    { key: "geriatric", label: "Geriatric",                from: D.sr + 3,    to: end }
  ].filter(s => s.to > s.from);
  return {
    end: round(end, 1),
    age: round(D.age, 2),
    lifespanLo: D.b.yrs[0], lifespanHi: D.b.yrs[1],
    currentKey: D.stage.key === "infant" ? "growth" : D.stage.key === "young" ? "adult" : D.stage.key,
    stages: raw.map(s => ({ ...s, from: round(s.from, 2), to: round(s.to, 2) }))
  };
}

/* =========================================================================
   Entry point
   ========================================================================= */
function buildChart(rawInput, opts = {}) {
  const tier = opts.tier || "free";
  const I = normalize(rawInput);
  const D = derive(I);
  const F = makeFmt(I.unit);
  const V = verdictOf(I, D, F);

  const waterDisp = I.unit === "lb"
    ? { v: String(round(D.waterMl / 29.574, 0)), unit: "fl oz" }
    : { v: String(round(D.waterMl / 1000, 2)), unit: "L" };

  const vitals = [
    { k: "Life stage", v: D.stage.label,
      note: `${D.stage.note} · typical lifespan ${D.b.yrs[0]}–${D.b.yrs[1]} yrs` },
    { k: "Healthy weight", v: `${F.n(D.b.kg[0], 0)}–${F.n(D.b.kg[1], 0)}`, unit: F.unit,
      note: D.projected ? "Projected adult range for the breed" : `Your target: ${F.w(D.idealKg)}` },
    { k: "Daily energy", v: String(D.kcal), unit: "kcal", note: D.energyWhy },
    { k: "Water per day", v: waterDisp.v, unit: waterDisp.unit,
      note: `Roughly ${D.waterMl} ml — more in heat or on dry food` }
  ];

  const free = [nutritionSection(I, D, F), urgentSection(I, D)];
  const gated = [
    activitySection(I, D, F),
    preventiveSection(I, D),
    watchSection(I, D),
    groomSection(I, D),
    programSection(I, D, F)
  ];

  return {
    tier,
    header: {
      name: I.name.trim() || "Your pet",
      subtitle: [
        D.b.n,
        `${I.sex === "m" ? "male" : "female"}${I.fixed === 1 ? (I.sex === "m" ? ", neutered" : ", spayed") : ", intact"}`,
        D.age < 1 ? `${Math.round(D.age * 12)} months` : `${round(D.age, 1)} year${round(D.age, 1) === 1 ? "" : "s"}`,
        F.w(D.kg)
      ].join(" · ")
    },
    vitals,
    verdict: V,
    gauge: gaugeOf(I, D, F, V),
    timeline: timelineOf(I, D),
    bcs: { value: I.bcs, description: BCS_DESC[I.bcs] },
    sections: [
      ...free,
      ...gated.map(s => has(tier, s.id) ? s : lockSection(s, REQUIRES[s.id]))
    ]
  };
}

/* The breed/activity option lists the form needs.
   With well over a hundred breeds the order matters: the mixed-breed
   entries stay pinned at the top, smallest first, because someone who does
   not know the breed needs them immediately. Everything else is A–Z. */
const MIX_ORDER = ["mix-toy", "mix-small", "mix-medium", "mix-large", "mix-giant"];

function catalog() {
  const opts = db => {
    const rows = Object.entries(db).map(([value, v]) => ({ value, label: v.n, size: v.size, e: v.e }));
    const mixes = MIX_ORDER.map(k => rows.find(r => r.value === k)).filter(Boolean);
    const rest = rows.filter(r => !MIX_ORDER.includes(r.value))
      .sort((a, b) => a.label.localeCompare(b.label, "en"));
    return [...mixes, ...rest];
  };
  return {
    dog: { breeds: opts(DOGS), activity: DOG_ACT.map(([value, label]) => ({ value, label })) },
    cat: { breeds: opts(CATS), activity: CAT_ACT.map(([value, label]) => ({ value, label })) },
    bcs: BCS_DESC
  };
}

/* pets that are not dogs or cats get a care sheet from the Dewclaw kit, in the same shape */
const kitOf = () => (typeof self !== "undefined" && self.DewclawKit) || null;
const PetLifeEngine = {
  buildChart: (raw, opts) => { const K = kitOf(); return K && raw && K.isOther(raw) ? K.otherChart(raw, opts) : buildChart(raw, opts); },
  catalog: () => { const c = catalog(), K = kitOf(); return K ? { ...c, ...K.catalogExtra() } : c; },
  normalize };
if (typeof module !== "undefined" && module.exports) module.exports = PetLifeEngine;
else self.PetLifeEngine = PetLifeEngine;
})();
