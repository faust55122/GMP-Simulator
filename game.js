// ============================================================
//  GMP QUALIFICATION SIMULATOR — game.js
// ============================================================

// ============================================================
//  HIGHSCORE — JSONBin.io Konfiguration
//  Trage hier deine eigenen Werte ein:
// ============================================================
const JSONBIN_API_KEY  = '$2a$10$25KUTuEXfrhJx..46EAvRuQlyMLiuD2G8YfXy8T3B4n/51wpKiS0C';   // z.B. '$2a$10$abc123...'
const JSONBIN_BIN_ID   = '6a32e013da38895dfed1ffff';   // z.B. '6849abc12e...'
const JSONBIN_BASE_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
const HS_ADMIN_PW      = 'gmp-reset-2025';       // ← Admin-Passwort für Reset (ändern!)
const HS_MAX_ENTRIES   = 20;

// ── Highscore: Einträge laden ────────────────────────────────
async function hsLoad() {
  try {
    const r = await fetch(JSONBIN_BASE_URL + '/latest', {
      headers: {
        'X-Access-Key': JSONBIN_API_KEY,
        'X-Bin-Meta':   'false'
      }
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data.scores) ? data.scores : [];
  } catch { return []; }
}

// ── Highscore: Eintrag speichern ────────────────────────────
async function hsSave(scores) {
  await fetch(JSONBIN_BASE_URL, {
    method: 'PUT',
    headers: {
      'Content-Type':      'application/json',
      'X-Access-Key':      JSONBIN_API_KEY,
      'X-Bin-Versioning':  'false',
    },
    body: JSON.stringify({ scores }),
  });
}

// ── Highscore: Neuen Score eintragen ────────────────────────
// Gibt { rank, total, scores, eligible } zurück
async function hsSubmit(name, score) {
  const scores = await hsLoad();
  const entry  = { name: name.substring(0, 20), score, date: new Date().toLocaleDateString('de-DE') };
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const rank  = scores.indexOf(entry) + 1;
  const trimmed = scores.slice(0, HS_MAX_ENTRIES);
  await hsSave(trimmed);
  return { rank, total: trimmed.length, scores: trimmed };
}

// ── Highscore-Fenster anzeigen ───────────────────────────────
async function showHighscoreOverlay(playerScore, playerName) {
  const ov = document.getElementById('hs-overlay');
  const content = document.getElementById('hs-content');
  ov.style.display = 'flex';
  content.innerHTML = '<div style="color:var(--text3);font-style:italic;padding:20px 0">Highscores werden geladen …</div>';

  const scores = await hsLoad();
  const playerRank = scores.filter(e => e.score > playerScore).length + 1;
  const eligible   = playerRank <= HS_MAX_ENTRIES;

  // Tabellenzeilen
  const rows = scores.map((e, i) => {
    const isPlayer = playerName && e.name === playerName && e.score === playerScore;
    const bg = isPlayer ? 'background:var(--teal-light);font-weight:600;' : '';
    return `<tr style="${bg}">
      <td style="padding:5px 8px;color:var(--text3);font-family:'Source Code Pro',monospace;font-size:12px">#${i + 1}</td>
      <td style="padding:5px 8px;font-size:13px">${e.name}</td>
      <td style="padding:5px 8px;text-align:right;font-family:'Source Code Pro',monospace;font-size:13px;color:var(--teal)">${e.score}</td>
      <td style="padding:5px 8px;font-size:11px;color:var(--text3)">${e.date || ''}</td>
    </tr>`;
  }).join('');

  const tableHtml = scores.length === 0
    ? '<div style="color:var(--text3);font-style:italic;padding:10px 0">Noch keine Einträge.</div>'
    : `<table style="width:100%;border-collapse:collapse;margin-top:8px">${rows}</table>`;

  // Eingabebereich: nur zeigen wenn noch nicht eingetragen und Platz in Top 20
  let inputHtml = '';
  if (playerScore !== null && !playerName) {
    if (eligible) {
      inputHtml = `
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Du bist auf Platz <strong>${playerRank}</strong> — trage deinen Namen ein:</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="hs-name-input" maxlength="20" placeholder="Dein Name (max. 20 Zeichen)"
              style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'Source Sans 3',sans-serif;font-size:13px;color:var(--text);background:var(--surface2)">
            <button onclick="hsEnterScore(${playerScore})" class="modal-btn" style="padding:7px 16px;font-size:13px">Eintragen</button>
          </div>
        </div>`;
    } else {
      inputHtml = `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);color:var(--text3);font-style:italic;font-size:13px">
        Dein Score (${playerScore}) reicht nicht für die Top ${HS_MAX_ENTRIES}. Beim nächsten Mal!
      </div>`;
    }
  }

  // Admin-Reset (versteckt, per Klick sichtbar)
  const adminHtml = `
    <div style="margin-top:18px;text-align:right">
      <span id="hs-admin-toggle" onclick="document.getElementById('hs-admin-box').style.display='block';this.style.display='none'"
        style="font-size:10px;color:var(--text3);cursor:pointer;user-select:none">⚙</span>
      <div id="hs-admin-box" style="display:none;margin-top:8px">
        <input id="hs-admin-pw" type="password" placeholder="Admin-Passwort" maxlength="40"
          style="padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12px;width:180px">
        <button onclick="hsAdminReset()" style="margin-left:6px;padding:5px 10px;border:1px solid var(--red);background:var(--red-light);color:var(--red);border-radius:var(--radius-sm);font-size:12px;cursor:pointer">Reset</button>
        <span id="hs-admin-msg" style="font-size:11px;color:var(--text3);margin-left:6px"></span>
      </div>
    </div>`;

  content.innerHTML = `
    <div style="font-size:11px;font-weight:600;letter-spacing:1px;color:var(--text3);margin-bottom:4px;font-family:'Source Code Pro',monospace">TOP ${HS_MAX_ENTRIES} — HALL OF FAME</div>
    ${tableHtml}
    ${inputHtml}
    ${adminHtml}`;
}

// ── Score eintragen und Tabelle aktualisieren ────────────────
async function hsEnterScore(playerScore) {
  const input = document.getElementById('hs-name-input');
  const name  = (input ? input.value.trim() : '') || 'Anonym';
  if (!name) { input && (input.style.borderColor = 'var(--red)'); return; }
  document.getElementById('hs-content').innerHTML =
    '<div style="color:var(--text3);font-style:italic;padding:20px 0">Wird gespeichert …</div>';
  const result = await hsSubmit(name, playerScore);
  showHighscoreOverlay(playerScore, name);
}

// ── Admin-Reset ──────────────────────────────────────────────
async function hsAdminReset() {
  const pw  = document.getElementById('hs-admin-pw').value;
  const msg = document.getElementById('hs-admin-msg');
  if (pw !== HS_ADMIN_PW) { msg.textContent = '❌ Falsches Passwort'; msg.style.color = 'var(--red)'; return; }
  msg.textContent = 'Wird zurückgesetzt …'; msg.style.color = 'var(--text3)';
  await hsSave([]);
  msg.textContent = '✅ Highscore geleert!'; msg.style.color = 'var(--green)';
  setTimeout(() => showHighscoreOverlay(null, null), 1000);
}

// ── Layout-Umschaltung (Breit/Hochkant) ─────────────────────
function toggleLayout() {
  const game = document.getElementById('game');
  const btn  = document.getElementById('layout-toggle-btn');
  const isWide = game.classList.toggle('wide-layout');
  btn.textContent = isWide ? '⬛ Hochkant-Ansicht' : '⬜ Breit-Ansicht';
}


// ============================================================
//  EQUIPMENT DEFINITIONS
//  Each run randomly picks one equipment — determines subtitle,
//  whether Aseptik is required, and flavour throughout.
// ============================================================

const EQUIPMENT_TYPES = [
  {
    id: 'autoklav',
    name: 'Autoklav A-3000',
    subtitle: 'STERILISATIONS EDITION — Druck macht den Unterschied.',
    requiresAseptik: true,
  },
  {
    id: 'coater',
    name: 'Coater XT-500',
    subtitle: 'COATING EDITION — Schicht für Schicht zur Freigabe.',
    requiresAseptik: false,
  },
  {
    id: 'abfuell',
    name: 'Abfüllanlage DeltaFill',
    subtitle: 'FILL & FINISH EDITION — Jeder Tropfen zählt.',
    requiresAseptik: true,
  },
  {
    id: 'isolator',
    name: 'Isolator IS-9000',
    subtitle: 'ASEPTIK EDITION — Steril oder gar nicht.',
    requiresAseptik: true,
  },
  {
    id: 'tablette',
    name: 'Tablettenpresse Hercules',
    subtitle: 'SOLID DOSE EDITION — Komprimiert. Präzise. GMP-konform.',
    requiresAseptik: false,
  },
  {
    id: 'gefrier',
    name: 'Gefriertrockner CryoMax',
    subtitle: 'LYOPHILISATION EDITION — Kalt, kälter, qualifiziert.',
    requiresAseptik: true,
  },
  {
    id: 'mischer',
    name: 'Granuliermischer GranPro 800',
    subtitle: 'GRANULIERUNG EDITION — Alles auf einen Klumpen gebracht.',
    requiresAseptik: false,
  },
  {
    id: 'wassersystem',
    name: 'WFI-Anlage PureFlow',
    subtitle: 'WATER SYSTEM EDITION — Reinheit hat ihren Preis.',
    requiresAseptik: true,
  },
];

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
  { key:'aseptik',  name:'Aseptik Know-How',         desc:'Pflicht >60 % nach FAT-Abschluss (equipmentabhängig)' },
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
    effects:{ gmp:4, vertrauen:2 },
    text:'GMP-Wissen ↑  Vertrauen ↑',
    maxUses: 6,
  },
  {
    id:'doppel', name:'Doppelkontrolle', cost:2,
    desc:'Hohe Fehlerfinderchance',
    effects:{ gmp:7, risiko:-6, motivation:-5, zeit:-2 },
    text:'GMP ↑  Risiko ↓  Motivation ↓  Zeitplan ↓  — mögliche Budget-Erhöhung nach Rundenende',
    budgetChance: true,   // 50 % Chance auf +4 % Budget — wird erst bei endTurn ausgewertet
  },
  {
    id:'fat', name:'FAT — Werksabnahme',
    cost:2, budgetCost: 10,
    desc:'Factory Acceptance Test beim Lieferanten',
    effects:{ wissen:10, motivation:8 },
    text:'Wissen ↑↑  Motivation ↑  (Budget ↓)',
    availableUntil: 2,  // nur bis Ende FAT-Phase
  },
  {
    id:'sat', name:'SAT — Vor-Ort-Abnahme',
    cost:2, budgetCost: 8,
    desc:'Site Acceptance Test im eigenen Betrieb',
    effects:{ wissen:6, vertrauen:10, risiko:-8 },
    text:'Vertrauen ↑↑  Wissen ↑  Risiko ↓  (Budget ↓)',
    availableFrom: 3,   // ab IQ-Phase
  },
  {
    id:'schulung', name:'Bedienerschulung', cost:1,
    desc:'Team trainieren',
    effects:{ motivation:8, gmp:3, wissen:2 },
    text:'Motivation ↑  GMP ↑  Equipment-Wissen ↑',
    maxUses: 4,
  },
  {
    id:'meeting', name:'Abstimmungsmeeting', cost:1,
    desc:'Alle ins Boot holen',
    effects:{ vertrauen:5, motivation:3, zeit:-3 },
    text:'Vertrauen ↑  (Zeitplan etwas knapper)',
  },
  {
    // Externe Unterstützung: teuer, schadet Wissen + Vertrauen, hilft Zeitplan
    id:'extern', name:'Externe Projektunterstützung', cost:2,
    desc:'Beraterfirma einschalten',
    effects:{ zeit:16, wissen:-5, vertrauen:-3, budget:-11 },
    text:'Zeitplan ↑↑  Wissen ↓  Vertrauen ↓  Budget ↓',
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
  { label:'Inmation-Schnittstelle vergessen',   msg:'⚙️ Die Automatisierung hat die Inmation-Schnittstelle vergessen.',         effects:{ risiko:10 }, progressPenalty:5, weekMax:4 },
  { label:'Equipment-Verhalten unerwartet',     msg:'🔩 Das Equipment verhält sich unerwartet. Niemand versteht warum.',        effects:{ wissen:-10, risiko:8, motivation:-5 }, techMalus:true },
  { label:'Messwertabweichung',                 msg:'📉 Messwerte weichen ab — technische Ursache unklar.',                     effects:{ wissen:-8, vertrauen:-8, risiko:10 }, techMalus:true },
  { label:'Kalibrierfehler',                    msg:'🛠️ Ein Kalibrierfehler bleibt wochenlang unbemerkt.',                      effects:{ wissen:-12, gmp:-8, risiko:12 }, techMalus:true },
  { label:'Unbekannte Parameter',               msg:'❓ Der Lieferant fragt nach Parametern, die niemand im Team kennt.',        effects:{ wissen:-8, vertrauen:-6, zeit:-5 }, techMalus:true },
  { label:'Falsche Dokumentenversion',          msg:'📄 Der Lieferant hat Version 27 geschickt. Sie arbeiten mit Version 23.',              effects:{ gmp:-8,  zeit:-5              } },
  { label:'Quality-Fund Seite 183',             msg:'🔍 Quality hat einen fehlenden Punkt auf Seite 183 gefunden.',                         effects:{ vertrauen:-10, gmp:-5         } },
  { label:'Falscher Maschinenname im Protokoll',msg:'💻 Im IQ-Protokoll steht plötzlich der Name einer anderen Maschine.',                  effects:{ gmp:-12, vertrauen:-8         }, phaseMin:3 },
  { label:'Undokumentierte Lieferanten-Demo',   msg:'🎉 Der Lieferant demonstriert stolz eine Funktion, die nicht in der URS steht.',       effects:{ wissen:5, risiko:10           } },
  { label:'Fehlende Unterschrift',              msg:'✍️ Das Equipment funktioniert perfekt. Leider fehlt eine Unterschrift.',                effects:{ vertrauen:-12, zeit:-5        } },
  { label:'Unbekanntes Dokument beim Audit',    msg:'🕵️ Ein Auditor fragt nach einem Dokument, das niemand jemals gesehen hat.',             effects:{ gmp:-10, vertrauen:-8, risiko:8 } },
  { label:'Meeting zur Meeting-Vorbereitung',   msg:'📅 Es wird ein Meeting zur Vorbereitung des Vorbereitungsmeetings angesetzt.',          effects:{ zeit:-8, motivation:-5        } },
  { label:'FINAL_v7_NEU_WIRKLICH_FINAL.docx',  msg:'💾 Jemand speichert die Datei als FINAL_v7_NEU_WIRKLICH_FINAL.docx',                  effects:{ gmp:-6,  motivation:-4        } },
  { label:'Lieferant antwortet nach 14 Tagen',  msg:'📬 Der Lieferant antwortet nach 14 Tagen: „Können Sie die Frage bitte präzisieren?"', effects:{ zeit:-10, risiko:6            } },
  { label:'Change Control — neues Ventil',      msg:'🔧 Während der Qualifizierung wird ein neues Ventil eingebaut. Change eröffnet.',      effects:{ risiko:15, zeit:-12, gmp:-5   } },
  { label:'GMP-Drucker streikt',                msg:'🖨️ Die Dokumentation ist fertig. Der GMP-Drucker hat andere Pläne.',                   effects:{ zeit:-5, motivation:-6 }, noDival:true },
  { label:'Übersehenes Risiko',                 msg:'✨ Quality findet ein Risiko, das in drei Risikoanalysen übersehen wurde.',             effects:{ gmp:-8, vertrauen:-10, risiko:10 } },
  { label:'Regulatory lehnt digitales Format ab', msg:'💻 Regulatory akzeptiert das digitale Format nicht. Rückfragen häufen sich.',        effects:{ vertrauen:-12, gmp:-6, zeit:-5 }, divalOnly:true },
  { label:'Validierungsserver ausgefallen',     msg:'🖥️ Der Validierungsserver ist ausgefallen. IT verspricht: „bis Freitag".',              effects:{ zeit:-10, motivation:-8, risiko:8 }, divalOnly:true },
  { label:'eSign-Zugriffsrechte falsch',        msg:'🔐 Zugriffsrechte für eSign wurden falsch konfiguriert. Alle Signaturen ungültig.',    effects:{ gmp:-10, vertrauen:-10, zeit:-8 }, divalOnly:true },
  { label:'Auditor will Ausdruck',              msg:'📋 Das papierlose Konzept scheitert am Auditor: „Ich möchte das ausgedruckt sehen."', effects:{ vertrauen:-8, motivation:-6 }, divalOnly:true },
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
  // Pick random equipment for this run
  const equip = EQUIPMENT_TYPES[Math.floor(Math.random() * EQUIPMENT_TYPES.length)];

  state = {
    week:       1,
    maxWeeks:   20,
    ap:         4,
    maxAp:      4,
    apThisRound: 4,
    phase:      0,
    progress:   0,
    kpis: {
      wissen: 40, gmp: 50, vertrauen: 40,
      risiko: 30, budget: 45 + Math.floor(Math.random() * 16), zeit: 80, motivation: 50,
    },
    skills: { gmpKnow: 10, tech: 10, aseptik: 10, pm: 10, komm: 10 },

    // Equipment für diesen Run
    equipment: equip,

    // Learning queue: { skill, points, rounds, queueId }
    learning: [],
    nextQueueId: 0,

    // Undo history for THIS turn only — cleared on endTurn()
    turnHistory: [],

    // Track which project action ids have been used at least once (ever)
    usedActions: [],
    actionCount: {},

    activeTab:  'project',
    lastEvent:  null,
    gameOver:   false,
    badEventLog: [],  // { label, week } — alle negativen Events dieses Runs

    // LiL: kann jederzeit einmalig kommen; 2-3 Runden vorher Warnung
    lilTriggered:    false,   // eigentliches Event schon ausgelöst
    lilWarnWeek:     null,    // Woche in der die Warnung erscheint
    lilEventWeek:    null,    // Woche in der das Event erscheint
    lilWarned:       false,   // Warnung schon angezeigt

    learningMsgs: {},
    divalOffered:  false,
    divalActive:   false,
    divalDeclined: false,
    divalDone:     false,
    divalSlotOffset: 0,
    divalUsed: [],
    usedEventMsgs: [],
    pendingBudgetChance: false,
  };

  // LiL-Timing festlegen: irgendwann zwischen Woche 4 und 16
  const lilEventWeek  = 4 + Math.floor(Math.random() * 13);   // 4–16
  const lilWarnOffset = 2 + Math.floor(Math.random() * 2);    // 2 oder 3 Runden vorher
  state.lilEventWeek  = lilEventWeek;
  state.lilWarnWeek   = Math.max(1, lilEventWeek - lilWarnOffset);

  // Update page subtitle and title for this equipment
  const subtitleEl = document.querySelector('.subtitle');
  if (subtitleEl) subtitleEl.textContent = equip.subtitle;
  const titleEl = document.querySelector('h1');
  if (titleEl) titleEl.textContent = 'GMP QUALIFICATION SIMULATOR';

  render();
}

