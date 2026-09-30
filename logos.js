// Logos de cada entidad (íconos oficiales de sus apps en Google Play).
// Para agregar uno: el nombre tal cual aparece en tu hoja → la dirección de la imagen.
window.LOGOS = (function () {
  var P = 'https://play-lh.googleusercontent.com/';
  var L = {
    nequi: P + 'ieznb73N7P1gm49TTOYpQX23BAUlRVxiVnzy2_YJQSAkcfOkKOi9U-UQlvW5vCt1Exf2ljI-rn4Hc81xddqg5M8=s128',
    daviplata: P + 'bNPDiFqg28L6ckatfuP-WgrxDRDk0JEOkC6nUIQp7Q61RW78i1bw-ffMmEjyxl-qP6dv3ANDOQqmIbBtgJI3EA=s128',
    addi: P + '5Qf9j4iEBk0oLFA3HfR2UEu7ciowEeF9CA4N_-emk1VTmafE3f8EmBXP-ha0nHiIXDGwwvRCgXCK9TvyJMGLPZY=s128',
    nubank: P + 'FP6PILGwB6hrdvwg_mE8H1MKi2AcRDbHJcdg7WMfjiHbs4-ZZhYSMtgibkpeakstu1UeNHL4TGCo1l0mV2qkQa4=s128',
    davibank: P + 'MuPSLgt6NwvyLv-wFuXkXxXmrkaZufkzFd1nruNS7aiPQcQeMLQN5S7rMNR4Tv64ecTFT8sbDOpHhJC__qpatPU=s128',
    youtube: P + 'QNmuZQc9I6Zbe3mWnSr0hycnENqGFCI5p3yE29Hkxtf22T0IWS6zTrpxULLyyjWpB7ONAXDsDQXnXcVWokl3eg=s128',
    googleone: P + 'pnaxOl9i4YnkYKGMYkH17y_hA_FJOZRahlRGHQaaEGuLwPme68AfPShN2na5dEGOsem3hEzFvWXMz62WPVx8=s128',
    smartfit: P + 'yreG-gSxhCm1PDH6biQoIe-INRGOmQjbnIVsQThP6kv-Qbs7NZIXcBkwg3aoSx5xnQfH7Ky2Sz_PjLgKDlzY=s128',
    movistar: P + 'Hp05gIiG2qGoyyFKyxKnCA5fHmALq2Gp5L2dNYXtRXrDdiOw_4bZCJ9TgTqAjAuCrHWYLI3_wjLBHrejbX3u=s128',
    claude: P + 'YeFCFSW5LkBVdsEAL_fjzxDxTbhKz31j1uZUfDbSaCeM0t4Bi3SqyHTWzWsUsZnbwjofXhYajitG_gr2_B2xil8=s128',
    hevy: P + 'bLlRnwjt0tKva6ob0ZrtxkUs-z4MhQ4cPIOnXeh_knD8QVAXSLFiMGyKo2kLF7PV2uSK1Wly1L4q-6Sv1k13=s128',
    rappi: P + 'od9rcMwok9kSOE1nFhLFKyG1daEuexpf5Rpox1VrFnWxI_fNnjC_CtP-eKC2OkgkcOTPPics_q31ssn_OLyk=s128',
    credifin: 'https://www.google.com/s2/favicons?sz=128&domain=credifin.com.co',
    terpel: P + '7QCowhje4Qmu4cM5lKw5T95Q_Wv3_Bm2SShhehki_S80NzOe103LY3-F-wrV2iJC3B0cLgePraT6oq-HbyKPKA=s128',
    jumbo: P + 'gJGDzHGgk33fW5cB--voYZQe3TDrOfMLq8bCFwxtdzNJGcELJzzYse6LEZK6Q1Ste8d0nCoqm7K2H55631FW=s128',
    metro: P + 'CbEXV98Ine68253x3Mo8Nq9Ho7_8FucUT6NZJvUf6F93ETKoBSuGLhspRIwT0oUHHK0VQJPjEyEmMdox_rtpfw=s128',
    exito: P + 'NZwOq9-pul-gVF0e9e0xcrt6OXAcJ5_Ur_rRszxkbsRxFWjdXIy5oXhiJ3HKeyQ9_TLhZK1HDQi7YpZZsTI1JA=s128',
    carulla: P + 'BAdVJ9RIIw3jscuSVf5VyEgKFSiOW6UUl5-HdUcPDoRxAF1GIqNpI4-t1XT1FheGWKWOUOMyJ1nkskSRjABA=s128',
    d1: P + 'PSeD3fbDcUs8J0gcbnwoY6-juhMYkN6Bo4h-rF89dtUXfjd0_8PwIApW7oPd2uBjzI56sVD1hBDWkxC5iiIb=s128',
    ara: P + 'sfKdZPGvpQF5bWF1CYQNWxw38nL9-pbLOX3AGV1eOGaOObvSupz3ws1cX2tT8NPZLf2JiCEAA_LAg7lEjuhr=s128'
  };
  // Comercios donde compras seguido: se reconocen por palabras en la descripción del movimiento.
  // Los que no tienen ícono oficial disponible se muestran con sus iniciales y colores de marca.
  window.COMERCIOS = [
    { p: /\b(terpel|eds)\b/, img: L.terpel, txt: 'TE', cat: 'Gasolina' },
    { p: /\bjumbo\b/, img: L.jumbo, txt: 'JU' },
    { p: /\bmetro\b/, img: L.metro, txt: 'ME' },
    { p: /\bexito\b/, img: L.exito, txt: 'ÉX' },
    { p: /\bcarulla\b/, img: L.carulla, txt: 'CA' },
    { p: /\bd1\b/, img: L.d1, txt: 'D1' },
    { p: /\bara\b/, img: L.ara, txt: 'AR' },
    { p: /\bisimo\b/, img: 'logos/isimo.png', txt: 'IS' },
    { p: /\bmakro\b/, img: 'logos/makro.png', txt: 'MK' },
    { p: /\bdollar ?city\b/, img: 'logos/dollarcity.png', txt: 'DC' },
    { p: /\btemu\b/, img: P + 'opNFHpwXUxk8zAVzQbvBgEcBPmgYt0uX-p28VKDZ8nJNFPA7_JHx3PO3ski-GW_FW7gf3jrEP4OCKxTpP7Wv_w=s128', txt: 'TE' },
    { p: /\bshein\b/, img: P + 'M_c3ZcQ1dx3AlDSfFEL0S2KgYrmkvJz2gz6gMZaL0pSQS9yYfUOGAQJTfuXMvx0K5c46dh5TKauxuRbUlnxB7w=s128', txt: 'SH' },
    { p: /\bmercado ?libre\b/, img: P + 'iVaeA0HDw8CZjEM-K7GdLB9XYmpcwVFSuv4Q8o9uh4Br7PuKCm3QSYCVU73tr9BBXdR_7xTX4yO0azOJegRVcA=s128', txt: 'ML' },
    { p: /\bamazon\b/, img: P + 'UIYZ9hTFNg-zZUg_uzLS9YdyDpvoo1VHNFb6VlzHy5JqNMq9Uq-p2S1VPwzXCipHTFacfGKhJkyAuKL19VVlcWA=s128', txt: 'AM' },
    { p: /\bali ?express\b/, img: P + 'VtiM0TOwAT4osyMK4Lm1duvGCBF-9y87pa2anqQfLBLc8modr2i-Pmin2uJHp4I14rIky_NLFCOC06dCPyZ1Cw=s128', txt: 'AE' },
    { p: /\brappi/, img: L.rappi, txt: 'RA' },
    { p: /\b(claude|anthropic)\b/, img: L.claude, txt: 'CL' },
    { p: /\byoutube\b/, img: L.youtube, txt: 'YT' },
    { p: /\bgoogle one\b/, img: L.googleone, txt: 'G1' },
    { p: /\bsmart ?fit\b/, img: L.smartfit, txt: 'SF' },
    { p: /\bmovistar\b/, img: L.movistar, txt: 'MO' },
    { p: /\bhevy\b/, img: L.hevy, txt: 'HV' }
  ];
  return {
    'Nequi': L.nequi,
    'Daviplata': L.daviplata,
    'Bolsillo Daviplata TC Davibank': L.daviplata,
    'Addi': L.addi,
    'TC Nubank': L.nubank,
    'TC Davibank': L.davibank,
    'Credifin': L.credifin,
    'YouTube Premium': L.youtube,
    'Google One': L.googleone,
    'Smart Fit': L.smartfit,
    'Movistar Total': L.movistar,
    'Plan móvil mamá': L.movistar,
    'Claude': L.claude,
    'Hevy': L.hevy,
    'RappiPro': L.rappi,
    'Cuota de manejo Nubank': L.nubank,
    'Seguro de vida Davibank': L.davibank
  };
})();
