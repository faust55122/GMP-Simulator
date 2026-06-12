// ============================================================
//  GMP QUALIFICATION SIMULATOR — game.js
//
//  Changes vs. previous version:
//  1. FAT and SAT are mutually exclusive AND phase-gated:
//     - FAT is available during phases 0-2 (up to & incl. FAT phase).
//     - SAT is available from phase 3 onward (IQ and later).
//     - Once FAT has been used this game, SAT unlocks (and vice versa
//       is irrelevant because SAT comes after FAT by definition).
//  2. Undo mechanic: project actions that were taken THIS turn can be
//     undone (AP refunded, KPI changes reversed) until "Runde beenden"
//     is clicked.  Personal-development actions (learning queue) can
//     also be recalled from the queue before the round ends.
// ============================================================

// ============================================================
//  DATA
// ============================================================

const PHASES = ["URS & Planung","DQ","FAT","IQ","OQ","PQ","Freigabe"];
// Each entry = minimum progress % to enter that phase index
const PHASE_PROGRESS = [0, 15, 30, 50, 65, 80, 100];

const KPI_DEFS = [
  { key:'wissen',    name:'Equipment-Wissen',  color:'var(--blue)'   },
  { key:'gmp',       name:'GMP-Wissen',         color:'var(--teal)'   },
  { key:'vertrauen', name:'Quality-Vertrauen',  color:'var(--green)'  },
  { key:'risiko',    name:'Risikostatus',        color:'var(--orange)', invert:true },
  { key:'budget',    name:'Budget',              color:'var(--amber)'  },
  { key:'zeit',      name:'Zeitplan',            color:'var(--blue)'   },
  { key:'motivation',name:'Team-Motivation',    color:'var(--teal)'   },
];

const SKILL_DEFS = [
  { key:'gmpKnow',  name:'GMP-Wissen',              desc:'Audit, Compliance, Dokumentation'  },
  { key:'tech',     name:'Technisches Verständnis',  desc:'Fehlersuche, Risikoanalyse'         },
  { key:'aseptik',  name:'Aseptik Know-How',         desc:'Pflicht >60 % nach FAT-Abschluss'  },
  { key:'pm',       name:'Projektmanagement',        desc:'Aktionseffizienz, Zeitplan'         },
  { key:'komm',     name:'Kommunikation',            desc:'Quality-Abstimmung, Lieferant'      },
];

// availableFrom: minimum phase index for the action to appear.
// availableUntil: maximum phase index (inclusive). undefined = always available.
// budgetCost: how many budget-% points this action consumes immediately (on top of AP).
const PROJECT_ACTIONS = [
  {
    id:'lieferant', name:'Lieferantenbewertung', cost:2,
    desc:'Erweiterte Bewertung durchführen',
    effects:{ wissen:8, vertrauen:5, risiko:-8 },
    text:'Wissen ↑  Vertrauen ↑  Risiko ↓',
    maxUses: 5,   // Lieferantenbewertung ist irgendwann erschöpft
  },
  {
    id:'intensivdoku', name:'Intensive Dokumentationserstellung', cost:4,
    desc:'Vollständige Qualifizierungsdokumentation erstellen',
    effects:{ vertrauen:5 },
    text:'Vertrauen ↑  Fortschritt ↑↑',
    minWeek: 6,
    progressBonus: 6,
  },
  {
    id:'riskana', name:'Risikoanalyse', cost:2,
    desc:'Systematische Bewertung',
    effects:{ gmp:8, risiko:-12, vertrauen:4, zeit:-3 },
    text:'GMP ↑  Risiko ↓↓  Zeitplan leicht ↓',
  },
  {
    id:'dokrev', name:'Dokumentenreview', cost:1,
    desc:'Sorgfältige Prüfung',
    effects:{ gmp:6, vertrauen:3 },
    text:'GMP-Wissen ↑  Vertrauen ↑',
  },
  {
    id:'doppel', name:'Doppelkontrolle', cost:2,
    desc:'Hohe Fehlerfinderchance',
    effects:{ gmp:7, risiko:-6, motivation:-5 },
    text:'GMP ↑  Risiko ↓  Motivation ↓  — mögliche Budget-Erhöhung nach Rundenende',
    budgetChance: true,   // 50 % Chance auf +4 % Budget — wird erst bei endTurn ausgewertet
  },
  {
    // FAT (phases 0–2) and SAT (phases 3+) merged into one slot that changes label/effects by phase.
    // The id switches dynamically in doProjectAction via isActionAvailable; we define both here
    // and the render picks the right one. We use id 'fatsat' as the unified slot.
    id:'fatsat', name:'FAT / SAT-Test',
    cost:2, budgetCost: 10,
    desc:'Werks- oder Vor-Ort-Abnahme',
    // effects are applied conditionally in doProjectAction based on current phase
    effects:{ wissen:10, motivation:8 },
    text:'Wissen ↑↑  Motivation ↑  (Budget ↓)',
    // always visible — label and hint change by phase, handled in render
  },
  {
    id:'schulung', name:'Bedienerschulung', cost:1,
    desc:'Team trainieren',
    effects:{ motivation:12, gmp:5, wissen:4 },
    text:'Motivation ↑↑  GMP ↑  Equipment-Wissen ↑',
  },
  {
    id:'meeting', name:'Abstimmungsmeeting', cost:1,
    desc:'Alle ins Boot holen',
    effects:{ vertrauen:7, motivation:4, zeit:-3 },
    text:'Vertrauen ↑  (Zeitplan etwas knapper)',
  },
  {
    // Externe Unterstützung: teuer, schadet Wissen + Vertrauen, hilft Zeitplan
    id:'extern', name:'Externe Projektunterstützung', cost:2, budgetCost: 18,
    desc:'Beraterfirma einschalten',
    effects:{ zeit:15, wissen:-10, vertrauen:-8 },
    text:'Zeitplan ↑↑  Wissen ↓  Vertrauen ↓  (Budget ↓↓)',
  },
  {
    id:'dival_audit_trail', name:'Audit Trail konfigurieren', cost:2, budgetCost: 7,
    desc:'Lückenlose digitale Nachverfolgung einrichten',
    effects:{ zeit:5, vertrauen:3 },
    text:'Zeitplan ↑  Vertrauen ↑  (Budget ↓)  — DIVAL',
    divalOnly: true, divalSlot: true,
  },
  {
    id:'dival_esign', name:'eSign-Workflow einrichten', cost:2, budgetCost: 6,
    desc:'Digitale Unterschriften für alle Protokolle',
    effects:{ zeit:5, vertrauen:3 },
    text:'Zeitplan ↑  Vertrauen ↑  (Budget ↓)  — DIVAL',
    divalOnly: true, divalSlot: true,
  },
  {
    id:'dival_server', name:'Validierungsserver aufsetzen', cost:2,
    desc:'GxP-konformen Server bereitstellen — intern',
    effects:{ zeit:5, vertrauen:3 },
    text:'Zeitplan ↑  Vertrauen ↑  — DIVAL',
    divalOnly: true, divalSlot: true,
  },
  {
    id:'dival_rechte', name:'Zugriffsrechte & Rollen klären', cost:1,
    desc:'IT-Berechtigungskonzept für alle Beteiligten',
    effects:{ zeit:5, vertrauen:3 },
    text:'Zeitplan ↑  Vertrauen ↑  — DIVAL',
    divalOnly: true, divalSlot: true,
  },
];

