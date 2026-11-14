/* The calculator on Dewclaw's guide pages. It runs the app's own care
   engine (engine.js, cut from index.html by tools/build-pages.mjs), so a
   number on a guide page and the same pet's chart in the app always agree. */
(function () {
  "use strict";
  var form = document.getElementById("calc");
  if (!form || !self.PetLifeEngine) return;
  var E = self.PetLifeEngine, $ = function (id) { return document.getElementById(id); };
  var species = form.dataset.species;

  /* the calculator pages let you pick the breed; breed pages fix it */
  var pick = $("cBreed");
  if (pick && !pick.options.length) {
    pick.innerHTML = E.catalog()[species].breeds.map(function (b) {
      return '<option value="' + b.value + '">' + b.label.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</option>";
    }).join("");
    pick.value = form.dataset.breed;
  }

  function input() {
    var age = Math.max(0, Number($("cAge").value) || 0);
    return {
      species: species, breed: pick ? pick.value : form.dataset.breed,
      weight: Number($("cWeight").value) || 1, unit: $("cUnit").value,
      ageY: Math.floor(age), ageM: Math.round((age % 1) * 12) % 12,
      sex: "m", fixed: $("cFixed").value, bcs: 5, activity: $("cAct").value, kcalCup: Number($("cKcal").value) || 360
    };
  }
  function bold(s) { var m = /\*\*(.+?)\*\*/.exec(s || ""); return m ? m[1] : ""; }
  function row(sec, k) { var r = (sec && sec.rows || []).filter(function (x) { return x.k === k; })[0]; return r ? r.v : ""; }

  function run() {
    var I = input(), c = E.buildChart(I, { tier: "beyond" });
    var sec = function (id) { return c.sections.filter(function (s) { return s.id === id; })[0]; };
    var n = sec("nutrition"), a = sec("activity");
    $("oKcal").textContent = c.vitals[2].v;
    $("oKcalNote").textContent = c.vitals[2].note;
    $("oCups").textContent = bold(row(n, "Portion")).replace(" cups", "");
    $("oMeals").textContent = bold(row(n, "Meals")) + " meals a day";
    $("oTreat").textContent = bold(row(n, "Treat budget")).replace(" kcal", "");
    $("oMove").textContent = (bold(row(a, "Daily movement")) || bold(a && a.rows[0] && a.rows[0].v)).replace(" minutes", "") || "—";
    $("oStage").textContent = c.vitals[0].v;
    var q = "species=" + I.species + "&breed=" + encodeURIComponent(I.breed) + "&w=" + I.weight + "&unit=" + I.unit +
            "&age=" + (I.ageY + I.ageM / 12).toFixed(2).replace(/\.?0+$/, "");
    var go = $("cGo");
    go.href = go.dataset.base + "index.html?" + q + "&utm_source=guide&utm_medium=calc#/app";
  }
  form.addEventListener("input", run);
  form.addEventListener("submit", function (e) { e.preventDefault(); run(); });
  run();
})();