// ============================================================
//  HELPERS
// ============================================================

function clamp(v, mn = 0, mx = 100) { return Math.max(mn, Math.min(mx, v)); }

function skillBonus(sk) {
  const v = state.skills[sk];
  if (v <= 55) return 0;
  return Math.round((v / 100) * 7);
}

function apForThisRound() {
  const pm         = state.skills.pm / 100;
  const motivBonus = state.kpis.motivation >= 70 ? 1 : 0;
  const phaseBonus = (state.phase > 0 && state.phase % 2 === 0) ? 1 : 0;
  return Math.min(9, state.maxAp + Math.round(pm * 2) + motivBonus + phaseBonus);
}
function applyEffects(effects) {
  // Gibt zurück, was TATSÄCHLICH angewendet wurde (nach Clamp) — wichtig für exaktes Undo
  const applied = {};
  for (const [k, v] of Object.entries(effects)) {
    if (!(k in state.kpis)) continue;
    let bonus = 0;
    if (v > 0) {
      if (k === 'gmp')       bonus = skillBonus('gmpKnow');
      if (k === 'wissen')    bonus = skillBonus('tech');
      if (k === 'vertrauen') bonus = skillBonus('komm');
    }
    const before = state.kpis[k];
    const after  = clamp(before + v + (v > 0 ? bonus : 0));
    state.kpis[k] = after;
    applied[k] = after - before;   // tatsächlicher Delta, ggf. durch Clamp gekappt
  }
  return applied;
}