const PERSONAL_ACTIONS = [
  { id:'lgmp',    name:'GMP-Schulung',           cost:1,               desc:'Lernzeit investieren',        skill:'gmpKnow',  points:1, text:'GMP-Wissen steigt in einigen Wochen'        },
  { id:'lgmp3',   name:'GMP-Intensivkurs',        cost:3,               desc:'3 Tage Training',             skill:'gmpKnow',  points:3, text:'Schnelleres GMP-Wissen — dauert trotzdem'   },
  { id:'ltech',   name:'Equipment-Training',      cost:1,               desc:'Handbücher studieren',        skill:'tech',     points:1, text:'Technisches Verständnis wächst langsam'     },
  { id:'ltech2',  name:'Tech-Crash-Kurs',         cost:2,               desc:'Intensives Lernen',           skill:'tech',     points:2, text:'Beschleunigtes technisches Lernen'          },
  { id:'lelevate',name:'Projekt ELEVATE',          cost:1,               desc:'Aseptik-Kompetenz aufbauen', skill:'aseptik',  points:1, text:'Aseptik Know-How wächst — Pflicht nach FAT' },
  { id:'lelevate2',name:'ELEVATE Intensiv',        cost:2,               desc:'Vertieftes Aseptik-Training', skill:'aseptik', points:2, text:'Beschleunigtes Aseptik Know-How'            },
  { id:'lpm',     name:'PM-Seminar',              cost:2, budgetCost:8,  desc:'Externes PM-Training',        skill:'pm',       points:2, text:'Effizienz steigt bald  (Budget ↓)'         },
  { id:'lkomm',   name:'Kommunikationstraining',  cost:1,               desc:'Quality & Lieferant',         skill:'komm',     points:1, text:'Kommunikation wird besser'                  },
];

const EVENTS_BAD = [
  { msg:'⚙️ Die Automatisierung hat die Inmation-Schnittstelle vergessen.',         effects:{ risiko:10 }, progressPenalty:5, weekMax:4 },
  // Events die wahrscheinlicher werden wenn tech-Skill niedrig (werden in endTurn gefiltert)
  { msg:'🔩 Das Equipment verhält sich unerwartet. Niemand versteht warum.',        effects:{ wissen:-10, risiko:8, motivation:-5 }, techMalus:true },
  { msg:'📉 Messwerte weichen ab — technische Ursache unklar.',                     effects:{ wissen:-8, vertrauen:-8, risiko:10 }, techMalus:true },
  { msg:'🛠️ Ein Kalibrierfehler bleibt wochenlang unbemerkt.',                      effects:{ wissen:-12, gmp:-8, risiko:12 }, techMalus:true },
  { msg:'❓ Der Lieferant fragt nach Parametern, die niemand im Team kennt.',        effects:{ wissen:-8, vertrauen:-6, zeit:-5 }, techMalus:true },
  { msg:'📄 Der Lieferant hat Version 27 geschickt. Sie arbeiten mit Version 23.',              effects:{ gmp:-8,  zeit:-5              } },
  { msg:'🔍 Quality hat einen fehlenden Punkt auf Seite 183 gefunden.',                         effects:{ vertrauen:-10, gmp:-5         } },
  { msg:'💻 Im IQ-Protokoll steht plötzlich der Name einer anderen Maschine.',                  effects:{ gmp:-12, vertrauen:-8         } },
  { msg:'🎉 Der Lieferant demonstriert stolz eine Funktion, die nicht in der URS steht.',       effects:{ wissen:5, risiko:10           } },
  { msg:'✍️ Das Equipment funktioniert perfekt. Leider fehlt eine Unterschrift.',                effects:{ vertrauen:-12, zeit:-5        } },
  { msg:'🕵️ Ein Auditor fragt nach einem Dokument, das niemand jemals gesehen hat.',             effects:{ gmp:-10, vertrauen:-8, risiko:8 } },
  { msg:'📅 Es wird ein Meeting zur Vorbereitung des Vorbereitungsmeetings angesetzt.',          effects:{ zeit:-8, motivation:-5        } },
  { msg:'💾 Jemand speichert die Datei als FINAL_v7_NEU_WIRKLICH_FINAL.docx',                  effects:{ gmp:-6,  motivation:-4        } },
  { msg:'📬 Der Lieferant antwortet nach 14 Tagen: „Können Sie die Frage bitte präzisieren?"', effects:{ zeit:-10, risiko:6            } },
  { msg:'🔧 Während der Qualifizierung wird ein neues Ventil eingebaut. Change eröffnet.',      effects:{ risiko:15, zeit:-12, gmp:-5   } },
  { msg:'🖨️ Die Dokumentation ist fertig. Der GMP-Drucker hat andere Pläne.',                   effects:{ zeit:-5, motivation:-6 }, noDival:true },
  { msg:'✨ Quality findet ein Risiko, das in drei Risikoanalysen übersehen wurde.',             effects:{ gmp:-8, vertrauen:-10, risiko:10 } },
  // DIVAL-spezifische Events — nur wenn divalActive
  { msg:'💻 Regulatory akzeptiert das digitale Format nicht. Rückfragen häufen sich.',          effects:{ vertrauen:-12, gmp:-6, zeit:-5 }, divalOnly:true },
  { msg:'🖥️ Der Validierungsserver ist ausgefallen. IT verspricht: „bis Freitag".',              effects:{ zeit:-10, motivation:-8, risiko:8 }, divalOnly:true },
  { msg:'🔐 Zugriffsrechte für eSign wurden falsch konfiguriert. Alle Signaturen ungültig.',    effects:{ gmp:-10, vertrauen:-10, zeit:-8 }, divalOnly:true },
  { msg:'📋 Das papierlose Konzept scheitert am Auditor: „Ich möchte das ausgedruckt sehen."', effects:{ vertrauen:-8, motivation:-6 }, divalOnly:true },
];

const EVENTS_GOOD = [
  { msg:'👴 Ein erfahrener Kollege hilft spontan mit seiner Expertise.',          effects:{ wissen:10, gmp:8                         } },
  { msg:'🏆 Die FAT läuft perfekt — der Lieferant ist sichtlich stolz.',          effects:{ wissen:12, vertrauen:10 }, phaseMin:2 },
  { msg:'⚡ Der Lieferant antwortet sofort! Alle sind verwundert.',                effects:{ zeit:8                                   } },
  { msg:'🎖️ Quality lobt ausdrücklich die Dokumentation. Es ist still im Raum.',  effects:{ motivation:10, vertrauen:12              } },
  { msg:'☕ Das Team findet einen Denkfehler in der Spezifikation — rechtzeitig.', effects:{ risiko:-15, gmp:5                        } },
  { msg:'📋 Die Qualifizierungsstrategie überzeugt — Meilenstein freigegeben.',   effects:{ vertrauen:8, gmp:6 }, progressBonus: 5   },
  { msg:'🤝 Lieferant liefert vollständige Testdokumentation — ungeplant aber willkommen.', effects:{ gmp:10, wissen:8 }, progressBonus: 4 },
  { msg:'🚀 Das Team zieht an einem Strang — ungewöhnlich produktive Woche.',     effects:{ motivation:8, gmp:6  }, progressBonus: 6  },
  { msg:'💰 Unerwartete Budgetfreigabe durch das Management — der CFO hatte einen guten Tag.', effects:{ budget:15, motivation:6 }, rare:true },
];

const LEARNING_MSGS = [
  'Du arbeitest dich durch einen GMP-Leitfaden.',
  'Schulung läuft — Wirkung kommt bald.',
  'Dein Verständnis für Risikoanalysen verbessert sich.',
  'Das Training war überraschend hilfreich.',
  'Praxisübung im Reinraum läuft.',
];

