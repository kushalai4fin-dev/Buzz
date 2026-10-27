// Buzz art set (Stage 2). Original hand-drawn style, drawn in code, so there are no image files,
// no per-story image cost, and no third-party artwork. The mascot is an original bee called Bee-Bee.
// Everything here is fixed markup written by us. Nothing from a news feed is ever put into it.
// Classes (styled in styles.css): ink = outline, c1/c2/c3 = the topic's three colours, paper = off-white,
// fill-ink = solid ink, dash = dotted line, thick = heavy line, pl = pale record groove.

(function () {
  'use strict';

  var star = function (x, y, s, cls) {
    s = s || 1;
    return '<path class="' + (cls || 'c3') + '" transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0-8l2.6 5.4 5.4 2.6-5.4 2.6L0 8l-2.6-5.4L-8 0l5.4-2.6z"/>';
  };
  var spark = function (x, y) { return '<path class="ink" d="M' + x + ' ' + (y - 5) + 'v10M' + (x - 5) + ' ' + y + 'h10"/>'; };

  var SCENES = {
    geopolitics:
      star(285, 28, 1.3) +
      '<circle class="c2" cx="86" cy="64" r="40"/>' +
      '<path class="c3" d="M62 48c8-8 20-6 24 2s-4 14-12 14-16-2-12-16z"/>' +
      '<path class="c3" d="M92 70c8-2 20 2 20 12s-10 12-18 8-6-16-2-20z"/>' +
      '<circle class="ink" cx="86" cy="64" r="40"/>' +
      '<path class="ink" d="M46 64h80M86 24c-18 16-18 64 0 80M86 24c18 16 18 64 0 80"/>' +
      '<path class="ink dash" d="M130 44C160 6 220 6 250 44"/>' +
      '<path class="ink" d="M244 36l8 8-11 3"/>' +
      '<path class="ink" d="M236 112V62"/><path class="c1" d="M236 62h32l-8 10 8 10h-32z"/><path class="ink" d="M236 62h32l-8 10 8 10h-32"/>' +
      '<path class="paper" d="M176 84h48a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8h-30l-10 8v-8h-8a8 8 0 0 1-8-8v-8a8 8 0 0 1 8-8z"/>' +
      '<path class="ink" d="M176 84h48a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8h-30l-10 8v-8h-8a8 8 0 0 1-8-8v-8a8 8 0 0 1 8-8z"/>' +
      '<path class="ink" d="M184 94h32M184 102h20"/>',

    science:
      star(268, 26, 1.2) + star(42, 102, 0.8) +
      '<g class="ink"><ellipse cx="86" cy="62" rx="44" ry="16"/><ellipse cx="86" cy="62" rx="44" ry="16" transform="rotate(60 86 62)"/><ellipse cx="86" cy="62" rx="44" ry="16" transform="rotate(120 86 62)"/></g>' +
      '<circle class="c1" cx="86" cy="62" r="9"/><circle class="ink" cx="86" cy="62" r="9"/>' +
      '<circle class="c3" cx="128" cy="62" r="5"/><circle class="ink" cx="128" cy="62" r="5"/>' +
      '<path class="paper" d="M196 22h28v30l24 46a8 8 0 0 1-7 12h-62a8 8 0 0 1-7-12l24-46z"/>' +
      '<path class="c2" d="M180 82h60l12 22a8 8 0 0 1-7 12h-70a8 8 0 0 1-7-12z"/>' +
      '<path class="ink" d="M196 22h28v30l24 46a8 8 0 0 1-7 12h-62a8 8 0 0 1-7-12l24-46zM192 22h36"/>' +
      '<circle class="paper" cx="208" cy="96" r="4"/><circle class="paper" cx="222" cy="104" r="3"/><circle class="paper" cx="214" cy="84" r="2.5"/>',

    finance:
      star(150, 24, 1) + spark(290, 30) +
      '<rect class="c2" x="50" y="84" width="26" height="30"/><rect class="c2" x="86" y="68" width="26" height="46"/><rect class="c2" x="122" y="50" width="26" height="64"/>' +
      '<path class="ink" d="M50 84h26v30H50zM86 68h26v46H86zM122 50h26v64h-26zM40 114h120"/>' +
      '<path class="ink" d="M44 74L94 52l22 8 50-34"/><path class="ink" d="M152 26h14v14"/>' +
      '<path class="c3" d="M206 100h64v14h-64z"/><path class="c3" d="M206 86h64v14h-64z"/><path class="c3" d="M206 72h64v14h-64z"/>' +
      '<path class="ink" d="M206 100h64v14h-64zM206 86h64v14h-64zM206 72h64v14h-64z"/>' +
      '<ellipse class="c3" cx="238" cy="62" rx="32" ry="10"/><ellipse class="ink" cx="238" cy="62" rx="32" ry="10"/>' +
      '<text class="t" x="238" y="40" text-anchor="middle">$</text>',

    economics:
      star(300, 100, 0.9) + spark(40, 28) +
      '<path class="c3" d="M56 30h42l30 30-36 36-36-36z"/>' +
      '<path class="ink" d="M56 30h42l30 30-36 36-36-36z"/><circle class="paper" cx="72" cy="46" r="4"/><circle class="ink" cx="72" cy="46" r="4"/>' +
      '<text class="t" x="98" y="70" text-anchor="middle">%</text>' +
      '<path class="ink" d="M170 22v82h120"/>' +
      '<path class="ink" d="M176 90l26-22 22 12 26-40 30 14"/>' +
      '<circle class="c1" cx="202" cy="68" r="5"/><circle class="c1" cx="224" cy="80" r="5"/><circle class="c1" cx="250" cy="40" r="5"/><circle class="c1" cx="280" cy="54" r="5"/>' +
      '<path class="ink" d="M172 40h10M172 60h10M172 80h10"/>',

    sports:
      star(210, 22, 1) + spark(30, 100) +
      '<circle class="paper" cx="96" cy="66" r="36"/>' +
      '<path class="fill-ink" d="M96 52l14 10-5 16H87l-5-16z"/>' +
      '<circle class="ink" cx="96" cy="66" r="36"/>' +
      '<path class="ink" d="M96 52V31M110 62l20-7M105 78l12 16M87 78L75 94M82 62l-20-7"/>' +
      '<path class="ink" d="M44 48H20M40 66H12M44 84H22"/>' +
      '<path class="c3" d="M214 30h44v22a22 22 0 0 1-44 0z"/>' +
      '<path class="ink" d="M214 30h44v22a22 22 0 0 1-44 0zM214 38h-12a10 10 0 0 0 10 18h4M258 38h12a10 10 0 0 1-10 18h-4M236 74v14M220 88h32v12h-32z"/>' +
      star(236, 50, 0.8, 'c1'),

    music:
      star(300, 30, 1) + spark(30, 30) +
      '<circle class="fill-ink" cx="92" cy="64" r="42"/>' +
      '<circle class="pl" cx="92" cy="64" r="34"/><circle class="pl" cx="92" cy="64" r="27"/>' +
      '<circle class="c1" cx="92" cy="64" r="15"/><circle class="paper" cx="92" cy="64" r="3.5"/>' +
      '<circle class="ink" cx="92" cy="64" r="42"/><circle class="ink" cx="92" cy="64" r="15"/>' +
      '<path class="ink dash" d="M148 40q16-14 30 0M156 28q22-22 44 0"/>' +
      '<ellipse class="fill-ink" cx="214" cy="92" rx="11" ry="8"/><path class="ink" d="M224 92V40"/><path class="ink" d="M224 40q18 4 14 24"/>' +
      '<ellipse class="fill-ink" cx="252" cy="100" rx="11" ry="8"/><ellipse class="fill-ink" cx="286" cy="90" rx="11" ry="8"/>' +
      '<path class="ink" d="M262 100V54M296 90V44"/><path class="c1" d="M262 54l34-10v12l-34 10z"/><path class="ink" d="M262 54l34-10v12l-34 10z"/>',

    movies:
      star(170, 26, 1) + spark(300, 100) +
      '<g transform="rotate(-8 85 62)"><rect class="fill-ink" x="40" y="22" width="90" height="82" rx="4"/>' +
      '<rect class="paper" x="46" y="28" width="10" height="7"/><rect class="paper" x="46" y="44" width="10" height="7"/><rect class="paper" x="46" y="60" width="10" height="7"/><rect class="paper" x="46" y="76" width="10" height="7"/><rect class="paper" x="46" y="92" width="10" height="7"/>' +
      '<rect class="paper" x="114" y="28" width="10" height="7"/><rect class="paper" x="114" y="44" width="10" height="7"/><rect class="paper" x="114" y="60" width="10" height="7"/><rect class="paper" x="114" y="76" width="10" height="7"/><rect class="paper" x="114" y="92" width="10" height="7"/>' +
      '<rect class="c2" x="62" y="30" width="48" height="66"/><path class="paper" d="M76 52l22 14-22 14z"/><path class="ink" d="M76 52l22 14-22 14z"/></g>' +
      '<rect class="paper" x="190" y="54" width="92" height="52"/>' +
      '<path class="ink" d="M190 54h92v52h-92zM202 72h38M202 84h56M202 96h28"/>' +
      '<rect class="c3" x="188" y="34" width="96" height="18"/>' +
      '<path class="fill-ink" d="M200 34h12l-8 18h-12zM224 34h12l-8 18h-12zM248 34h12l-8 18h-12z"/>' +
      '<path class="ink" d="M188 34h96v18h-96z"/>',

    entertainment:
      star(60, 30, 1.2) + star(270, 96, 1) +
      '<path class="ink" d="M140 38l-20-22M182 38l20-22"/><circle class="c1" cx="120" cy="16" r="4"/><circle class="c1" cx="202" cy="16" r="4"/>' +
      '<rect class="paper" x="100" y="36" width="122" height="70" rx="14"/>' +
      '<rect class="c2" x="110" y="46" width="82" height="50" rx="8"/>' +
      '<circle class="c1" cx="207" cy="58" r="5"/><circle class="c3" cx="207" cy="78" r="5"/>' +
      '<path class="ink" d="M100 36h122a14 14 0 0 1 14 14v42a14 14 0 0 1-14 14H114a14 14 0 0 1-14-14V50a14 14 0 0 1 14-14zM110 46h82v50h-82zM120 106v6M202 106v6"/>' +
      star(151, 71, 1.7) + '<path class="ink" d="M146 70l5-9 5 9"/>' +
      '<rect class="c1" x="34" y="70" width="8" height="5" transform="rotate(20 38 72)"/><rect class="c3" x="258" y="50" width="8" height="5" transform="rotate(-25 262 52)"/>' +
      '<rect class="c1" x="276" y="70" width="8" height="5" transform="rotate(35 280 72)"/><circle class="c3" cx="52" cy="92" r="3.5"/><circle class="c1" cx="248" cy="30" r="3.5"/>',

    animals:
      star(300, 24, 1) + spark(150, 100) +
      '<path class="c1" d="M92 90c-14 0-26-8-22-20 4-10 16-14 22-14s18 4 22 14c4 12-8 20-22 20z"/>' +
      '<ellipse class="c1" cx="62" cy="54" rx="8" ry="11" transform="rotate(-22 62 54)"/><ellipse class="c1" cx="80" cy="36" rx="8" ry="11" transform="rotate(-6 80 36)"/>' +
      '<ellipse class="c1" cx="106" cy="36" rx="8" ry="11" transform="rotate(6 106 36)"/><ellipse class="c1" cx="124" cy="54" rx="8" ry="11" transform="rotate(22 124 54)"/>' +
      '<g class="ink"><path d="M92 90c-14 0-26-8-22-20 4-10 16-14 22-14s18 4 22 14c4 12-8 20-22 20z"/><ellipse cx="62" cy="54" rx="8" ry="11" transform="rotate(-22 62 54)"/><ellipse cx="80" cy="36" rx="8" ry="11" transform="rotate(-6 80 36)"/><ellipse cx="106" cy="36" rx="8" ry="11" transform="rotate(6 106 36)"/><ellipse cx="124" cy="54" rx="8" ry="11" transform="rotate(22 124 54)"/></g>' +
      '<rect class="c3" x="226" y="70" width="14" height="38"/><path class="ink" d="M226 70h14v38h-14z"/>' +
      '<circle class="c2" cx="234" cy="46" r="26"/><circle class="c2" cx="210" cy="64" r="20"/><circle class="c2" cx="258" cy="64" r="20"/><rect class="c2" x="212" y="58" width="44" height="12"/>' +
      '<path class="ink" d="M234 20a26 26 0 0 1 24 16 20 20 0 0 1 20 28 20 20 0 0 1-20 6h-8M226 70h-6a20 20 0 0 1-10-36 26 26 0 0 1 24-14"/>' +
      '<path class="ink" d="M234 56v14M234 64l-8-8"/>',

    technology:
      star(300, 24, 1) + spark(40, 104) +
      '<rect class="c2" x="100" y="34" width="64" height="64" rx="8"/>' +
      '<rect class="paper" x="112" y="46" width="40" height="40" rx="4"/>' +
      '<path class="ink" d="M100 34h64v64h-64zM112 46h40v40h-40zM92 48h8M92 60h8M92 72h8M92 84h8M164 48h8M164 60h8M164 72h8M164 84h8M114 26v8M126 26v8M138 26v8M150 26v8M114 98v8M126 98v8M138 98v8M150 98v8"/>' +
      '<text class="t" x="132" y="75" text-anchor="middle">AI</text>' +
      '<path class="ink" d="M172 60h38l14-16h50M172 84h58l14 16h26"/>' +
      '<circle class="c3" cx="274" cy="44" r="6"/><circle class="ink" cx="274" cy="44" r="6"/><circle class="c1" cx="270" cy="100" r="6"/><circle class="ink" cx="270" cy="100" r="6"/>',

    tracked:
      star(280, 30, 1.2) + star(40, 100, 0.9) +
      '<circle class="c2" cx="128" cy="56" r="34"/>' +
      '<path class="ink thick" d="M153 81l32 30"/>' +
      '<circle class="ink thick" cx="128" cy="56" r="34"/>' +
      '<path class="ink" d="M112 44q8-10 20-8"/>' +
      star(128, 58, 1.8) +
      '<path class="c1" d="M222 26h40v70l-20-14-20 14z"/><path class="ink" d="M222 26h40v70l-20-14-20 14z"/>' +
      '<path class="ink dash" d="M180 30q16-14 34-4"/>',

    general:
      star(40, 30, 1.1) + star(290, 98, 1) +
      '<rect class="paper" x="60" y="24" width="190" height="84" rx="6"/>' +
      '<rect class="c1" x="72" y="36" width="82" height="14"/>' +
      '<rect class="c2" x="166" y="36" width="72" height="38"/><circle class="c3" cx="184" cy="49" r="7"/><path class="ink" d="M166 74l22-16 14 10 12-8 24 14"/>' +
      '<path class="ink" d="M60 24h190a6 6 0 0 1 6 6v72a6 6 0 0 1-6 6H60a6 6 0 0 1-6-6V30a6 6 0 0 1 6-6zM72 36h82v14H72zM166 36h72v38h-72zM72 62h82M72 74h82M72 86h166M72 96h120"/>'
  };

  var ALIASES = { world: 'geopolitics', politics: 'geopolitics', tech: 'technology', economy: 'economics', markets: 'finance' };

  function sceneName(topic) {
    var t = ALIASES[topic] || topic;
    return SCENES[t] ? t : 'general';
  }

  function scene(topic) {
    return '<svg class="scene" viewBox="0 0 320 124" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<g filter="url(#hard)"><g filter="url(#rough)">' + SCENES[sceneName(topic)] + '</g></g></svg>';
  }

  // Bee-Bee, the Buzz mascot. mood: 'happy' (default), 'think' (looking up), 'sleep' (nothing to show).
  function mascot(mood) {
    var eyes, mouth;
    if (mood === 'sleep') {
      eyes = '<path class="ink" d="M36 52q6 5 12 0M54 52q6 5 12 0"/>';
      mouth = '<path class="ink" d="M46 64q5 3 10 0"/><text class="z" x="74" y="34">z</text>';
    } else if (mood === 'think') {
      eyes = '<circle class="fill-ink" cx="42" cy="50" r="4"/><circle class="fill-ink" cx="60" cy="50" r="4"/><circle class="paper" cx="43.5" cy="48" r="1.4"/><circle class="paper" cx="61.5" cy="48" r="1.4"/>';
      mouth = '<path class="ink" d="M46 64h10"/><path class="ink dash" d="M76 30q8-6 14 0"/>';
    } else {
      eyes = '<circle class="fill-ink" cx="42" cy="52" r="4.5"/><circle class="fill-ink" cx="60" cy="52" r="4.5"/><circle class="paper" cx="43.6" cy="50.2" r="1.6"/><circle class="paper" cx="61.6" cy="50.2" r="1.6"/>';
      mouth = '<path class="ink" d="M44 62q7 8 14 0"/>';
    }
    return '<svg class="mascot" viewBox="0 0 102 100" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g filter="url(#rough)">' +
      '<path class="ink" d="M42 33q-6-14-14-16M60 33q6-14 14-16"/><circle class="c1" cx="27" cy="16" r="4"/><circle class="ink" cx="27" cy="16" r="4"/><circle class="c1" cx="75" cy="16" r="4"/><circle class="ink" cx="75" cy="16" r="4"/>' +
      '<ellipse class="paper" cx="30" cy="34" rx="13" ry="19" transform="rotate(-28 30 34)"/><ellipse class="ink" cx="30" cy="34" rx="13" ry="19" transform="rotate(-28 30 34)"/>' +
      '<ellipse class="paper" cx="72" cy="34" rx="13" ry="19" transform="rotate(28 72 34)"/><ellipse class="ink" cx="72" cy="34" rx="13" ry="19" transform="rotate(28 72 34)"/>' +
      '<ellipse class="bee" cx="51" cy="58" rx="31" ry="27"/>' +
      '<path class="fill-ink" d="M26 70q25 13 50 0l-3 6q-22 10-44 0z"/><path class="fill-ink" d="M32 80q19 9 38 0l-4 5q-15 6-30 0z"/>' +
      '<ellipse class="ink" cx="51" cy="58" rx="31" ry="27"/>' +
      '<circle class="rose" cx="34" cy="60" r="5"/><circle class="rose" cx="68" cy="60" r="5"/>' +
      eyes + mouth +
      '<path class="ink" d="M51 85v6"/>' +
      '</g></svg>';
  }

  window.BuzzArt = { scene: scene, mascot: mascot, sceneNames: Object.keys(SCENES), sceneName: sceneName };
})();