function reverseEffects(applied) {
  // Nimmt die von applyEffects zurückgegebenen TATSÄCHLICHEN Deltas und macht sie exakt rückgängig.
  // Kein erneutes Berechnen von Skillbonus/Clamp — sonst entsteht der "100% → Undo → <100%"-Bug.
  for (const [k, delta] of Object.entries(applied)) {
    if (!(k in state.kpis)) continue;
    state.kpis[k] = clamp(state.kpis[k] - delta);
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
  return true;
}

function progressGainFor(a) {
  const needsAseptik = state.equipment.requiresAseptik;
  const aseptikBlocked = needsAseptik && state.phase >= 3 && state.skills.aseptik < 60;
  if (aseptikBlocked) return 0;
  const avg = needsAseptik
    ? (state.skills.gmpKnow + state.skills.tech + state.skills.aseptik) / 3
    : (state.skills.gmpKnow + state.skills.tech) / 2;
  const factor = 0.4 + (avg / 100) * 0.6;
  return Math.round(a.cost * 1.5 * factor) + (a.progressBonus || 0);
}

// Gibt den aktuellen Effizienzfaktor als Prozentzahl zurück (für die Anzeige)
function efficiencyPercent() {
  const needsAseptik = state.equipment.requiresAseptik;
  const avg = needsAseptik
    ? (state.skills.gmpKnow + state.skills.tech + state.skills.aseptik) / 3
    : (state.skills.gmpKnow + state.skills.tech) / 2;
  return Math.round((0.4 + (avg / 100) * 0.6) * 100);
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
  const appliedEffects = applyEffects(a.effects);
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
    appliedEffects,   // tatsächlich angewendete (geclampte) KPI-Deltas für exaktes Undo
  });

  // Hinweis: Budget-Check erfolgt NICHT mehr hier, sondern erst am Rundenende
  // (_checkLoseConditions), damit der Spieler innerhalb der Runde noch reagieren kann.
  render();
}