// Skill-spezifische Lernmeldungen — überschreiben den allgemeinen Pool wenn vorhanden
const LEARNING_MSGS_BY_SKILL = {
  aseptik: [
    'Aseptik-Training im Reinraum läuft.',
    'Projekt ELEVATE: Sterilisationskonzepte werden vertieft.',
    'Keimfreies Arbeiten will gelernt sein.',
    'Partikelzählung und Umgebungsmonitoring — endlich macht es Sinn.',
  ],
  gmpKnow: [
    'Du arbeitest dich durch einen GMP-Leitfaden.',
    'Annex 1 Revision — spannender als gedacht.',
    'GMP-Grundlagen werden gefestigt.',
  ],
  tech: [
    'Equipment-Handbücher werden durchgearbeitet.',
    'Technisches Verständnis wächst Seite für Seite.',
    'FAT-Checklisten werden vorbereitet.',
  ],
  pm: [
    'PM-Seminar läuft — Gantt-Charts überall.',
    'Projektplanungs-Workshop in vollem Gange.',
  ],
  komm: [
    'Kommunikationstraining mit Quality-Rollenspielen.',
    'Lieferantengespräche werden simuliert.',
  ],
};

// ============================================================
//  GAME STATE
// ============================================================

let state = {};

function initGame() {
  state = {
    week:       1,
    maxWeeks:   20,
    ap:         4,
    maxAp:      4,
    apThisRound: 4,   // eingefroren für die laufende Runde — ändert sich erst bei endTurn()
    phase:      0,
    progress:   0,
    kpis: {
      wissen: 40, gmp: 50, vertrauen: 40,
      risiko: 30, budget: 45 + Math.floor(Math.random() * 16), zeit: 80, motivation: 50,
    },
    skills: { gmpKnow: 10, tech: 10, aseptik: 10, pm: 10, komm: 10 },

    // Learning queue: { skill, points, rounds, queueId }
    learning: [],
    nextQueueId: 0,

    // Undo history for THIS turn only — cleared on endTurn()
    // Each entry: { type:'project'|'personal', actionId, apSpent, kpiSnapshot, queueId? }
    turnHistory: [],

    // Track which project action ids have been used at least once (ever)
    usedActions: [],          // Array statt Set — serialisierbar
    actionCount: {},

    activeTab:  'project',
    lastEvent:  null,
    gameOver:   false,
    lilTriggered: false,
    learningMsgs: {},
    divalOffered:  false,
    divalActive:   false,
    divalDeclined: false,
    divalDone:     false,
    divalSlotOffset: 0,
    divalUsed: [],            // Array statt Set
    usedEventMsgs: [],        // Array statt Set
    pendingBudgetChance: false,
  };
  render();
}

// ============================================================
//  HELPERS
// ============================================================

function clamp(v, mn = 0, mx = 100) { return Math.max(mn, Math.min(mx, v)); }

function skillBonus(sk) { return Math.round((state.skills[sk] / 100) * 10); }

function apForThisRound() {
  const pm         = state.skills.pm / 100;
  const motivBonus = state.kpis.motivation >= 70 ? 1 : 0;
  const phaseBonus = (state.phase > 0 && state.phase % 2 === 0) ? 1 : 0;
  return Math.min(9, state.maxAp + Math.round(pm * 2) + motivBonus + phaseBonus);
}
function applyEffects(effects) {
  for (const [k, v] of Object.entries(effects)) {
    if (!(k in state.kpis)) continue;
    let bonus = 0;
    if (v > 0) {
      if (k === 'gmp')       bonus = skillBonus('gmpKnow');
      if (k === 'wissen')    bonus = skillBonus('tech');
      if (k === 'vertrauen') bonus = skillBonus('komm');
    }
    state.kpis[k] = clamp(state.kpis[k] + v + (v > 0 ? bonus : 0));
  }
}

function reverseEffects(effects) {
  // Invertiert applyEffects exakt — kein Snapshot nötig
  for (const [k, v] of Object.entries(effects)) {
    if (!(k in state.kpis)) continue;
    let bonus = 0;
    if (v > 0) {
      if (k === 'gmp')       bonus = skillBonus('gmpKnow');
      if (k === 'wissen')    bonus = skillBonus('tech');
      if (k === 'vertrauen') bonus = skillBonus('komm');
    }
    state.kpis[k] = clamp(state.kpis[k] - v - (v > 0 ? bonus : 0));
  }
}

function updatePhase() {
  let newPhase = 0;
  for (let i = 0; i < PHASE_PROGRESS.length; i++) {
    if (state.progress >= PHASE_PROGRESS[i]) newPhase = i;
  }
  state.phase = Math.min(newPhase, 6);
}

// ── Set-Ersatz: Arrays mit Hilfsfunktionen ─────────────────────────────────
function hasUsed(arr, val)  { return arr.includes(val); }
function markUsed(arr, val) { if (!arr.includes(val)) arr.push(val); }
function unmark(arr, val)   { const i = arr.indexOf(val); if (i !== -1) arr.splice(i, 1); }

// ============================================================
//  ACTION AVAILABILITY
// ============================================================

function isActionAvailable(a) {
  if (a.availableFrom  !== undefined && state.phase < a.availableFrom)  return false;
  if (a.availableUntil !== undefined && state.phase > a.availableUntil) return false;
  if (a.maxUses  !== undefined && (state.actionCount[a.id] || 0) >= a.maxUses) return false;
  if (a.minWeek  !== undefined && state.week < a.minWeek) return false;
  if (a.divalOnly && !state.divalActive) return false;
  if (a.id === 'fatsat' && state.phase > 2) return false;
  return true;
}

function progressGainFor(a) {
  const aseptikBlocked = state.phase >= 3 && state.skills.aseptik < 60;
  if (aseptikBlocked) return 0;
  const avg = (state.skills.gmpKnow + state.skills.tech + state.skills.aseptik) / 3;
  const factor = 0.4 + (avg / 100) * 0.6;
  return Math.round(a.cost * 1.5 * factor) + (a.progressBonus || 0);
}

// ============================================================
//  PROJECT ACTIONS
// ============================================================

function doProjectAction(id) {
  if (state.gameOver) return;
  const a = PROJECT_ACTIONS.find(x => x.id === id);
  if (!a || state.ap < a.cost || !isActionAvailable(a)) return;

  const bCost = a.budgetCost || 0;
  if (state.kpis.budget - bCost < 0) return;

  // Berechne Fortschrittsgewinn VOR Zustandsänderung
  const gain = progressGainFor(a);

  // Zustand ändern
  state.ap -= a.cost;
  applyEffects(a.effects);
  if (bCost > 0) state.kpis.budget = Math.max(0, state.kpis.budget - bCost);
  if (a.budgetChance) state.pendingBudgetChance = true;
  state.progress = clamp(state.progress + gain);
  updatePhase();
  state.actionCount[a.id] = (state.actionCount[a.id] || 0) + 1;
  markUsed(state.usedActions, a.id);
  if (a.divalSlot) {
    markUsed(state.divalUsed, a.id);
    rotateDivalSlotIfNeeded();
  }

  // History-Eintrag speichert nur was nötig ist für präzises Undo
  state.turnHistory.push({
    type:        'project',
    actionId:    id,
    apSpent:     a.cost,
    budgetSpent: bCost,
    progressGain: gain,
    hadBudgetChance: !!a.budgetChance,
    wasDivalSlot:    !!a.divalSlot,
  });

  if (state.kpis.budget <= 0) { showEndScreen(false); return; }
  render();
}

