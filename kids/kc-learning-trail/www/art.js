/* KC's Learning Trail - all artwork, drawn in code as inline SVG strings.
   No images are loaded from anywhere. Every picture lives in a 100 x 100 box. */
(function (root) {
  "use strict";
  var KC = { coat: "#f1dcae", shade: "#dcc08a", belly: "#fcf5e6", ear: "#d9a866", tailTip: "#fbf1dc",
             nose: "#b57f78", eye: "#4a2e1c", harness: "#1f1f22", collar: "#3f7fd6", tongue: "#ff8fa3" };
  var INK = "#3a2b20";
  var O = 'stroke="' + INK + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  var NS = 'fill="none" stroke-linejoin="round" stroke-linecap="round"';
  function svg(inner, cls, vb) {
    return '<svg class="' + (cls || "pic") + '" viewBox="' + (vb || "0 0 100 100") + '" aria-hidden="true" focusable="false">' + inner + "</svg>";
  }
  function eye(x, y, r) { r = r || 3.5; return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + INK + '"/><circle cx="' + (x + r * 0.3) + '" cy="' + (y - r * 0.35) + '" r="' + r * 0.3 + '" fill="#fff"/>'; }
  /* a stroked line with a dark edge, for necks, antlers, legs */
  function limb(d, col, w) { return '<path d="' + d + '" ' + NS + ' stroke="' + INK + '" stroke-width="' + (w + 5) + '"/><path d="' + d + '" ' + NS + ' stroke="' + col + '" stroke-width="' + w + '"/>'; }

  var P = {};
  /* ---- things KC counts ---- */
  P.ball = '<circle cx="50" cy="50" r="38" fill="#f26a1b" ' + O + '/><path d="M33 17 Q56 50 33 83" ' + NS + ' stroke="#2f6fd0" stroke-width="9"/><circle cx="63" cy="33" r="6" fill="#ffb37a" opacity=".9"/>';
  P.cone = '<path d="M50 10 V20" ' + NS + ' stroke="' + INK + '" stroke-width="6"/><path d="M50 16 Q84 30 76 62 Q68 90 50 92 Q32 90 24 62 Q16 30 50 16Z" fill="#9a6233" ' + O + '/>' +
    '<path d="M32 38 Q41 48 50 38 Q59 48 68 38 M27 54 Q38 66 50 54 Q62 66 73 54 M32 70 Q41 82 50 70 Q59 82 68 70" ' + NS + ' stroke="#5d3615" stroke-width="3.5"/>';
  P.duck = '<path d="M12 60 Q14 44 34 48 Q52 52 60 46 Q66 60 62 70 Q54 84 34 82 Q14 80 12 60Z" fill="#ffd23c" ' + O + '/><circle cx="68" cy="36" r="18" fill="#ffd23c" ' + O + '/>' +
    '<path d="M83 32 L98 38 L83 45Z" fill="#f28c28" ' + O + '/><path d="M26 60 Q38 54 48 62 Q40 72 26 68Z" fill="#f0b61f" ' + O + '/>' + eye(72, 32, 3.5);
  P.treat = (function () {
    var sh = function (a) { return '<g ' + a + '><rect x="26" y="40" width="48" height="20" rx="4"/><circle cx="24" cy="38" r="12"/><circle cx="24" cy="62" r="12"/><circle cx="76" cy="38" r="12"/><circle cx="76" cy="62" r="12"/></g>'; };
    return '<g transform="rotate(-18 50 50)">' + sh('fill="' + INK + '" stroke="' + INK + '" stroke-width="6"') + sh('fill="#e3a857"') + '<circle cx="42" cy="50" r="2.5" fill="#b9792f"/><circle cx="50" cy="50" r="2.5" fill="#b9792f"/><circle cx="58" cy="50" r="2.5" fill="#b9792f"/></g>';
  })();
  /* ---- Pacific Northwest stickers ---- */
  P.pine = '<rect x="44" y="74" width="12" height="18" fill="#8a5a2b" ' + O + '/><path d="M50 8 L72 38 H60 L80 62 H64 L86 80 H14 L36 62 H20 L40 38 H28Z" fill="#2e8b57" ' + O + '/>';
  P.salmon = '<path d="M8 50 Q34 22 66 40 L92 26 L85 50 L92 74 L66 60 Q34 78 8 50Z" fill="#f08a7a" ' + O + '/><path d="M14 54 Q38 70 64 58 Q40 60 14 54Z" fill="#fde3d6"/>' +
    '<path d="M32 38 Q36 50 32 62" ' + NS + ' stroke="' + INK + '" stroke-width="2.5"/>' + eye(22, 46, 3.5) + '<circle cx="46" cy="42" r="2" fill="#b8504a"/><circle cx="56" cy="46" r="2" fill="#b8504a"/><circle cx="50" cy="50" r="2" fill="#b8504a"/>';
  P.mountain = '<circle cx="78" cy="24" r="12" fill="#ffd23c" ' + O + '/><path d="M4 86 L42 20 L58 46 L70 34 L96 86Z" fill="#7d8fa8" ' + O + '/><path d="M42 20 L30 41 L38 37 L44 46 L50 37 L56 43 L54 39Z" fill="#fff" ' + O + '/><path d="M4 86 Q50 74 96 86 V92 H4Z" fill="#2e8b57" ' + O + '/>';
  P.mushroom = '<path d="M40 50 Q39 80 34 90 H66 Q61 80 60 50Z" fill="#fff3dc" ' + O + '/><path d="M8 54 Q10 14 50 12 Q90 14 92 54 Q50 64 8 54Z" fill="#e3342f" ' + O + '/><circle cx="34" cy="34" r="7" fill="#fff"/><circle cx="60" cy="26" r="6" fill="#fff"/><circle cx="72" cy="44" r="5" fill="#fff"/><circle cx="48" cy="46" r="4" fill="#fff"/>';
  P.heron = limb("M46 68 L44 94 M56 68 L58 94", "#f2a93b", 3) + limb("M62 54 Q80 42 66 30 Q56 22 64 14", "#7f9bb8", 8) +
    '<ellipse cx="46" cy="58" rx="26" ry="15" fill="#7f9bb8" ' + O + '/><path d="M24 58 Q40 50 62 60 Q44 70 24 58Z" fill="#5c7896"/>' +
    '<path d="M70 9 L97 15 L70 19Z" fill="#f2a93b" ' + O + '/><circle cx="66" cy="13" r="8" fill="#7f9bb8" ' + O + '/><path d="M62 8 Q52 4 46 8" ' + NS + ' stroke="' + INK + '" stroke-width="3"/>' + eye(68, 12, 2.4);
  P.bear = '<circle cx="24" cy="28" r="13" fill="#8b5a36" ' + O + '/><circle cx="76" cy="28" r="13" fill="#8b5a36" ' + O + '/><circle cx="24" cy="28" r="6" fill="#c9966a"/><circle cx="76" cy="28" r="6" fill="#c9966a"/>' +
    '<circle cx="50" cy="54" r="36" fill="#8b5a36" ' + O + '/><ellipse cx="50" cy="66" rx="17" ry="13" fill="#e8cfa9"/><ellipse cx="50" cy="60" rx="7" ry="5" fill="' + INK + '"/><path d="M50 65 V71 M42 73 Q50 78 58 73" ' + NS + ' stroke="' + INK + '" stroke-width="2.5"/>' + eye(36, 46) + eye(64, 46);
  P.fox = '<path d="M16 10 L44 34 L18 48Z" fill="#f07c2a" ' + O + '/><path d="M84 10 L56 34 L82 48Z" fill="#f07c2a" ' + O + '/><path d="M50 92 L10 46 Q50 12 90 46Z" fill="#f07c2a" ' + O + '/>' +
    '<path d="M50 91 L20 57 Q36 64 50 54 Q64 64 80 57Z" fill="#fff"/><circle cx="50" cy="86" r="6" fill="' + INK + '"/>' + eye(36, 50) + eye(64, 50);
  P.owl = '<path d="M24 26 L22 8 L40 20Z" fill="#7d5a3c" ' + O + '/><path d="M76 26 L78 8 L60 20Z" fill="#7d5a3c" ' + O + '/><ellipse cx="50" cy="54" rx="32" ry="38" fill="#9b7653" ' + O + '/><ellipse cx="50" cy="68" rx="19" ry="20" fill="#e8cfa9"/>' +
    '<path d="M40 62 l5 5 5-5 5 5 5-5 M42 74 l4 4 4-4 4 4 4-4" ' + NS + ' stroke="#9b7653" stroke-width="2.5"/><circle cx="36" cy="40" r="14" fill="#fff" ' + O + '/><circle cx="64" cy="40" r="14" fill="#fff" ' + O + '/>' + eye(36, 40, 6) + eye(64, 40, 6) + '<path d="M44 48 L56 48 L50 58Z" fill="#f2a93b" ' + O + '/>';
  P.elk = limb("M38 36 Q22 30 20 8 M27 26 L10 22 M22 16 L10 8", "#ead7b0", 4) + limb("M62 36 Q78 30 80 8 M73 26 L90 22 M78 16 L90 8", "#ead7b0", 4) +
    '<ellipse cx="24" cy="44" rx="10" ry="6" fill="#a8703f" ' + O + ' transform="rotate(-20 24 44)"/><ellipse cx="76" cy="44" rx="10" ry="6" fill="#a8703f" ' + O + ' transform="rotate(20 76 44)"/>' +
    '<path d="M32 44 Q50 28 68 44 L62 82 Q50 96 38 82Z" fill="#a8703f" ' + O + '/><ellipse cx="50" cy="84" rx="11" ry="8" fill="#5d3a22"/>' + eye(40, 54) + eye(60, 54);
  P.beaver = '<circle cx="24" cy="26" r="9" fill="#6d4226" ' + O + '/><circle cx="76" cy="26" r="9" fill="#6d4226" ' + O + '/><ellipse cx="50" cy="52" rx="36" ry="34" fill="#8a5632" ' + O + '/><ellipse cx="50" cy="62" rx="20" ry="14" fill="#d9b48a"/>' +
    '<ellipse cx="50" cy="54" rx="8" ry="5.5" fill="' + INK + '"/><rect x="42" y="66" width="8" height="14" rx="1.5" fill="#fff" ' + O + '/><rect x="50" y="66" width="8" height="14" rx="1.5" fill="#fff" ' + O + '/>' + eye(34, 42) + eye(66, 42);
  P.otter = '<circle cx="18" cy="44" r="8" fill="#6f5340" ' + O + '/><circle cx="82" cy="44" r="8" fill="#6f5340" ' + O + '/><ellipse cx="50" cy="52" rx="36" ry="32" fill="#8c6a4f" ' + O + '/><path d="M22 60 Q28 40 50 44 Q72 40 78 60 Q70 82 50 82 Q30 82 22 60Z" fill="#efe0c6"/>' +
    '<path d="M42 54 Q50 48 58 54 Q56 62 50 63 Q44 62 42 54Z" fill="' + INK + '"/><path d="M50 63 V69 M43 71 Q50 76 57 71 M36 62 L20 58 M36 66 L20 68 M64 62 L80 58 M64 66 L80 68" ' + NS + ' stroke="' + INK + '" stroke-width="2.2"/>' + eye(36, 46) + eye(64, 46);
  P.orca = '<path d="M46 36 L56 8 L66 40Z" fill="#1f2430" ' + O + '/><path d="M6 58 Q26 30 60 38 Q76 42 84 30 L96 22 L92 40 L98 54 L84 48 Q72 74 40 76 Q16 76 6 58Z" fill="#1f2430" ' + O + '/>' +
    '<path d="M9 60 Q30 74 58 66 Q38 62 22 56Z" fill="#fff"/><ellipse cx="27" cy="47" rx="8" ry="4" fill="#fff" transform="rotate(-12 27 47)"/><circle cx="18" cy="52" r="2.2" fill="#fff"/><path d="M40 70 L48 88 L58 70Z" fill="#1f2430" ' + O + '/>';
  P.frog = '<circle cx="30" cy="32" r="16" fill="#4caf50" ' + O + '/><circle cx="70" cy="32" r="16" fill="#4caf50" ' + O + '/><ellipse cx="50" cy="60" rx="40" ry="28" fill="#4caf50" ' + O + '/>' +
    '<circle cx="30" cy="31" r="10" fill="#fff"/><circle cx="70" cy="31" r="10" fill="#fff"/>' + eye(30, 32, 5) + eye(70, 32, 5) + '<path d="M26 64 Q50 84 74 64" ' + NS + ' stroke="' + INK + '" stroke-width="3"/><circle cx="45" cy="54" r="1.6" fill="' + INK + '"/><circle cx="55" cy="54" r="1.6" fill="' + INK + '"/>';
  P.squirrel = '<path d="M66 88 Q98 74 90 38 Q82 10 56 24 Q76 34 70 56 Q66 72 66 88Z" fill="#c96f2e" ' + O + '/><ellipse cx="46" cy="68" rx="20" ry="23" fill="#d98545" ' + O + '/><ellipse cx="42" cy="72" rx="10" ry="14" fill="#f6e3c5"/>' +
    '<path d="M38 22 L44 8 L52 24Z" fill="#d98545" ' + O + '/><circle cx="36" cy="38" r="17" fill="#d98545" ' + O + '/><circle cx="20" cy="42" r="3" fill="' + INK + '"/>' + eye(32, 34) + '<circle cx="28" cy="62" r="7" fill="#c98a3d" ' + O + '/>';
  P.eagle = '<path d="M22 62 Q50 52 84 62 L90 94 H16Z" fill="#5b3a21" ' + O + '/><path d="M30 64 Q26 18 56 16 Q84 18 80 48 Q78 62 62 66Z" fill="#fff" ' + O + '/>' +
    '<path d="M32 38 Q8 36 12 58 Q22 50 34 54Z" fill="#f6c21c" ' + O + '/><path d="M44 30 L62 34" ' + NS + ' stroke="' + INK + '" stroke-width="3.5"/>' + eye(54, 40, 4);
  P.fern = (function () {
    var s = '<path d="M50 94 Q44 52 58 8" ' + NS + ' stroke="#1f7a45" stroke-width="5"/>', i, t, x, y, r;
    for (i = 0; i < 7; i++) {
      t = i / 7; x = 50 - 6 * Math.sin(t * 2.2) + t * t * 10; y = 86 - t * 72; r = 24 - t * 16;
      s += '<ellipse cx="' + (x - r * 0.62).toFixed(1) + '" cy="' + (y - 4).toFixed(1) + '" rx="' + (r * 0.62).toFixed(1) + '" ry="5.5" fill="#35a35d" stroke="' + INK + '" stroke-width="2" transform="rotate(22 ' + x.toFixed(1) + " " + y.toFixed(1) + ')"/>' +
           '<ellipse cx="' + (x + r * 0.62).toFixed(1) + '" cy="' + (y - 4).toFixed(1) + '" rx="' + (r * 0.62).toFixed(1) + '" ry="5.5" fill="#35a35d" stroke="' + INK + '" stroke-width="2" transform="rotate(-22 ' + x.toFixed(1) + " " + y.toFixed(1) + ')"/>';
    }
    return s;
  })();
  P.tent = '<path d="M4 86 H96" ' + NS + ' stroke="#2e8b57" stroke-width="7"/><path d="M50 14 L94 84 H6Z" fill="#f28c28" ' + O + '/><path d="M50 36 L68 84 H32Z" fill="#7a3f12" ' + O + '/><path d="M50 14 V4 L62 8 L50 12" fill="#3f7fd6" ' + O + '/>';
  P.canoe = '<path d="M30 20 L66 60" ' + NS + ' stroke="#8a5a2b" stroke-width="5"/><ellipse cx="27" cy="16" rx="7" ry="11" fill="#c98a3d" ' + O + ' transform="rotate(-42 27 16)"/><path d="M6 46 Q50 66 94 46 Q88 74 50 76 Q12 74 6 46Z" fill="#d9432f" ' + O + '/>' +
    '<path d="M14 56 Q50 72 86 56" ' + NS + ' stroke="#fff" stroke-width="3"/><path d="M4 86 q8 -8 16 0 t16 0 t16 0 t16 0 t16 0 t12 0" ' + NS + ' stroke="#3f9bd6" stroke-width="5"/>';
  P.campfire = '<path d="M50 10 Q76 38 70 58 Q66 76 50 78 Q34 76 30 58 Q27 44 40 32 Q42 44 47 44 Q42 26 50 10Z" fill="#f2711c" ' + O + '/><path d="M50 40 Q62 54 58 64 Q56 72 50 72 Q43 72 42 64 Q41 54 50 40Z" fill="#ffd23c"/>' +
    '<rect x="14" y="76" width="72" height="12" rx="6" fill="#8a5a2b" ' + O + ' transform="rotate(10 50 82)"/><rect x="14" y="76" width="72" height="12" rx="6" fill="#a8703f" ' + O + ' transform="rotate(-10 50 82)"/>';
  P.acorn = '<path d="M50 20 Q50 10 58 6" ' + NS + ' stroke="' + INK + '" stroke-width="5"/><path d="M26 46 Q26 84 50 94 Q74 84 74 46Z" fill="#d49a4a" ' + O + '/><path d="M18 48 Q20 22 50 20 Q80 22 82 48 Q50 56 18 48Z" fill="#7a4a2a" ' + O + '/>' +
    '<path d="M30 34 l8 6 M44 28 l8 6 M60 30 l8 6 M40 42 l8 4 M58 42 l8 4" ' + NS + ' stroke="#4f2d17" stroke-width="2.5"/>';
  function starPts(cx, cy, R, r) { var a = [], i, ang, rad; for (i = 0; i < 10; i++) { ang = -Math.PI / 2 + i * Math.PI / 5; rad = i % 2 ? r : R; a.push((cx + Math.cos(ang) * rad).toFixed(1) + "," + (cy + Math.sin(ang) * rad).toFixed(1)); } return a.join(" "); }
  P.starfish = '<polygon points="' + starPts(50, 54, 44, 20) + '" fill="#f08a3c" stroke="' + INK + '" stroke-width="9" stroke-linejoin="round"/><polygon points="' + starPts(50, 54, 44, 20) + '" fill="#f08a3c" stroke="#f08a3c" stroke-width="4" stroke-linejoin="round"/>' +
    '<circle cx="50" cy="54" r="3" fill="#fff"/><circle cx="50" cy="34" r="2.5" fill="#fff"/><circle cx="31" cy="48" r="2.5" fill="#fff"/><circle cx="69" cy="48" r="2.5" fill="#fff"/><circle cx="38" cy="70" r="2.5" fill="#fff"/><circle cx="62" cy="70" r="2.5" fill="#fff"/>';
  P.crab = limb("M26 62 L10 70 M28 70 L14 84 M74 62 L90 70 M72 70 L86 84 M30 50 L18 40 M70 50 L82 40", "#e2573b", 4) +
    '<circle cx="16" cy="30" r="13" fill="#e2573b" ' + O + '/><path d="M16 30 L8 16 L20 20Z" fill="#fff5ea" ' + O + '/><circle cx="84" cy="30" r="13" fill="#e2573b" ' + O + '/><path d="M84 30 L92 16 L80 20Z" fill="#fff5ea" ' + O + '/>' +
    '<path d="M40 44 V32 M60 44 V32" ' + NS + ' stroke="' + INK + '" stroke-width="3"/><ellipse cx="50" cy="60" rx="30" ry="20" fill="#e2573b" ' + O + '/>' + eye(40, 30, 4.5) + eye(60, 30, 4.5) + '<path d="M40 66 Q50 74 60 66" ' + NS + ' stroke="' + INK + '" stroke-width="2.5"/>';
  P.slug = '<path d="M78 34 L72 14 M88 36 L92 16" ' + NS + ' stroke="' + INK + '" stroke-width="3.5"/><circle cx="72" cy="13" r="3.5" fill="' + INK + '"/><circle cx="92" cy="15" r="3.5" fill="' + INK + '"/>' +
    '<path d="M6 78 Q8 56 34 56 H58 Q70 56 72 42 Q74 30 84 30 Q96 32 95 50 Q94 82 68 84 H14 Q6 84 6 78Z" fill="#f4d03f" ' + O + '/><circle cx="30" cy="68" r="3" fill="#c79a12"/><circle cx="46" cy="72" r="3" fill="#c79a12"/><circle cx="58" cy="66" r="2.5" fill="#c79a12"/>' + eye(86, 44, 2.6) + '<path d="M82 54 Q87 58 91 53" ' + NS + ' stroke="' + INK + '" stroke-width="2"/>';
  P.lighthouse = '<path d="M60 26 L96 14 V38Z" fill="#ffe680" opacity=".85"/><path d="M40 26 L4 14 V38Z" fill="#ffe680" opacity=".85"/><path d="M36 84 L41 36 H59 L64 84Z" fill="#fff" ' + O + '/><path d="M40 48 H60 L61.2 60 H38.8Z" fill="#e3342f"/><path d="M37.6 72 H62.4 L63.6 84 H36.4Z" fill="#e3342f"/>' +
    '<path d="M36 84 L41 36 H59 L64 84Z" fill="none" ' + O + '/><rect x="40" y="22" width="20" height="14" fill="#ffd23c" ' + O + '/><path d="M34 22 L50 6 L66 22Z" fill="#e3342f" ' + O + '/><path d="M18 92 Q50 76 82 92Z" fill="#7d8fa8" ' + O + '/>';
  /* ---- letter pictures that are drawn rather than emoji ---- */
  P.jar = '<rect x="24" y="30" width="52" height="60" rx="12" fill="#b3204f" ' + O + '/><rect x="22" y="14" width="56" height="18" rx="5" fill="#f2c14e" ' + O + '/><rect x="34" y="48" width="32" height="26" rx="5" fill="#fff8ec" ' + O + '/>' +
    '<path d="M50 56 Q59 56 56 65 Q53 71 50 71 Q47 71 44 65 Q41 56 50 56Z" fill="#e3342f"/><path d="M46 56 L50 52 L54 56" ' + NS + ' stroke="#2e8b57" stroke-width="3"/><path d="M30 38 V80" ' + NS + ' stroke="#fff" stroke-width="3" opacity=".45"/>';
  P.xylo = (function () {
    var cols = ["#e3342f", "#f28c28", "#ffd23c", "#12a36d", "#1e66d0", "#9b5de5"], s = "", i, h;
    for (i = 0; i < 6; i++) { h = 62 - i * 6; s += '<rect x="' + (10 + i * 13.6) + '" y="' + (56 - h / 2) + '" width="11" height="' + h + '" rx="3" fill="' + cols[i] + '" ' + O + '/>'; }
    return '<path d="M6 40 L94 46 M6 72 L94 66" ' + NS + ' stroke="#8a5a2b" stroke-width="5"/>' + s + limb("M70 10 L52 30", "#c98a3d", 3) + limb("M92 12 L78 30", "#c98a3d", 3) + '<circle cx="71" cy="9" r="6" fill="#fff" ' + O + '/><circle cx="93" cy="11" r="6" fill="#fff" ' + O + '/>';
  })();
  P.yoyo = '<path d="M50 14 V40" ' + NS + ' stroke="' + INK + '" stroke-width="3"/><circle cx="50" cy="9" r="6" fill="none" stroke="' + INK + '" stroke-width="3"/><circle cx="50" cy="64" r="28" fill="#1e66d0" ' + O + '/><circle cx="50" cy="64" r="17" fill="#ffd23c" ' + O + '/><circle cx="50" cy="64" r="5" fill="#e3342f"/>';
  /* ---- helpers used by the interface ---- */
  P.bowl = '<path d="M8 44 H92 L82 86 Q50 92 18 86Z" fill="#3f7fd6" ' + O + '/><ellipse cx="50" cy="44" rx="42" ry="9" fill="#2b5fa8" ' + O + '/>';
  P.paw = '<ellipse cx="50" cy="66" rx="24" ry="20" fill="#7a4a2a"/><ellipse cx="20" cy="42" rx="9" ry="12" fill="#7a4a2a"/><ellipse cx="40" cy="24" rx="9" ry="13" fill="#7a4a2a"/><ellipse cx="62" cy="24" rx="9" ry="13" fill="#7a4a2a"/><ellipse cx="81" cy="42" rx="9" ry="12" fill="#7a4a2a"/>';
  P.basket = '<path d="M6 34 H94 L84 92 H16Z" fill="#d9a05b" ' + O + '/><path d="M6 34 H94 V46 H6Z" fill="#b97a37" ' + O + '/><path d="M24 50 L28 90 M42 50 L43 90 M58 50 L57 90 M76 50 L72 90" ' + NS + ' stroke="#b97a37" stroke-width="3"/>';

  var SHAPES = {
    circle: '<circle cx="50" cy="50" r="38"',
    square: '<rect x="14" y="14" width="72" height="72" rx="5"',
    triangle: '<path d="M50 10 L92 86 H8Z"',
    star: '<polygon points="' + starPts(50, 54, 46, 19) + '"',
    heart: '<path d="M50 88 C8 58 4 30 26 18 C38 12 50 22 50 32 C50 22 62 12 74 18 C96 30 92 58 50 88Z"'
  };
  /* Colour-blind-considerate set: each differs in lightness as well as hue, and every shape gets a dark outline. */
  var COLORS = { red: "#d7263d", blue: "#1553b7", yellow: "#ffd21f", green: "#27b376", purple: "#c58af0" };
  function shape(name, color) {
    var fill = color ? COLORS[color] : "#ffffff";
    return svg(SHAPES[name] + ' fill="' + fill + '" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"' + (color ? "" : ' stroke-dasharray="1 9" stroke-linecap="round"') + "/>");
  }
  function blob(color) {
    return svg('<path d="M50 8 Q66 6 70 22 Q90 16 92 36 Q98 52 84 62 Q94 82 72 86 Q62 98 48 88 Q30 98 22 80 Q2 76 10 56 Q0 38 18 30 Q20 8 50 8Z" fill="' + COLORS[color] + '" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/><circle cx="34" cy="34" r="7" fill="#fff" opacity=".5"/>');
  }
  function text(str, size, vbw) {
    vbw = vbw || 100;
    return svg('<text x="' + vbw / 2 + '" y="52" font-size="' + size + '" text-anchor="middle" dominant-baseline="central">' + str + "</text>", "pic txt", "0 0 " + vbw + " 100");
  }
  function emoji(ch) { return svg('<text x="50" y="54" font-size="76" text-anchor="middle" dominant-baseline="central">' + ch + "</text>", "pic emo"); }
  function pic(id) { return svg(P[id] || ""); }

  /* KC, side view, standing. Same palette and shapes as drawKC() in studio/kc-dash. Origin is between her paws. */
  function kc() {
    var c = KC;
    var leg = function (x, col) { return '<g transform="translate(' + x + ' -16)"><rect x="-4" y="0" width="8" height="17" rx="4" fill="' + col + '"/><rect x="-4" y="12" width="9" height="5" rx="2.5" fill="' + c.belly + '"/></g>'; };
    return '<svg class="kc" viewBox="-40 -66 96 70" aria-hidden="true" focusable="false"><g class="kc-body">' +
      leg(-15, c.shade) + leg(14, c.shade) +
      '<g class="kc-tail"><path d="M0 0 Q-3 -16 6 -22" fill="none" stroke="' + c.coat + '" stroke-width="7" stroke-linecap="round"/><path d="M3 -20 L6 -22" fill="none" stroke="' + c.tailTip + '" stroke-width="7" stroke-linecap="round"/></g>' +
      '<ellipse cx="0" cy="-26" rx="26" ry="13" fill="' + c.coat + '"/><path d="M-13 -20 A17 6 0 0 0 21 -20Z" fill="' + c.belly + '"/>' +
      leg(-11, c.coat) + leg(18, c.coat) +
      '<path d="M7 -38 L10 -15 M8 -36 L21 -22" fill="none" stroke="' + c.harness + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M15 -43 L23 -29" fill="none" stroke="' + c.collar + '" stroke-width="4" stroke-linecap="round"/>' +
      '<g class="kc-head"><circle cx="25" cy="-41" r="12" fill="' + c.coat + '"/><ellipse cx="35" cy="-38" rx="9" ry="6.5" fill="' + c.belly + '"/><circle cx="43" cy="-40" r="3" fill="' + c.nose + '"/>' +
      '<circle cx="28" cy="-45" r="2.2" fill="' + c.eye + '"/><ellipse cx="36" cy="-32" rx="3" ry="4.5" fill="' + c.tongue + '" transform="rotate(11 36 -32)"/>' +
      '<g class="kc-ear"><ellipse cx="0" cy="7" rx="5.5" ry="10" fill="' + c.ear + '"/></g></g>' +
      "</g></svg>";
  }
  /* KC's face, front view, for the app icon, the reward screen and the grown-ups corner. */
  function kcFaceInner() {
    var c = KC;
    return '<path d="M26 34 Q4 30 8 62 Q12 80 26 74 Q32 58 34 40Z" fill="' + c.ear + '"/><path d="M74 34 Q96 30 92 62 Q88 80 74 74 Q68 58 66 40Z" fill="' + c.ear + '"/>' +
      '<path d="M30 84 Q50 96 70 84 L72 96 H28Z" fill="' + c.harness + '"/><path d="M30 80 Q50 92 70 80 L70 87 Q50 99 30 87Z" fill="' + c.collar + '"/>' +
      '<ellipse cx="50" cy="50" rx="32" ry="34" fill="' + c.coat + '"/><ellipse cx="50" cy="64" rx="19" ry="16" fill="' + c.belly + '"/>' +
      '<path d="M43 74 Q50 80 57 74 L56 84 Q50 92 44 84Z" fill="' + c.tongue + '"/><path d="M50 76 V86" stroke="#e86f88" stroke-width="1.6" fill="none"/>' +
      '<path d="M40 70 Q45 76 50 70 Q55 76 60 70" fill="none" stroke="' + c.eye + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<ellipse cx="50" cy="60" rx="8" ry="6" fill="' + c.nose + '"/><ellipse cx="48" cy="58" rx="2.5" ry="1.5" fill="#d9a9a2"/>' +
      '<circle cx="37" cy="44" r="5" fill="' + c.eye + '"/><circle cx="63" cy="44" r="5" fill="' + c.eye + '"/><circle cx="38.6" cy="42.2" r="1.7" fill="#fff"/><circle cx="64.6" cy="42.2" r="1.7" fill="#fff"/>' +
      '<path d="M30 36 Q36 31 43 34 M57 34 Q64 31 70 36" fill="none" stroke="' + c.shade + '" stroke-width="2.4" stroke-linecap="round"/>';
  }
  function kcFace() { return svg(kcFaceInner(), "pic kcface"); }

  var STICKERS = [
    ["pine", "pine tree"], ["salmon", "salmon"], ["mountain", "mountain"], ["mushroom", "mushroom"], ["heron", "heron"], ["bear", "bear"],
    ["owl", "owl"], ["elk", "elk"], ["beaver", "beaver"], ["otter", "otter"], ["orca", "orca"], ["fox", "fox"],
    ["frog", "frog"], ["squirrel", "squirrel"], ["eagle", "eagle"], ["fern", "fern"], ["tent", "tent"], ["canoe", "canoe"],
    ["campfire", "campfire"], ["acorn", "acorn"], ["starfish", "sea star"], ["crab", "crab"], ["slug", "banana slug"], ["lighthouse", "lighthouse"],
    ["ball", "KC's ball"], ["duck", "duck"], ["cone", "pine cone"]
  ];
  var api = { P: P, KC: KC, INK: INK, COLORS: COLORS, SHAPES: SHAPES, STICKERS: STICKERS, svg: svg, pic: pic, shape: shape, blob: blob, text: text, emoji: emoji, kc: kc, kcFace: kcFace, kcFaceInner: kcFaceInner };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KCArt = api;
})(typeof window !== "undefined" ? window : globalThis);