function undoProjectAction(historyIndex) {
  if (state.gameOver) return;
  const entry = state.turnHistory[historyIndex];
  if (!entry || entry.type !== 'project') return;
  const a = PROJECT_ACTIONS.find(x => x.id === entry.actionId);
  if (!a) return;

  // Effekte exakt invertieren — nutzt die tatsächlich angewendeten (geclampten) Deltas,
  // nicht die rohen a.effects. Fallback auf a.effects für alte History-Einträge ohne das Feld.
  reverseEffects(entry.appliedEffects || a.effects);
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
  const slots       = PROJECT_ACTIONS.filter(x => x.divalSlot);
  const unusedSlots = slots.filter(x => !hasUsed(state.divalUsed, x.id));
  // Wenn alle aktuell sichtbaren 2 Slots genutzt wurden, Offset vorrücken
  const offset   = state.divalSlotOffset % Math.max(1, unusedSlots.length);
  const visible  = unusedSlots.slice(offset, offset + 2);
  if (visible.length > 0 && visible.every(x => hasUsed(state.divalUsed, x.id))) {
    state.divalSlotOffset = (state.divalSlotOffset + 2) % Math.max(1, unusedSlots.length);
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
    state.divalResult = (techOk && Math.random() < (state.skills.tech - 60) / 100) ? 'success' : (techOk ? 'fail' : 'fail_tech');
  }
  if (state.equipment.requiresAseptik && state.skills.aseptik < 60) showEndScreen(false, 'aseptik');
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
  state.kpis.vertrauen  = clamp(state.kpis.vertrauen - 1);
  // PM > 55 %: stiller Budget-Bonus +1 % (kompensiert teilweise den Decay)
  if (state.skills.pm > 55) state.kpis.budget = clamp(state.kpis.budget + 1);
  // Skill-basierte Abzüge (kumulativ)
  if (state.skills.gmpKnow >= 10 && state.skills.gmpKnow < 55) {
    state.kpis.gmp       = clamp(state.kpis.gmp - 10);
    state.kpis.vertrauen = clamp(state.kpis.vertrauen - 7);
  }
  if (state.skills.komm >= 10 && state.skills.komm < 45) {
    state.kpis.zeit       = clamp(state.kpis.zeit - 3);
    state.kpis.motivation = clamp(state.kpis.motivation - 2);
  }
  if (state.skills.tech < 60) {
    state.kpis.risiko = clamp(state.kpis.risiko + 5);
    state.kpis.wissen = clamp(state.kpis.wissen - 4);
  }
  // Aseptik-Decay nur wenn Equipment Aseptik erfordert
  if (state.equipment.requiresAseptik && state.skills.aseptik < 45) {
    state.kpis.vertrauen = clamp(state.kpis.vertrauen - 3);
    state.kpis.risiko    = clamp(state.kpis.risiko + 2);
  }
}