function undoProjectAction(historyIndex) {
  if (state.gameOver) return;
  const entry = state.turnHistory[historyIndex];
  if (!entry || entry.type !== 'project') return;
  const a = PROJECT_ACTIONS.find(x => x.id === entry.actionId);
  if (!a) return;

  // Effekte exakt invertieren
  reverseEffects(a.effects);
  // Budget zurück
  state.kpis.budget = clamp(state.kpis.budget + entry.budgetSpent);
  // AP zurück
  state.ap += entry.apSpent;
  // Fortschritt zurück
  state.progress = clamp(state.progress - entry.progressGain);
  updatePhase();
  // pending-Flag zurück wenn keine weitere budgetChance-Aktion in History
  if (entry.hadBudgetChance) {
    const stillPending = state.turnHistory.some((e, i) => i !== historyIndex && e.hadBudgetChance);
    if (!stillPending) state.pendingBudgetChance = false;
  }
  // DIVAL-Slot zurück
  if (entry.wasDivalSlot) {
    unmark(state.divalUsed, entry.actionId);
    rotateDivalSlotIfNeeded();
  }
  // actionCount dekrementieren
  if ((state.actionCount[entry.actionId] || 0) > 0) state.actionCount[entry.actionId]--;
  // usedActions bereinigen wenn keine weitere Nutzung in History
  const otherUse = state.turnHistory.some((e, i) => i !== historyIndex && e.actionId === entry.actionId);
  if (!otherUse) unmark(state.usedActions, entry.actionId);

  state.turnHistory.splice(historyIndex, 1);
  render();
}

function rotateDivalSlotIfNeeded() {
  const slots      = PROJECT_ACTIONS.filter(x => x.divalSlot);
  const visibleIds = slots.slice(state.divalSlotOffset, state.divalSlotOffset + 2).map(x => x.id);
  if (visibleIds.every(id => hasUsed(state.divalUsed, id))) {
    state.divalSlotOffset = state.divalSlotOffset === 0 ? 2 : 0;
  }
}

// ============================================================
//  PERSONAL ACTIONS
// ============================================================

function doPersonalAction(id) {
  if (state.gameOver) return;
  const a = PERSONAL_ACTIONS.find(x => x.id === id);
  if (!a || state.ap < a.cost) return;

  const bCost = a.budgetCost || 0;
  if (state.kpis.budget - bCost < 0) return;

  state.ap -= a.cost;
  if (bCost > 0) state.kpis.budget = Math.max(0, state.kpis.budget - bCost);

  const totalGain = a.points * 15;
  const duration  = a.points >= 4 ? 2 + Math.floor(Math.random() * 3)
                  : a.points >= 3 ? 3 + Math.floor(Math.random() * 3)
                  : a.points >= 2 ? 4 + Math.floor(Math.random() * 3)
                                  : 5 + Math.floor(Math.random() * 3);

  const queueId = state.nextQueueId++;
  state.learning.push({
    skill: a.skill, gainPerRound: totalGain / duration,
    totalGain, gained: 0, rounds: duration, queueId,
  });

  if (!state.learningMsgs[a.skill]) {
    const pool = LEARNING_MSGS_BY_SKILL[a.skill] || LEARNING_MSGS;
    state.learningMsgs[a.skill] = pool[Math.floor(Math.random() * pool.length)];
  }

  state.turnHistory.push({ type: 'personal', actionId: id, apSpent: a.cost, budgetSpent: bCost, queueId });
  render();
}

function undoPersonalAction(historyIndex) {
  if (state.gameOver) return;
  const entry = state.turnHistory[historyIndex];
  if (!entry || entry.type !== 'personal') return;
  const a = PERSONAL_ACTIONS.find(x => x.id === entry.actionId);

  state.learning = state.learning.filter(l => l.queueId !== entry.queueId);
  if (a && !state.learning.some(l => l.skill === a.skill)) delete state.learningMsgs[a.skill];
  state.ap += entry.apSpent;
  if ((entry.budgetSpent || 0) > 0) state.kpis.budget = clamp(state.kpis.budget + entry.budgetSpent);

  state.turnHistory.splice(historyIndex, 1);
  render();
}

function switchTab(t) { state.activeTab = t; render(); }

// ============================================================
//  END TURN — klare Phasenstruktur
// ============================================================

function endTurn() {
  if (state.gameOver) return;
  _commitTurn();
  if (_isFreigabePhase()) { _resolveFreigabe(); return; }
  _advanceWeek();
  _processLearning();
  _applyPassiveDecay();
  _rollRandomEvent();
  _replenishAP();
  _checkSpecialTriggers();
  if (_checkLoseConditions()) return;
  if (_checkWinConditions()) return;
  render();
}

function _commitTurn() {
  state.turnHistory = [];
  // Doppelkontrolle Budget-Chance jetzt auswerten
  state._budgetBonusThisTurn = false;
  if (state.pendingBudgetChance) {
    state.pendingBudgetChance = false;
    if (Math.random() < 0.5) {
      state.kpis.budget = clamp(state.kpis.budget + 4);
      state._budgetBonusThisTurn = true;
    }
  }
  // Lernmeldungen für neue Runde würfeln
  state.learningMsgs = {};
  state.learning.forEach(l => {
    if (!state.learningMsgs[l.skill]) {
      const pool = LEARNING_MSGS_BY_SKILL[l.skill] || LEARNING_MSGS;
      state.learningMsgs[l.skill] = pool[Math.floor(Math.random() * pool.length)];
    }
  });
  // Budget-Bonus als Event anzeigen — wird von rollRandomEvent überschrieben wenn ein echtes Event folgt
  if (state._budgetBonusThisTurn) {
    state.lastEvent = {
      msg: '✅ Doppelkontrolle erfolgreich: Fehler gefunden und behoben — Budget-Einsparung 4 %.',
      effects: { budget: 4 }, type: 'good',
    };
  }
}

function _isFreigabePhase() { return state.phase >= 6; }

function _resolveFreigabe() {
  state.apThisRound = apForThisRound();
  state.ap = state.apThisRound;
  if (state.divalActive && !state.divalDone) {
    state.divalDone = true;
    const techOk = state.skills.tech >= 60;
    state.divalResult = (techOk && Math.random() < 0.4) ? 'success' : (techOk ? 'fail' : 'fail_tech');
  }
  if (state.skills.aseptik < 60) showEndScreen(false, 'aseptik');
  else showEndScreen(true);
}

function _advanceWeek() {
  state.week++;
}

function _processLearning() {
  state.learning = state.learning.filter(l => {
    const grant = Math.min(l.gainPerRound, l.totalGain - l.gained);
    l.gained += grant;
    state.skills[l.skill] = clamp(state.skills[l.skill] + grant);
    l.rounds--;
    return l.rounds > 0 && l.gained < l.totalGain;
  });
}

function _applyPassiveDecay() {
  // Feste Abzüge pro Runde
  state.kpis.motivation = clamp(state.kpis.motivation - 2);
  state.kpis.budget     = clamp(state.kpis.budget - 1);
  state.kpis.zeit       = clamp(state.kpis.zeit - 2);
  // PM > 55 %: stiller Budget-Bonus +1 % (kompensiert teilweise den Decay)
  if (state.skills.pm > 55) state.kpis.budget = clamp(state.kpis.budget + 1);
  // Skill-basierte Abzüge (kumulativ)
  if (state.skills.gmpKnow >= 10 && state.skills.gmpKnow <= 40) {
    state.kpis.gmp       = clamp(state.kpis.gmp - 7);
    state.kpis.vertrauen = clamp(state.kpis.vertrauen - 5);
  }
  if (state.skills.komm >= 10 && state.skills.komm <= 50) {
    state.kpis.zeit       = clamp(state.kpis.zeit - 3);
    state.kpis.motivation = clamp(state.kpis.motivation - 2);
  }
  if (state.skills.tech < 50) {
    state.kpis.risiko = clamp(state.kpis.risiko + 3);
    state.kpis.wissen = clamp(state.kpis.wissen - 2);
  }
  if (state.skills.aseptik < 45) {
    state.kpis.vertrauen = clamp(state.kpis.vertrauen - 3);
    state.kpis.risiko    = clamp(state.kpis.risiko + 2);
  }
}

function _rollRandomEvent() {
  // Auto-progress
  let auto = 0;
  const avg = (state.skills.gmpKnow + state.skills.tech + state.skills.aseptik) / 3;
  const aseptikBlocked = state.phase >= 3 && state.skills.aseptik < 60;
  if (!aseptikBlocked) {
    if (avg >= 25) {
      if (state.kpis.gmp > 60)    auto += 0.5 + (avg / 200);
      if (state.kpis.wissen > 60) auto += 0.5 + (avg / 200);
    }
    auto += (Math.random() * 2 - 1);
  }
  state.progress = clamp(state.progress + Math.round(auto));
  updatePhase();

  // Event würfeln
  const roll         = Math.random();
  const riskFactor   = state.kpis.risiko / 100;
  const trustFactor  = state.kpis.vertrauen / 100;
  const kommMalus    = (1 - state.skills.komm / 100) * 0.25;
  const badThreshold = state.week <= 3 ? 0 : 0.15 + riskFactor * 0.15 + kommMalus;
  const goodThreshold = 1 - (0.15 + trustFactor * 0.10);

  if (roll < badThreshold) {
    const eligible = EVENTS_BAD.filter(e =>
      (!e.weekMax   || state.week <= e.weekMax) &&
      (!e.divalOnly || state.divalActive) &&
      (!e.noDival   || !state.divalActive) &&
      !hasUsed(state.usedEventMsgs, e.msg)
    );
    const pool = eligible.length > 0
      ? eligible
      : EVENTS_BAD.filter(e => !e.divalOnly || state.divalActive);
    const techWeak = state.skills.tech < 40 || state.kpis.wissen < 40;
    const weighted = [];
    pool.forEach(e => { weighted.push(e); if (e.techMalus && techWeak) weighted.push(e); });
    const ev = weighted[Math.floor(Math.random() * weighted.length)];
    markUsed(state.usedEventMsgs, ev.msg);
    state.lastEvent = { ...ev, type: 'bad' };
    const mitigated = {};
    for (const [k, v] of Object.entries(ev.effects)) {
      mitigated[k] = v > 0 ? v : Math.round(v * (1 - state.skills.gmpKnow / 200));
    }
    applyEffects(mitigated);
    if (ev.progressPenalty) { state.progress = clamp(state.progress - ev.progressPenalty); updatePhase(); }

  } else if (roll > goodThreshold) {
    const eligible = EVENTS_GOOD.filter(e =>
      (!e.phaseMin || state.phase >= e.phaseMin) &&
      !hasUsed(state.usedEventMsgs, e.msg)
    );
    const base = eligible.length > 0
      ? eligible
      : EVENTS_GOOD.filter(e => !e.phaseMin || state.phase >= e.phaseMin);
    const pool = Math.random() < 0.12
      ? (base.filter(e => e.rare).length > 0 ? base.filter(e => e.rare) : base.filter(e => !e.rare))
      : base.filter(e => !e.rare);
    const safe = pool.length > 0 ? pool : base.filter(e => !e.rare);
    const ev = safe[Math.floor(Math.random() * safe.length)];
    markUsed(state.usedEventMsgs, ev.msg);
    state.lastEvent = { ...ev, type: 'good' };
    applyEffects(ev.effects);
    if (ev.progressBonus) { state.progress = clamp(state.progress + ev.progressBonus); updatePhase(); }

  } else if (!state._budgetBonusThisTurn) {
    state.lastEvent = null;
  }
}

function _replenishAP() {
  state.apThisRound = apForThisRound();
  state.ap = state.apThisRound;
}

function _checkSpecialTriggers() {
  // DIVAL-Angebot
  if (!state.divalOffered && !state.divalDeclined && state.phase >= 3) {
    state.divalOffered = true;
    showDivalOffer();
    return; // pausiert bis Entscheidung
  }
  // DIVAL-Slot-Rotation nach Rundenende
  if (state.divalActive) rotateDivalSlotIfNeeded();
  // LiL-Ereignis
  if (!state.lilTriggered && state.week >= 6 && state.week <= 10 && Math.random() < 0.4) {
    state.lilTriggered = true;
    const lil = {
      msg: '🏥 Die LiL benötigt dringend Unterstützung — Ressourcen werden abgezogen.',
      effects: { risiko: 15 }, progressPenalty: 15, type: 'bad', isLil: true,
    };
    state.lastEvent = lil;
    applyEffects(lil.effects);
    state.progress = clamp(state.progress - lil.progressPenalty);
    updatePhase();
  }
}

function _checkLoseConditions() {
  const kpiLose = ['vertrauen','gmp','budget','zeit','motivation','wissen'].some(k => state.kpis[k] <= 0);
  if (kpiLose || state.week > state.maxWeeks) { showEndScreen(false); return true; }
  return false;
}

function _checkWinConditions() {
  if (state.phase >= 6) {
    if (state.divalActive && !state.divalDone) {
      state.divalDone = true;
      const techOk = state.skills.tech >= 60;
      state.divalResult = (techOk && Math.random() < 0.4) ? 'success' : (techOk ? 'fail' : 'fail_tech');
    }
    if (state.skills.aseptik < 60) showEndScreen(false, 'aseptik');
    else showEndScreen(true);
    return true;
  }
  return false;
}

// ============================================================
//  END SCREEN
// ============================================================