function _rollRandomEvent() {
  // Auto-progress
  let auto = 0;
  const avg = state.equipment.requiresAseptik
    ? (state.skills.gmpKnow + state.skills.tech + state.skills.aseptik) / 3
    : (state.skills.gmpKnow + state.skills.tech) / 2;
  const aseptikBlocked = state.equipment.requiresAseptik && state.phase >= 3 && state.skills.aseptik < 60;
  if (!aseptikBlocked) {
    if (avg >= 25) {
      if (state.kpis.gmp > 60)    auto += 0.25 + (avg / 400);
      if (state.kpis.wissen > 60) auto += 0.25 + (avg / 400);
    }
    auto += (Math.random() * 2 - 1);
  }
  state.progress = clamp(state.progress + Math.round(auto));
  updatePhase();

  // Event würfeln
  const roll        = Math.random();
  const riskFactor  = state.kpis.risiko / 100;
  const trustFactor = state.kpis.vertrauen / 100;

  // Kommunikation dämpft Bad-Events (max +12 % bei komm=0, nicht +25 %)
  const kommMalus   = (1 - state.skills.komm / 100) * 0.12;
  // Hohe Skills senken Bad-Events aktiv (bis -8 % wenn alle Skills > 60)
  const avgSkillPct = (state.skills.gmpKnow + state.skills.tech + state.skills.aseptik + state.skills.komm) / 4;
  const skillProtection = (avgSkillPct / 100) * 0.08;

  const badThreshold  = state.week <= 3
    ? 0
    : Math.max(0, 0.12 + riskFactor * 0.12 + kommMalus - skillProtection); // max ~28 %, min 0
  // Gute Events: Skills erhöhen die Chance aktiv
  const skillBoost    = (avgSkillPct / 100) * 0.08;
  const goodThreshold = 1 - (0.15 + trustFactor * 0.10 + skillBoost);      // bei hohen Skills öfter

  if (roll < badThreshold) {
    const eligible = EVENTS_BAD.filter(e =>
      (!e.weekMax   || state.week <= e.weekMax) &&
      (!e.phaseMin  || state.phase >= e.phaseMin) &&
      (!e.divalOnly || state.divalActive) &&
      (!e.noDival   || !state.divalActive) &&
      !hasUsed(state.usedEventMsgs, e.msg)
    );
    const pool = eligible.length > 0
      ? eligible
      : EVENTS_BAD.filter(e =>
          (!e.divalOnly || state.divalActive) &&
          (!e.phaseMin  || state.phase >= e.phaseMin)
        );
    const techWeak = state.skills.tech < 40 || state.kpis.wissen < 40;
    const weighted = [];
    pool.forEach(e => { weighted.push(e); if (e.techMalus && techWeak) weighted.push(e); });
    const ev = weighted[Math.floor(Math.random() * weighted.length)];
    markUsed(state.usedEventMsgs, ev.msg);
    state.lastEvent = { ...ev, type: 'bad' };
    // In Herausforderungs-Log eintragen
    state.badEventLog.push({ label: ev.label || ev.msg.replace(/^[^\w]+/, '').slice(0, 40), week: state.week });
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
    return;
  }
  // DIVAL-Slot-Rotation nach Rundenende
  if (state.divalActive) rotateDivalSlotIfNeeded();

  // ── LiL: Warnung 2-3 Runden vorher, dann das eigentliche Event ──────────
  if (!state.lilTriggered) {
    if (!state.lilWarned && state.week >= state.lilWarnWeek) {
      // Vorab-Warnung anzeigen (überschreibt lastEvent sofern kein echtes Event diese Runde)
      state.lilWarned = true;
      const weeksUntil = state.lilEventWeek - state.week;
      state.lastEvent = {
        msg: `⚠️ Gerüchte aus der LiL: Ressourcenengpässe zeichnen sich ab — das Projekt könnte in ${weeksUntil} Woche${weeksUntil !== 1 ? 'n' : ''} betroffen sein.`,
        effects: {},
        type: 'warn',
        isLilWarn: true,
      };
    } else if (state.lilWarned && state.week >= state.lilEventWeek) {
      // Eigentliches LiL-Event — Effekte skalieren mit PM-Skill
      state.lilTriggered = true;
      const pmFactor    = Math.max(0.3, 1 - state.skills.pm / 100); // PM 0% → 100% Effekt, PM 100% → 30%
      const risikoHit   = Math.round(15 * pmFactor);
      const progressHit = Math.round(15 * pmFactor);
      const lil = {
        msg: `🏥 Die LiL benötigt dringend Unterstützung — Ressourcen werden abgezogen. ${state.skills.pm > 55 ? '(PM-Erfahrung dämpft den Schaden)' : ''}`,
        effects: { risiko: risikoHit },
        progressPenalty: progressHit,
        type: 'bad',
        isLil: true,
      };
      state.lastEvent = lil;
      // LiL in Herausforderungs-Log eintragen
      state.badEventLog.push({ label: `LiL-Ressourcenentzug (PM-Faktor: ${Math.round((1 - state.skills.pm/100)*100)}%)`, week: state.week });
      applyEffects(lil.effects);
      state.progress = clamp(state.progress - lil.progressPenalty);
      updatePhase();
    }
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
      state.divalResult = (techOk && Math.random() < (state.skills.tech - 60) / 100) ? 'success' : (techOk ? 'fail' : 'fail_tech');
    }
    // Aseptik-Check nur wenn Equipment es erfordert
    if (state.equipment.requiresAseptik && state.skills.aseptik < 60) {
      showEndScreen(false, 'aseptik');
    } else {
      showEndScreen(true);
    }
    return true;
  }
  return false;
}

// ============================================================
//  CHALLENGES SUMMARY (für den Endscreen)
// ============================================================