function showEndScreen(win, reason) {
  state.gameOver = true;
  const ov   = document.getElementById('overlay');
  const mt   = document.getElementById('modal-title');
  const mb   = document.getElementById('modal-body');
  const mbtn = document.getElementById('modal-btn');
  ov.style.display = 'flex';

  if (win) {
    // Score: alle KPIs gewichtet + Skill-Bonus + Zeiteffizienz
    const kpiScore =
      state.kpis.vertrauen  * 0.25 +
      state.kpis.gmp        * 0.20 +
      state.kpis.wissen     * 0.15 +
      state.kpis.motivation * 0.10 +
      state.kpis.budget     * 0.15 +
      state.kpis.zeit       * 0.15;
    const skillScore  = (state.skills.gmpKnow + state.skills.aseptik + state.skills.tech + state.skills.komm) / 4;
    // Je weniger Wochen benötigt, desto mehr Punkte (max 20 Wochen → 0 Bonus, min 1 Woche → 95 Bonus)
    const weekScore   = Math.max(0, (state.maxWeeks - state.week) * 5);
    const divalBonus  = (state.divalResult === 'success') ? 150 : 0;
    const rawScore    = kpiScore * 5 + skillScore * 2 + weekScore + divalBonus;
    const finalScore  = Math.min(1000, Math.round(rawScore));

    let divalText = '';
    if (state.divalActive) {
      if (state.divalResult === 'success')
        divalText = '\n\n🚀 DIVAL erfolgreich: Papierlose Qualifizierung akzeptiert! +150 Punkte Bonus.';
      else if (state.divalResult === 'fail_tech')
        divalText = '\n\n❌ DIVAL gescheitert: Das technische Verständnis war zu gering für eine digitale Qualifizierung. Mindestens 60 % wären nötig gewesen.';
      else
        divalText = '\n\n❌ DIVAL gescheitert: Regulatory hat das digitale Format abgelehnt. IT war auch nicht hilfreich.';
    }
    const scoreText = `\n\n📊 Abschlusspunktzahl: ${finalScore} / 1000 Punkte${divalText}`;

    const score = kpiScore; // gewichteter KPI-Wert 0–100
    if (score >= 75) {
      mt.className  = 'win-legend';
      mt.textContent = '🏆 Legendäre Qualifizierung!';
      mb.textContent = 'Quality genehmigt sofort. Selbst der Auditor wirkt beeindruckt. Sie werden zur hausinternen Legende. Das Protokoll wird gerahmt.' + scoreText;
    } else if (score >= 60) {
      mt.className  = 'win-legend';
      mt.textContent = '✅ Erfolgreiche Freigabe';
      mb.textContent = 'Normale Freigabe erteilt. Die Dokumentation ist akzeptabel. Niemand fragt warum. Das Equipment läuft. Die Kaffeemaschine auch.' + scoreText;
    } else if (score >= 40) {
      mt.className  = 'warn-legend';
      mt.textContent = '⚠️ Freigabe mit Auflagen';
      mb.textContent = 'Einige Nacharbeiten erforderlich. Quality hat 7 Punkte. Sie lösen die Hälfte davon in 3 Runden. Die andere Hälfte „eskaliert".' + scoreText;
    } else {
      mt.className  = 'warn-legend';
      mt.textContent = '🔄 Nachqualifizierung';
      mb.textContent = 'Weitere Maßnahmen notwendig. Ein neuer Change-Control wird eröffnet. Ihr Kalender weint.' + scoreText;
    }
    mbtn.className = 'modal-btn';
  } else {
    mt.className  = 'lose-legend';
    mt.textContent = '☠️ Totaler GMP-GAU';
    if (reason === 'aseptik')
      mb.textContent = `Aseptik Know-How bei nur ${Math.round(state.skills.aseptik)} % — Quality verweigert die Freigabe. Ohne ausreichende Aseptik-Kompetenz (mind. 60 %) ist keine Qualifizierung möglich. Projekt ELEVATE war Ihre letzte Chance.`;
    else if (state.kpis.budget <= 0)
      mb.textContent = 'Das Budget ist überschritten. Der CFO betritt den Raum. Niemand macht Augenkontakt. Das Equipment steht im Korridor — unbezahlt.';
    else if (state.kpis.vertrauen <= 0)
      mb.textContent = 'Quality hat das Vertrauen vollständig verloren. Bitte beginnen Sie erneut mit einer aktualisierten Version der Dokumentation — und Ihrer Karriere.';
    else if (state.kpis.gmp <= 0)
      mb.textContent = 'Das GMP-Wissen ist kollabiert. Ein Auditor hat das Projekt gestoppt. Das Protokoll wird nicht gerahmt.';
    else if (state.kpis.zeit <= 0)
      mb.textContent = 'Der Zeitplan ist kollabiert. Das Projekt wurde auf „später" verschoben. Seit 18 Monaten.';
    else if (state.kpis.motivation <= 0)
      mb.textContent = 'Das Team hat die Motivation verloren. Alle Urlaube wurden gleichzeitig eingereicht. Das Projekt liegt still.';
    else
      mb.textContent = 'Die maximale Projektlaufzeit ist erreicht. Das Equipment wartet. Quality auch. Alle warten. Für immer.';
    mbtn.className = 'modal-btn lose';
  }
  render();
}

function showDivalOffer() {
  const ov   = document.getElementById('overlay');
  const mt   = document.getElementById('modal-title');
  const mb   = document.getElementById('modal-body');
  const mbtn = document.getElementById('modal-btn');
  ov.style.display = 'flex';

  mt.className  = 'warn-legend';
  mt.textContent = '💡 DIVAL-Initiative';
  mb.innerHTML = `
    <p style="margin-bottom:12px">Die Möglichkeit besteht: eine vollständig papierlose, digitale Qualifizierung — kein Word, kein Drucker, keine Unterschriften auf Papier.</p>
    <p style="margin-bottom:12px">Das Projekt nennt sich <strong>DIVAL</strong>. Es ist risikoreich, kostet sofort <strong>3 AP</strong> und schaltet neue IT-Aktionen frei, die ihrerseits Budget kosten können.</p>
    <p style="margin-bottom:12px">⚠️ <strong style="color:var(--amber)">Wichtig:</strong> Für ein erfolgreiches DIVAL-Projekt ist ein <strong>höheres technisches Verständnis</strong> erforderlich. Ist dieses nicht ausreichend entwickelt, ist ein Erfolg ausgeschlossen.</p>
    <p style="margin-bottom:16px">Die Erfolgswahrscheinlichkeit ist <strong style="color:var(--amber)">ungewiss</strong>. Bei Erfolg: <strong style="color:var(--green)">+150 Bonuspunkte</strong>. Bei Misserfolg: kein direkter Spielabbruch, aber verschwendete Ressourcen und zusätzliche negative Events.</p>
    <p style="color:var(--text3);font-size:12px">Entscheidung gilt für das gesamte restliche Spiel.</p>`;
  mbtn.style.display = 'none'; // Standard-Button ausblenden

  // Buttons dynamisch ersetzen
  const modal = document.querySelector('.modal');
  // Alten Entscheidungs-Div entfernen falls vorhanden
  const old = document.getElementById('dival-choice');
  if (old) old.remove();

  const choiceDiv = document.createElement('div');
  choiceDiv.id = 'dival-choice';
  choiceDiv.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-top:4px';
  choiceDiv.innerHTML = `
    <button class="modal-btn" onclick="divalChoose(true)" style="background:var(--teal);border-color:var(--teal)">✅ Ja — DIVAL starten</button>
    <button class="modal-btn" onclick="divalChoose(false)" style="background:var(--red);border-color:var(--red)">❌ Nein — klassisch bleiben</button>`;
  modal.appendChild(choiceDiv);
}

function divalChoose(yes) {
  // Entscheidungs-Overlay aufräumen
  const choiceDiv = document.getElementById('dival-choice');
  if (choiceDiv) choiceDiv.remove();
  document.querySelector('.modal .modal-btn').style.display = '';
  document.getElementById('overlay').style.display = 'none';

  if (yes) {
    // Nur AP-Kosten beim Start — Budget wird nur durch die neuen DIVAL-Aktionen belastet
    const apCost = Math.min(3, state.ap);
    state.ap = Math.max(0, state.ap - apCost);
    state.divalActive = true;
    state.lastEvent = {
      msg: '🚀 DIVAL gestartet! Digitale Qualifizierung läuft — neue Aktionen freigeschaltet.',
      effects: {},
      type: 'good',
    };
  } else {
    state.divalDeclined = true;
    state.lastEvent = {
      msg: '📁 DIVAL abgelehnt. Klassische Papierdokumentation wird fortgesetzt. Der Drucker ist erleichtert.',
      effects: {},
      type: 'good',
    };
  }

  // Budget-Verlust prüfen
  if (state.kpis.budget <= 0) {
    showEndScreen(false);
    return;
  }
  render();
}

function restartGame() {
  document.getElementById('overlay').style.display = 'none';
  initGame();
}

// ============================================================
//  RENDER
// ============================================================

function kpiBarColor(key, val) {
  if (key === 'risiko') return val > 60 ? 'var(--orange)' : val > 35 ? 'var(--amber)' : 'var(--green)';
  return val < 25 ? 'var(--red)' : val < 50 ? 'var(--amber)' : KPI_DEFS.find(d => d.key === key).color;
}

function render() {
  // ---- Header ----
  document.getElementById('week').textContent        = state.week;
  document.getElementById('phase-name').textContent  = PHASES[state.phase] || 'Abgeschlossen';
  document.getElementById('progress-pct').textContent = state.progress + ' %';
  document.getElementById('progress-fill').style.width = state.progress + '%';

  // DIVAL-Status-Badge im Header
  const divalBadgeEl = document.getElementById('dival-status');
  if (divalBadgeEl) {
    if (state.divalActive) {
      divalBadgeEl.textContent = '🚀 DIVAL aktiv';
      divalBadgeEl.style.display = 'inline-block';
    } else if (state.divalDeclined) {
      divalBadgeEl.style.display = 'none';
    } else {
      divalBadgeEl.style.display = 'none';
    }
  }

  // ---- Phase track ----
  for (let i = 0; i < 7; i++) {
    const el = document.getElementById('ph-' + i);
    el.className = 'phase' + (i < state.phase ? ' done' : i === state.phase ? ' active' : '');
  }

  // ---- KPIs ----
  document.getElementById('kpi-grid').innerHTML = KPI_DEFS.map(k => {
    const v    = state.kpis[k.key];
    const disp = k.invert ? (100 - v) : v;
    const col  = kpiBarColor(k.key, v);
    return `<div class="kpi">
      <div class="kpi-name">${k.name}</div>
      <div class="kpi-bar"><div class="kpi-fill" style="width:${disp}%;background:${col}"></div></div>
      <div class="kpi-val">${disp} %</div>
    </div>`;
  }).join('');

  // ---- Skills ----
  document.getElementById('skills-display').innerHTML = SKILL_DEFS.map(s => {
    const v        = Math.round(state.skills[s.key]);
    const learning = state.learning.filter(l => l.skill === s.key);
    let statusMsg  = s.desc;
    if (learning.length > 0) {
      // Kumulierten ausstehenden Gain über alle Queue-Einträge summieren
      const totalRemaining = Math.round(learning.reduce((sum, l) => sum + (l.totalGain - l.gained), 0));
      const maxRounds      = Math.max(...learning.map(l => l.rounds));
      const fixedMsg       = state.learningMsgs[s.key] || LEARNING_MSGS[0];
      const countNote      = learning.length > 1 ? ` (${learning.length}× aktiv)` : '';
      statusMsg = fixedMsg + ` — noch ~${maxRounds} Wo.${countNote}, +${totalRemaining} % ausstehend`;
    }
    // Aseptik-Warnung nach FAT
    const aseptikWarn = (s.key === 'aseptik' && state.phase >= 3 && v < 60)
      ? ' ⚠️ Unter 60 % — Fortschritt blockiert!'
      : '';
    return `<div class="skill-item">
      <div class="skill-header">
        <span class="skill-name">${s.name}</span>
        <span class="skill-pct" style="${s.key==='aseptik'&&state.phase>=3&&v<60?'color:var(--red)':''}">${v} %${aseptikWarn}</span>
      </div>
      <div class="skill-bar"><div class="skill-fill" style="width:${v}%;${s.key==='aseptik'?'background:var(--teal)':''}"></div></div>
      <div class="skill-status ${learning.length > 0 ? 'skill-learning' : ''}">${statusMsg}</div>
    </div>`;
  }).join('');

  // ---- AP badge ----
  const maxAp = state.apThisRound;
  const dots  = '⬡'.repeat(state.ap) + '⬢'.repeat(Math.max(0, maxAp - state.ap));
  document.getElementById('ap-display').textContent = `AP: ${state.ap} / ${maxAp}  ${dots}`;

  // ---- Tabs ----
  document.querySelectorAll('.tab').forEach(t => {
    const isProject  = t.textContent.includes('Projekt');
    const isPersonal = t.textContent.includes('Persönlich');
    t.className = 'tab' + ((isProject && state.activeTab === 'project') ||
                            (isPersonal && state.activeTab === 'personal') ? ' active' : '');
  });

  // ---- Action grid ----
  renderActionGrid();

  // ---- Events ----
  const ed = document.getElementById('event-display');
  if (state.lastEvent) {
    const isLil = !!state.lastEvent.isLil;
    const pills = Object.entries(state.lastEvent.effects).map(([k, v]) => {
      const name = KPI_DEFS.find(d => d.key === k)?.name || k;
      // Risiko ist invertiert: hoher Wert = schlechter
      // UI-Darstellung: risiko+10 ist schlecht → zeige als "−10" rot
      const isRisiko = k === 'risiko';
      const displayVal = isRisiko ? -v : v;          // Vorzeichen umkehren für Risiko
      const isNeg = displayVal < 0;
      const cls   = (isLil && isRisiko) ? 'neg' : isNeg ? 'neg' : 'pos';
      const sign  = displayVal > 0 ? '+' : '';
      return `<span class="evt-pill ${cls}">${name}: ${sign}${displayVal} %</span>`;
    }).join('');
    // Fortschrittsmalus-Pill falls vorhanden
    const penaltyPill = state.lastEvent.progressPenalty
      ? `<span class="evt-pill neg">Fortschritt: −${state.lastEvent.progressPenalty} %</span>`
      : '';
    const boxStyle = isLil ? 'border:1.5px solid var(--red);background:var(--red-light);border-radius:var(--radius-sm);padding:8px;' : '';
    ed.innerHTML = `<div style="${boxStyle}">
      <div class="event-msg">${state.lastEvent.msg}</div>
      <div class="event-effects">${pills}${penaltyPill}</div>
    </div>`;
  } else if (state.week > 1) {
    ed.innerHTML = '<span style="color:var(--text3);font-style:italic">Diese Woche keine Ereignisse. Genießen Sie die Ruhe.</span>';
  }

  // ---- End turn button ----
  const etb = document.getElementById('end-turn-btn');
  etb.disabled = state.gameOver;
  if (state.progress >= 100 && state.phase >= 5) {
    if (state.skills.aseptik < 60) {
      etb.textContent = '⚠️ Freigabe gesperrt — Aseptik < 60 %';
      etb.className   = 'end-btn';
      etb.style.borderColor = 'var(--red)';
      etb.style.background  = 'var(--red-light)';
      etb.style.color       = 'var(--red)';
    } else {
      etb.textContent = 'Quality-Freigabe beantragen →';
      etb.className   = 'end-btn final';
      etb.style.borderColor = '';
      etb.style.background  = '';
      etb.style.color       = '';
    }
  } else {
    etb.textContent = 'Runde beenden →';
    etb.className   = 'end-btn';
    etb.style.borderColor = '';
    etb.style.background  = '';
    etb.style.color       = '';
  }
}