function _buildChallengesHtml() {
  if (!state.badEventLog || state.badEventLog.length === 0) {
    return `<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:600;letter-spacing:1px;color:var(--text3);margin-bottom:8px">HERAUSFORDERUNGEN DIESES DURCHLAUFS</div>
      <div style="color:var(--text3);font-style:italic;font-size:13px">Keine negativen Events — bemerkenswert ruhiger Durchlauf.</div>
    </div>`;
  }
  const items = state.badEventLog.map(e =>
    `<div style="display:flex;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;color:var(--red);flex-shrink:0">▸</span>
      <span style="font-size:13px;color:var(--text1);flex:1">${e.label}</span>
      <span style="font-size:11px;color:var(--text3);flex-shrink:0">Woche ${e.week}</span>
    </div>`
  ).join('');
  return `<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
    <div style="font-size:11px;font-weight:600;letter-spacing:1px;color:var(--text3);margin-bottom:8px">HERAUSFORDERUNGEN DIESES DURCHLAUFS</div>
    ${items}
  </div>`;
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
    // Risiko ist invertiert: niedriger Wert = besser → (100 - risiko) für Score
    const kpiScore =
      state.kpis.vertrauen          * 0.25 +
      state.kpis.gmp                * 0.20 +
      state.kpis.wissen             * 0.15 +
      state.kpis.motivation         * 0.10 +
      state.kpis.budget             * 0.15 +
      state.kpis.zeit               * 0.15 +
      (100 - state.kpis.risiko)     * 0.00; // Risiko fließt in skillScore ein, nicht doppelt
    // Skill-Durchschnitt (alle 5 Skills)
    const skillAvg   = (state.skills.gmpKnow + state.skills.aseptik + state.skills.tech + state.skills.komm + state.skills.pm) / 5;
    // Risikobonus: niedriges Risiko = Bonus (max +40 Punkte bei Risiko=0)
    const risikoBonus = Math.round((100 - state.kpis.risiko) / 2.5);
    // Zeitbonus: je früher fertig, desto mehr (max +80 bei Woche 10 oder früher)
    const weekScore  = Math.max(0, (state.maxWeeks - state.week) * 8);
    const divalBonus = state.divalResult === 'success' ? 100
      : (state.divalActive && state.divalResult !== 'success') ? -50 : 0;

    // Skalierung: kpiScore (0–100) × 6.5 = 0–650, skillAvg (0–100) × 1.5 = 0–150
    // + risikoBonus (0–40) + weekScore (0–80) + divalBonus (+100 Erfolg / −50 Fail)
    // Theoretisches Maximum OHNE DIVAL: 920 (gecappt 900) → Legendär (≥830) bei sehr gutem KPI-Management
    // auch ohne Extrem-Speedrun erreichbar; DIVAL bleibt zusätzlicher Hebel/Risiko
    const rawScore   = kpiScore * 6.5 + skillAvg * 1.5 + risikoBonus + weekScore + divalBonus;
    const finalScore = Math.min(900, Math.round(rawScore));

    let divalText = '';
    if (state.divalActive) {
      if (state.divalResult === 'success')
        divalText = '\n\n🚀 DIVAL erfolgreich: Papierlose Qualifizierung akzeptiert! +100 Punkte Bonus.';
      else if (state.divalResult === 'fail_tech')
        divalText = '\n\n❌ DIVAL gescheitert: Das technische Verständnis war zu gering für eine digitale Qualifizierung. Mindestens 60 % wären nötig gewesen. −50 Punkte Abzug.';
      else
        divalText = '\n\n❌ DIVAL gescheitert: Regulatory hat das digitale Format abgelehnt. IT war auch nicht hilfreich. −50 Punkte Abzug.';
    }
    const scoreText = `\n\n📊 Abschlusspunktzahl: ${finalScore} / 900 Punkte${divalText}`;

    const challengesHtml = _buildChallengesHtml();

    const score = finalScore;
    let titleClass, titleText, bodyText;
    if (score >= 830) {
      titleClass = 'win-legend'; titleText = '🏆 Legendäre Qualifizierung!';
      bodyText = 'Quality genehmigt sofort. Selbst der Auditor wirkt beeindruckt. Sie werden zur hausinternen Legende. Das Protokoll wird gerahmt.' + scoreText;
    } else if (score >= 630) {
      titleClass = 'win-legend'; titleText = '✅ Erfolgreiche Freigabe';
      bodyText = 'Normale Freigabe erteilt. Die Dokumentation ist akzeptabel. Niemand fragt warum. Das Equipment läuft. Die Kaffeemaschine auch.' + scoreText;
    } else if (score >= 450) {
      titleClass = 'warn-legend'; titleText = '⚠️ Freigabe mit Auflagen';
      bodyText = 'Einige Nacharbeiten erforderlich. Quality hat 7 Punkte. Sie lösen die Hälfte davon in 3 Runden. Die andere Hälfte „eskaliert".' + scoreText;
    } else {
      titleClass = 'warn-legend'; titleText = '🔄 Nachqualifizierung';
      bodyText = 'Weitere Maßnahmen notwendig. Ein neuer Change-Control wird eröffnet. Ihr Kalender weint.' + scoreText;
    }
    state.lastFinalScore = finalScore;   // für Highscore-Button merken

    mt.className  = titleClass;
    mt.textContent = titleText;
    mb.innerHTML = `<span style="white-space:pre-wrap">${bodyText}</span>${challengesHtml}`;
    mbtn.className = 'modal-btn';

    // Highscore-Button einfügen (nur bei Gewinn)
    const hsBtn = document.getElementById('hs-open-btn');
    if (hsBtn) hsBtn.style.display = 'inline-block';
  } else {
    mt.className  = 'lose-legend';
    mt.textContent = '☠️ Totaler GMP-GAU';
    let loseText;
    if (reason === 'aseptik')
      loseText = `Aseptik Know-How bei nur ${Math.round(state.skills.aseptik)} % — Quality verweigert die Freigabe. Ohne ausreichende Aseptik-Kompetenz (mind. 60 %) ist keine Qualifizierung möglich. Projekt ELEVATE war Ihre letzte Chance.`;
    else if (state.kpis.budget <= 0)
      loseText = 'Das Budget ist überschritten. Der CFO betritt den Raum. Niemand macht Augenkontakt. Das Equipment steht im Korridor — unbezahlt.';
    else if (state.kpis.vertrauen <= 0)
      loseText = 'Quality hat das Vertrauen vollständig verloren. Bitte beginnen Sie erneut mit einer aktualisierten Version der Dokumentation — und Ihrer Karriere.';
    else if (state.kpis.gmp <= 0)
      loseText = 'Das GMP-Wissen ist kollabiert. Ein Auditor hat das Projekt gestoppt. Das Protokoll wird nicht gerahmt.';
    else if (state.kpis.zeit <= 0)
      loseText = 'Der Zeitplan ist kollabiert. Das Projekt wurde auf „später" verschoben. Seit 18 Monaten.';
    else if (state.kpis.motivation <= 0)
      loseText = 'Das Team hat die Motivation verloren. Alle Urlaube wurden gleichzeitig eingereicht. Das Projekt liegt still.';
    else
      loseText = 'Die maximale Projektlaufzeit ist erreicht. Das Equipment wartet. Quality auch. Alle warten. Für immer.';
    // Auslösendes Event nur zeigen, wenn der Verlust durch ein Rundenend-Event kam (nicht bei direkter Aktion)
    const triggerEvent = (state.lastEvent && reason !== 'action')
      ? `\n\n📌 Auslösendes Ereignis: ${state.lastEvent.msg}`
      : '';
    mb.innerHTML = `<span style="white-space:pre-wrap">${loseText}${triggerEvent}</span>${_buildChallengesHtml()}`;
    mbtn.className = 'modal-btn lose';
    const hsBtn = document.getElementById('hs-open-btn');
    if (hsBtn) hsBtn.style.display = 'none';
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
    <p style="margin-bottom:16px">Die Erfolgswahrscheinlichkeit ist <strong style="color:var(--amber)">ungewiss</strong>. Bei Erfolg: <strong style="color:var(--green)">+100 Bonuspunkte</strong>. Bei Misserfolg: kein direkter Spielabbruch, aber verschwendete Ressourcen und zusätzliche negative Events.</p>
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
  document.getElementById('event-display').innerHTML =
    '<span style="color:var(--text3);font-style:italic">Noch keine Ereignisse. Das Projekt beginnt ruhig — genießen Sie es.</span>';
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

  // Equipment-Name im Header aktualisieren
  const equipEl = document.getElementById('equipment-name');
  if (equipEl) equipEl.textContent = state.equipment.name;

  // Aktionseffizienz-Anzeige (inline neben Phase)
  const effEl = document.getElementById('efficiency-display');
  if (effEl) {
    const eff = efficiencyPercent();
    const col = eff >= 75 ? 'rgba(150,255,200,0.9)' : eff >= 55 ? 'rgba(255,220,100,0.9)' : 'rgba(255,130,130,0.9)';
    effEl.innerHTML = `Effizienz: <strong style="color:${col}">${eff} %</strong>`;
  }

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

    // Aseptik: bei nicht-aseptik Equipment neutral anzeigen
    if (s.key === 'aseptik' && !state.equipment.requiresAseptik) {
      statusMsg = `Nicht relevant für ${state.equipment.name}`;
    } else if (learning.length > 0) {
      const totalRemaining = Math.round(learning.reduce((sum, l) => sum + (l.totalGain - l.gained), 0));
      const maxRounds      = Math.max(...learning.map(l => l.rounds));
      const fixedMsg       = state.learningMsgs[s.key] || LEARNING_MSGS[0];
      const countNote      = learning.length > 1 ? ` (${learning.length}× aktiv)` : '';
      statusMsg = fixedMsg + ` — noch ~${maxRounds} Wo.${countNote}, +${totalRemaining} % ausstehend`;
    }

    // Aseptik-Warnung nach FAT — nur wenn Equipment es erfordert
    const aseptikWarn = (s.key === 'aseptik' && state.equipment.requiresAseptik && state.phase >= 3 && v < 60)
      ? ' ⚠️ Unter 60 % — Fortschritt blockiert!'
      : '';
    // Aseptik bei nicht-aseptik Equipment: ausgegraut
    const isInactive = s.key === 'aseptik' && !state.equipment.requiresAseptik;
    return `<div class="skill-item" style="${isInactive ? 'opacity:0.45' : ''}">
      <div class="skill-header">
        <span class="skill-name">${s.name}</span>
        <span class="skill-pct" style="${s.key==='aseptik'&&state.equipment.requiresAseptik&&state.phase>=3&&v<60?'color:var(--red)':''}">${v} %${aseptikWarn}</span>
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
  function _decayLine() {
    const decayLines = ['Motivation −2 %', 'Budget −1 %', 'Zeitplan −2 %', 'Vertrauen −1 %'];
    if (state.skills.pm > 55) decayLines.push('PM-Bonus: Budget +1 %');
    if (state.skills.gmpKnow < 55) decayLines.push('GMP niedrig: GMP-Wissen −10 %, Vertrauen −7 %');
    if (state.skills.komm < 45) decayLines.push('Komm. niedrig: Zeitplan −3 %, Motivation −2 %');
    if (state.skills.tech < 60) decayLines.push('Tech. niedrig: Risiko −5 % ⚠️, Wissen −4 %');
    if (state.equipment.requiresAseptik && state.skills.aseptik < 45) decayLines.push('Aseptik niedrig: Vertrauen −3 %, Risiko −2 % ⚠️');
    return `<div style="margin-top:6px;font-size:11px;opacity:0.7">📉 Passiver Rundenabzug: ${decayLines.join(' · ')}</div>`;
  }
  if (state.lastEvent) {
    const isLil     = !!state.lastEvent.isLil;
    const isLilWarn = !!state.lastEvent.isLilWarn;
    const pills = Object.entries(state.lastEvent.effects).map(([k, v]) => {
      const name = KPI_DEFS.find(d => d.key === k)?.name || k;
      const isRisiko   = k === 'risiko';
      const displayVal = isRisiko ? -v : v;
      const isNeg = displayVal < 0;
      const cls   = (isLil && isRisiko) ? 'neg' : isNeg ? 'neg' : 'pos';
      const sign  = displayVal > 0 ? '+' : '';
      return `<span class="evt-pill ${cls}">${name}: ${sign}${displayVal} %</span>`;
    }).join('');
    const penaltyPill = state.lastEvent.progressPenalty
      ? `<span class="evt-pill neg">Fortschritt: −${state.lastEvent.progressPenalty} %</span>`
      : '';
    let boxStyle = '';
    if (isLil)     boxStyle = 'border:1.5px solid var(--red);background:var(--red-light);border-radius:var(--radius-sm);padding:8px;';
    if (isLilWarn) boxStyle = 'border:1.5px solid var(--amber);background:var(--amber-light,#fffbeb);border-radius:var(--radius-sm);padding:8px;';
    ed.innerHTML = `<div style="${boxStyle}">
      <div class="event-msg">${state.lastEvent.msg}</div>
      <div class="event-effects">${pills}${penaltyPill}</div>
      ${state.week > 1 ? _decayLine() : ''}
    </div>`;
  } else if (state.week > 1) {
    ed.innerHTML = `<div style="color:var(--text3);font-size:12px">
      <span style="font-style:italic">Diese Woche keine Ereignisse.</span>
      ${_decayLine()}
    </div>`;
  }

  // ---- End turn button ----
  const etb = document.getElementById('end-turn-btn');
  etb.disabled = state.gameOver;
  const aseptikBlock = state.equipment.requiresAseptik && state.skills.aseptik < 60;
  if (state.progress >= 100 && state.phase >= 5) {
    if (aseptikBlock) {
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
        const isUsed     = hasUsed(state.divalUsed, a.id);
        // Bereits genutzt, ABER diese Runde noch per Undo rückgängig machbar → sichtbar lassen
        const hasUndoThisTurn = state.turnHistory.some(e => e.actionId === a.id);
        if (isUsed && !hasUndoThisTurn) return '';   // aus früherer Runde genutzt → ausblenden
        const unusedSlots = slots.filter(x => !hasUsed(state.divalUsed, x.id) || state.turnHistory.some(e => e.actionId === x.id));
        // Aus den ungenutzten nur die ersten 2 anzeigen (rotierend via Offset)
        const visibleIds = unusedSlots.slice(state.divalSlotOffset % Math.max(1, unusedSlots.length),
                                              state.divalSlotOffset % Math.max(1, unusedSlots.length) + 2);
        const clampedVisible = visibleIds.length < 2 ? unusedSlots.slice(0, 2) : visibleIds;
        if (!clampedVisible.find(x => x.id === a.id) && !hasUndoThisTurn) return '';
      }
      if (a.divalOnly && !a.divalSlot && !state.divalActive) return '';

      // ── FAT/SAT: immer nur einer sichtbar — SAT ersetzt FAT ab Phase 3 ──
      // Ausnahme: FAT bleibt sichtbar wenn ein Undo-Eintrag für diese Runde existiert
      const hasFatUndo = state.turnHistory.some(e => e.actionId === 'fat');
      if (a.id === 'fat' && state.phase >= 3 && !hasFatUndo) return '';
      if (a.id === 'sat' && state.phase < 3)  return '';

      // ── Lieferant/intensivdoku teilen sich einen Slot ──────────────────
      if (a.id === 'lieferant' && state.week >= 6) return '';
      if (a.id === 'intensivdoku' && state.week < 6) return '';

      const available   = isActionAvailable(a);
      const undoEntries = undoMap[a.id] || [];
      const hasUndo     = undoEntries.length > 0;
      const canAfford   = state.ap >= a.cost;
      const bCost       = a.budgetCost || 0;
      const canBudget   = state.kpis.budget >= bCost;

      // Lieferant: Countdown bis Woche 6
      let usageLabel = '';
      if (a.id === 'lieferant') {
        const weeksLeft = Math.max(0, 6 - state.week);
        usageLabel = `<div class="phase-badge" style="background:var(--blue-light);color:var(--blue)">Noch ${weeksLeft} Woche${weeksLeft !== 1 ? 'n' : ''} verfügbar</div>`;
      } else if (a.maxUses !== undefined) {
        const used = state.actionCount[a.id] || 0;
        const left = a.maxUses - used;
        usageLabel = `<div class="phase-badge" style="background:var(--blue-light);color:var(--blue)">Noch ${left}× verfügbar</div>`;
      }

      // Cost label
      const costLabel = bCost > 0 ? `${a.cost} AP  +  ${bCost} % Budget` : `${a.cost} AP`;

      // Budget-Warnung
      const budgetWarn = (bCost > 0 && !canBudget)
        ? `<div class="phase-badge" style="background:var(--red-light);color:var(--red)">Budget reicht nicht (${Math.round(state.kpis.budget)} % übrig)</div>`
        : '';

      // Phase lock label
      let phaseLockLabel = '';
      if (!available && !hasUndo) {
        if (a.availableFrom !== undefined && state.phase < a.availableFrom)
          phaseLockLabel = `<div class="phase-badge">Verfügbar ab: ${PHASES[a.availableFrom]}</div>`;
        if (a.availableUntil !== undefined && state.phase > a.availableUntil)
          phaseLockLabel = `<div class="phase-badge">Abgeschlossen — nicht mehr buchbar</div>`;
      }

      if (hasUndo) {
        const lastIdx = undoEntries[undoEntries.length - 1];
        return `<button class="action-btn undo-btn" onclick="undoProjectAction(${lastIdx})" ${state.gameOver ? 'disabled' : ''}>
          <div class="a-name">${a.name}</div>
          <div class="a-cost">${costLabel} — ${undoEntries.length}× diese Runde</div>
          <div class="a-desc">${a.desc}</div>
          <div class="a-effect">${a.text}</div>
          <div class="a-undo">↩ Zurücknehmen (AP + Budget zurück)</div>
        </button>`;
      }

      const divalBadge    = a.divalOnly ? `<div class="phase-badge" style="background:var(--teal-light);color:var(--teal);font-weight:600">🚀 DIVAL</div>` : '';
      const disabled = !canAfford || !available || !canBudget || state.gameOver;

      return `<button class="action-btn" onclick="doProjectAction('${a.id}')" ${disabled ? 'disabled' : ''}>
        <div class="a-name">${a.name}</div>
        <div class="a-cost">${costLabel}</div>
        <div class="a-desc">${a.desc}</div>
        <div class="a-effect">${a.text}</div>
        ${divalBadge}${usageLabel}${phaseLockLabel}${budgetWarn}
      </button>`;
    }).filter(Boolean).join('');

  } else {
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

      // Aseptik-Trainings bei nicht-aseptik Equipment deaktivieren und markieren
      const isAseptikSkill = a.skill === 'aseptik';
      const aseptikIrrelevant = isAseptikSkill && !state.equipment.requiresAseptik;
      const aseptikNote = aseptikIrrelevant
        ? `<div class="phase-badge" style="background:var(--surface2);color:var(--text3)">Nicht relevant für ${state.equipment.name}</div>`
        : '';

      if (hasUndo && !aseptikIrrelevant) {
        const lastIdx = undoEntries[undoEntries.length - 1];
        return `<button class="action-btn undo-btn" onclick="undoPersonalAction(${lastIdx})" ${state.gameOver ? 'disabled' : ''}>
          <div class="a-name">${a.name}</div>
          <div class="a-cost">${costLabel} — ${undoEntries.length}× diese Runde</div>
          <div class="a-desc">${a.desc}</div>
          <div class="a-effect">${a.text}</div>
          <div class="a-undo">↩ Zurücknehmen (AP + Budget zurück)</div>
        </button>`;
      }

      const disabled = aseptikIrrelevant || !canAfford || !canBudget || state.gameOver;
      return `<button class="action-btn" onclick="doPersonalAction('${a.id}')" ${disabled ? 'disabled' : ''} style="${aseptikIrrelevant ? 'opacity:0.45' : ''}">
        <div class="a-name">${a.name}</div>
        <div class="a-cost">${costLabel}</div>
        <div class="a-desc">${a.desc}</div>
        <div class="a-effect">${a.text}</div>
        ${aseptikNote}${budgetWarn}
      </button>`;
    }).join('');
  }
}

// ============================================================
//  START
// ============================================================
initGame();