// ---- Action grid renderer (split out for clarity) ----
function renderActionGrid() {
  const grid = document.getElementById('action-grid');

  if (state.activeTab === 'project') {
    // Build a map: actionId -> [historyIndex, ...] of undoable entries this turn
    const undoMap = {};
    state.turnHistory.forEach((entry, idx) => {
      if (entry.type === 'project') {
        if (!undoMap[entry.actionId]) undoMap[entry.actionId] = [];
        undoMap[entry.actionId].push(idx);
      }
    });

    grid.innerHTML = PROJECT_ACTIONS.map(a => {
      // DIVAL-Slots: unsichtbar wenn DIVAL nicht aktiv
      if (a.divalSlot && !state.divalActive) return '';

      if (a.divalSlot && state.divalActive) {
        const slots      = PROJECT_ACTIONS.filter(x => x.divalSlot);
        const visibleIds = slots.slice(state.divalSlotOffset, state.divalSlotOffset + 2).map(x => x.id);
        const isVisible  = visibleIds.includes(a.id);
        const isUsed     = hasUsed(state.divalUsed, a.id);
        // Nicht sichtbar und nicht verbraucht → komplett ausblenden
        if (!isVisible && !isUsed) return '';
        // Sichtbar oder verbraucht → wird gerendert (verbrauchte ausgegraut via divalUsedFlag)
      }

      // Nicht-Slot divalOnly: ausblenden wenn nicht aktiv
      if (a.divalOnly && !a.divalSlot && !state.divalActive) return '';

      // ── Lieferant/intensivdoku teilen sich einen Slot ──────────────────
      if (a.id === 'lieferant' && state.week >= 6) return '';
      if (a.id === 'intensivdoku' && state.week < 6) return '';

      const available   = isActionAvailable(a);
      const undoEntries = undoMap[a.id] || [];
      const hasUndo     = undoEntries.length > 0;
      const canAfford   = state.ap >= a.cost;
      const bCost       = a.budgetCost || 0;
      const canBudget   = state.kpis.budget >= bCost;

      // FAT/SAT: nach Phase 2 (FAT abgeschlossen) → Button ausgegraut
      let displayName = a.name;
      let displayDesc = a.desc;
      let fatsatLocked = false;
      if (a.id === 'fatsat') {
        if (state.phase <= 2) {
          displayName = 'FAT / SAT-Zusatztest';
          displayDesc = 'Umfangreiche Werksabnahme (Phase: FAT)';
        } else {
          // FAT-Phase abgeschlossen → dauerhaft ausgegraut, kein SAT
          fatsatLocked = true;
          displayName = 'FAT / SAT-Zusatztest';
          displayDesc = 'FAT-Phase abgeschlossen — nicht mehr verfügbar.';
        }
      }

      // Lieferant: Countdown bis Woche 6
      let usageLabel = '';
      if (a.id === 'lieferant') {
        const weeksLeft = Math.max(0, 6 - state.week);
        usageLabel = weeksLeft > 0
          ? `<div class="phase-badge" style="background:var(--blue-light);color:var(--blue)">Noch ${weeksLeft} Woche${weeksLeft !== 1 ? 'n' : ''} verfügbar</div>`
          : `<div class="phase-badge" style="background:var(--red-light);color:var(--red)">Nicht mehr verfügbar</div>`;
      } else if (a.maxUses !== undefined) {
        const used = state.actionCount[a.id] || 0;
        const left = a.maxUses - used;
        usageLabel = `<div class="phase-badge" style="background:var(--blue-light);color:var(--blue)">Noch ${left}× verfügbar</div>`;
      }

      // Cost label: AP + optional budget
      const costLabel = bCost > 0
        ? `${a.cost} AP  +  ${bCost} % Budget`
        : `${a.cost} AP`;

      // Budget-Warnung
      const budgetWarn = (bCost > 0 && !canBudget)
        ? `<div class="phase-badge" style="background:var(--red-light);color:var(--red)">Budget reicht nicht (${Math.round(state.kpis.budget)} % übrig)</div>`
        : '';

      // Phase label for locked actions
      let phaseLockLabel = '';
      if (fatsatLocked) {
        phaseLockLabel = `<div class="phase-badge" style="background:var(--surface2);color:var(--text3)">Abgeschlossen — nicht mehr buchbar</div>`;
      } else if (!available && !hasUndo) {
        if (a.availableFrom !== undefined && state.phase < a.availableFrom)
          phaseLockLabel = `<div class="phase-badge">Verfügbar ab: ${PHASES[a.availableFrom]}</div>`;
        if (a.availableUntil !== undefined && state.phase > a.availableUntil)
          phaseLockLabel = `<div class="phase-badge">Nur bis Phase: ${PHASES[a.availableUntil]}</div>`;
      }

      if (hasUndo && !fatsatLocked) {
        const lastIdx = undoEntries[undoEntries.length - 1];
        return `<button class="action-btn undo-btn" onclick="undoProjectAction(${lastIdx})" ${state.gameOver ? 'disabled' : ''}>
          <div class="a-name">${displayName}</div>
          <div class="a-cost">${costLabel} — ${undoEntries.length}× diese Runde</div>
          <div class="a-desc">${displayDesc}</div>
          <div class="a-effect">${a.text}</div>
          <div class="a-undo">↩ Zurücknehmen (AP + Budget zurück)</div>
        </button>`;
      }

      const divalBadge = a.divalOnly
        ? `<div class="phase-badge" style="background:var(--teal-light);color:var(--teal);font-weight:600">🚀 DIVAL</div>`
        : '';

      const divalUsedFlag = a.divalSlot && hasUsed(state.divalUsed, a.id);
      const disabled = divalUsedFlag || fatsatLocked || !canAfford || !available || !canBudget || state.gameOver;
      const divalUsedLabel = divalUsedFlag
        ? `<div class="phase-badge" style="background:var(--surface2);color:var(--text3)">Bereits durchgeführt</div>`
        : '';
      return `<button class="action-btn" onclick="doProjectAction('${a.id}')" ${disabled ? 'disabled' : ''}>
        <div class="a-name">${displayName}</div>
        <div class="a-cost">${costLabel}</div>
        <div class="a-desc">${displayDesc}</div>
        <div class="a-effect">${a.text}</div>
        ${divalBadge}${divalUsedLabel}${usageLabel}${phaseLockLabel}${budgetWarn}
      </button>`;
    }).filter(Boolean).join('');

  } else {
    // Personal tab: show pending learning entries as undoable
    const undoMap = {};
    state.turnHistory.forEach((entry, idx) => {
      if (entry.type === 'personal') {
        if (!undoMap[entry.actionId]) undoMap[entry.actionId] = [];
        undoMap[entry.actionId].push(idx);
      }
    });

    grid.innerHTML = PERSONAL_ACTIONS.map(a => {
      const undoEntries = undoMap[a.id] || [];
      const hasUndo     = undoEntries.length > 0;
      const canAfford   = state.ap >= a.cost;
      const bCost       = a.budgetCost || 0;
      const canBudget   = state.kpis.budget >= bCost;
      const costLabel   = bCost > 0 ? `${a.cost} AP  +  ${bCost} % Budget` : `${a.cost} AP`;
      const budgetWarn  = (bCost > 0 && !canBudget)
        ? `<div class="phase-badge" style="background:var(--red-light);color:var(--red)">Budget reicht nicht (${Math.round(state.kpis.budget)} % übrig)</div>`
        : '';

      if (hasUndo) {
        const lastIdx = undoEntries[undoEntries.length - 1];
        return `<button class="action-btn undo-btn" onclick="undoPersonalAction(${lastIdx})" ${state.gameOver ? 'disabled' : ''}>
          <div class="a-name">${a.name}</div>
          <div class="a-cost">${costLabel} — ${undoEntries.length}× diese Runde</div>
          <div class="a-desc">${a.desc}</div>
          <div class="a-effect">${a.text}</div>
          <div class="a-undo">↩ Zurücknehmen (AP + Budget zurück)</div>
        </button>`;
      }

      const disabled = !canAfford || !canBudget || state.gameOver;
      return `<button class="action-btn" onclick="doPersonalAction('${a.id}')" ${disabled ? 'disabled' : ''}>
        <div class="a-name">${a.name}</div>
        <div class="a-cost">${costLabel}</div>
        <div class="a-desc">${a.desc}</div>
        <div class="a-effect">${a.text}</div>
        ${budgetWarn}
      </button>`;
    }).join('');
  }
}

// ============================================================
//  START
// ============================================================
initGame();
