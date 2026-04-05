// =============================================================================
//  ⚙️  SISTEMA — NÃO EDITAR ESTE ARQUIVO
//  As configurações ficam em js/config.js
// =============================================================================

// ── CONSTANTES ───────────────────────────────────────────────────────────────
const REFRESH_MS = 5 * 60 * 1000;
const DIAS_S = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DIAS_F = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const MES_N  = ["","JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const CORES  = ["#0a7c55","#1a5fa8","#b07800","#7a3fa8","#c0283e","#0e7a8a","#5a7a20","#a05800","#1a6fa8","#0a6644","#884020","#3a5fa8"];

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
let VIAGENS = [], logRowsCache = [], viagensCache = [];
let selMes = new Set(), selMot = new Set(), selDest = new Set();
let MCORE = {};
let fetchTimer = null, nextFetch = null;

// ── PARSE DA CONFIGURAÇÃO ────────────────────────────────────────────────────
const _ini = CONFIG.INICIO.split("/").map(Number);
const _fim = CONFIG.FIM.split("/").map(Number);
const ESC_INICIO = new Date(_ini[2], _ini[1] - 1, _ini[0]);
const ESC_FIM    = new Date(_fim[2], _fim[1] - 1, _fim[0]);

const MOTS = parseConfig();

// Cores base dos motoristas conhecidos
[...new Set(MOTS.map(function(m) { return m.nome; }))].sort().forEach(function(nome, i) {
  MCORE[nome] = CORES[i % CORES.length];
});

// =============================================================================
//  PARSE DA ESCALA
// =============================================================================
function parseConfig() {
  const [d0, m0, y0] = CONFIG.INICIO.split("/").map(Number);
  const [d1, m1, y1] = CONFIG.FIM.split("/").map(Number);

  return CONFIG.MOTORISTAS.map(function(m) {
    const escalaMap = {};

    function addEntry(dNum, posto) {
      if (isNaN(dNum) || dNum < 1 || dNum > 31) return;
      const month = dNum >= d0 ? m0 : m1;
      const year  = dNum >= d0 ? y0  : y1;
      const key = year + "-" + String(month).padStart(2, "0") + "-" + String(dNum).padStart(2, "0");
      escalaMap[key] = posto.toUpperCase();
    }

    (m.ESCALA || "").trim().split(/\s+/).forEach(function(entry) {
      if (!entry.includes(":")) return;
      const colon  = entry.lastIndexOf(":");
      const diaStr = entry.slice(0, colon).trim();
      const posto  = entry.slice(colon + 1).trim();
      if (!posto) return;
      if (diaStr.includes("-")) {
        const parts = diaStr.split("-");
        const a = parseInt(parts[0]), b = parseInt(parts[1]);
        if (!isNaN(a) && !isNaN(b) && a <= b)
          for (var d = a; d <= b; d++) addEntry(d, posto);
      } else {
        addEntry(parseInt(diaStr), posto);
      }
    });

    return { nome: m.NOME, fone: m.FONE, placa: m.PLACA, escalaMap: escalaMap };
  });
}

// =============================================================================
//  UTILITÁRIOS
// =============================================================================
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function ini(n) {
  const p = n.split(" ");
  return p.length >= 2 ? p[0][0] + p[1][0] : n.slice(0, 2);
}
function norm(s) {
  return String(s).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function dk(date) {
  return date.getFullYear() + "-"
    + String(date.getMonth() + 1).padStart(2, "0") + "-"
    + String(date.getDate()).padStart(2, "0");
}
function dtToKey(dt) {
  if (!dt || !dt.includes("/")) return "";
  const p = dt.split("/");
  if (p.length < 3) return "";
  return p[2] + "-" + p[1].padStart(2, "0") + "-" + p[0].padStart(2, "0");
}
function fmtDia(dt) {
  if (!dt) return "--";
  const p = dt.split("/");
  return p[0] + "/" + p[1];
}

// ── Tooltip ──
function showTip(e, h) {
  const t = document.getElementById("tip");
  t.innerHTML = h; t.style.display = "block"; moveTip(e);
}
function moveTip(e) {
  const t = document.getElementById("tip");
  t.style.left = (e.clientX + 14) + "px";
  t.style.top  = (e.clientY - 10) + "px";
}
function hideTip() { document.getElementById("tip").style.display = "none"; }

// =============================================================================
//  ABAS
// =============================================================================
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(function(b) {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.remove("active"); });
  const panel = document.getElementById("panel" + tabName.charAt(0).toUpperCase() + tabName.slice(1));
  if (panel) panel.classList.add("active");
}

// =============================================================================
//  VALIDAÇÃO AUTOMÁTICA DA ESCALA
// =============================================================================
function validarEscala(mots, iniDate, fimDate) {
  const alerts = [];
  const dayMap = {};

  mots.forEach(function(m) {
    Object.entries(m.escalaMap).forEach(function([key, turno]) {
      if (!dayMap[key]) dayMap[key] = {};
      if (!dayMap[key][turno]) dayMap[key][turno] = [];
      dayMap[key][turno].push(m.nome);
    });
  });

  // 1. Conflito de turno no mesmo dia
  Object.entries(dayMap).forEach(function([key, turnos]) {
    ["P1","P2","P3"].forEach(function(t) {
      if (turnos[t] && turnos[t].length > 1) {
        const dp = key.split("-");
        alerts.push({ tipo:"err", msg:"⚠️ Conflito " + t + " dia " + dp[2] + "/" + dp[1] + ": " + turnos[t].join(" + ") });
      }
    });
  });

  // 2. Motorista de férias escalado no mesmo dia
  mots.forEach(function(m) {
    const ferDias  = Object.entries(m.escalaMap).filter(function([,v]) { return v === "FERIAS" || v === "RECESSO"; }).map(function([k]) { return k; });
    const trabDias = Object.entries(m.escalaMap).filter(function([,v]) { return v !== "FERIAS" && v !== "RECESSO"; }).map(function([k]) { return k; });
    ferDias.forEach(function(fd) {
      if (trabDias.includes(fd)) {
        const dp = fd.split("-");
        alerts.push({ tipo:"err", msg:"⚠️ " + m.nome + " está de férias e escalado no dia " + dp[2] + "/" + dp[1] });
      }
    });
  });

  // 3. P3 descoberto
  const cur = new Date(iniDate);
  while (cur <= fimDate) {
    const key = dk(cur);
    const t = dayMap[key] || {};
    if ((t["P1"]||[]).length === 1 && (t["P2"]||[]).length === 1 && (!t["P3"] || (t["P3"]||[]).length === 0)) {
      alerts.push({ tipo:"warn", msg:"! P3 descoberto: " + String(cur.getDate()).padStart(2,"0") + "/" + String(cur.getMonth()+1).padStart(2,"0") });
    }
    cur.setDate(cur.getDate() + 1);
  }

  // 4. Motorista duplicado
  const nomesVistos = new Set();
  mots.forEach(function(m) {
    if (nomesVistos.has(m.nome)) alerts.push({ tipo:"err", msg:"⚠️ Motorista duplicado na escala: " + m.nome });
    nomesVistos.add(m.nome);
  });

  return alerts;
}

function renderValBanner(mots, iniDate, fimDate) {
  const items = validarEscala(mots, iniDate, fimDate);
  const errs  = items.filter(function(i) { return i.tipo === "err"; });
  const warns = items.filter(function(i) { return i.tipo === "warn"; });
  let html = "";

  if (!errs.length && !warns.length) {
    html = '<div class="val-item val-ok">✅ Escala válida — nenhum conflito detectado para ' + CONFIG.MES_LABEL + '</div>';
  } else {
    if (errs.length)  html += errs.map(function(i) { return '<div class="val-item val-err">'  + esc(i.msg) + '</div>'; }).join("");
    if (warns.length) html += '<div class="val-item val-warn">⚠️ ' + warns.length + ' turno(s) P3 descoberto(s) — PELKIN em férias (grupo D com 2 motoristas)</div>';
  }
  document.getElementById("valBanner").innerHTML = html;
}

// =============================================================================
//  ABA: PLANTÃO DE HOJE
// =============================================================================
function renderPlantao() {
  const now = new Date(), h = now.getHours();
  const ref = new Date(now);
  if (h < 6) ref.setDate(ref.getDate() - 1);
  ref.setHours(0, 0, 0, 0);
  const hojeKey = dk(ref);

  // Datas
  document.getElementById("dateHoje").textContent =
    DIAS_F[ref.getDay()] + ", "
    + String(ref.getDate()).padStart(2, "0") + "/"
    + String(ref.getMonth() + 1).padStart(2, "0") + "/"
    + ref.getFullYear();
  document.getElementById("dateSub").textContent = CONFIG.MES_LABEL + " · " + MOTS.length + " motoristas";
  document.getElementById("tsLbl").textContent = "🔄 " + now.toLocaleTimeString("pt-BR");

  // Alerta de período
  const alertEl = document.getElementById("alertaPeriodo");
  if (ref < ESC_INICIO || ref > ESC_FIM) {
    alertEl.style.display = "flex";
    alertEl.innerHTML = "⚠️ A data de hoje está fora do período configurado ("
      + CONFIG.INICIO + " – " + CONFIG.FIM + "). Atualize o CONFIG no GitHub para o novo ciclo.";
  } else {
    alertEl.style.display = "none";
  }

  // Regra de hora
  const rEl = document.getElementById("regraHora");
  if (h >= 19) {
    rEl.style.cssText = "background:#fff0f2;border:1px solid #f0aab5;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;color:var(--red)";
    rEl.innerHTML = "🚫 São " + h + "h — NENHUM acionamento";
  } else if (h >= 14) {
    rEl.style.cssText = "background:#fdf5e0;border:1px solid #e8c96a;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;color:var(--p2)";
    rEl.innerHTML = "⚠️ São " + h + "h — só viagens &lt;160km";
  } else {
    rEl.style.cssText = "background:#e6f9f2;border:1px solid #9adfc5;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;color:var(--p1)";
    rEl.innerHTML = "✅ São " + h + "h — Livre para acionar";
  }

  // Cards de plantão
  const p1  = MOTS.filter(function(m) { return m.escalaMap[hojeKey] === "P1"; });
  const p2  = MOTS.filter(function(m) { return m.escalaMap[hojeKey] === "P2"; });
  const p3  = MOTS.filter(function(m) { return m.escalaMap[hojeKey] === "P3"; });
  const off = MOTS.filter(function(m) {
    const v = m.escalaMap[hojeKey] || "";
    return v === "FERIAS" || v === "RECESSO";
  });

  function card(tipo, mots, cls) {
    if (!mots.length) {
      return '<div class="pc pc-vazio pc-' + cls + '"><div class="pc-badge">' + tipo + '</div>'
        + '<div style="color:var(--muted);margin-top:4px">— Sem escala —</div></div>';
    }
    return mots.map(function(m) {
      const cor  = MCORE[m.nome] || "#555";
      const desc = tipo === "P1"
        ? "🏥 Plantão Hospital — atende chamadas internas"
        : tipo === "P2"
          ? "🚐 2º a viajar — viagens externas e emergências"
          : "🚑 Primeira opção — disponível para viagem";
      return '<div class="pc pc-' + cls + '">'
        + '<div class="pc-badge">' + tipo + '</div>'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">'
        + '<div class="av" style="width:36px;height:36px;background:' + cor + '18;color:' + cor + ';border:2px solid ' + cor + '50;font-size:12px">' + esc(ini(m.nome)) + '</div>'
        + '<div class="pc-nome">' + esc(m.nome) + '</div></div>'
        + '<div class="pc-desc">' + desc + '</div>'
        + '<div class="pc-fone">📱 ' + esc(m.fone || "—") + '</div>'
        + '<span class="pc-placa">🚐 ' + esc(m.placa || "—") + '</span>'
        + '<div><span class="rs rs-ok">✅ Sempre disponível</span></div></div>';
    }).join("");
  }

  let html = card("P1", p1, "p1") + card("P2", p2, "p2") + card("P3", p3, "p3");
  if (off.length) {
    html += '<div class="pc" style="background:#fff5f6;border:1px solid #f0c0c8;grid-column:1/-1;padding:12px 16px">'
      + '<span style="font-size:12px;color:var(--red);font-weight:700">🏖️ INDISPONÍVEIS HOJE: </span>'
      + '<span style="font-size:12px;color:var(--muted)">'
      + off.map(function(m) {
          const v = m.escalaMap[hojeKey];
          return esc(m.nome) + (v === "RECESSO" ? " (Recesso)" : " (Férias)");
        }).join(" · ")
      + '</span></div>';
  }
  document.getElementById("plantaoGrid").innerHTML = html;

  // Próximos 7 dias
  const rows = [];
  for (var i = 0; i <= 7; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i); d.setHours(0, 0, 0, 0);
    if (d < ESC_INICIO || d > ESC_FIM) continue;
    const key = dk(d);
    if (!MOTS.some(function(m) { return m.escalaMap[key]; })) continue;

    const p1n = MOTS.filter(function(m) { return m.escalaMap[key] === "P1"; }).map(function(m) { return m.nome; });
    const p2n = MOTS.filter(function(m) { return m.escalaMap[key] === "P2"; }).map(function(m) { return m.nome; });
    const p3n = MOTS.filter(function(m) { return m.escalaMap[key] === "P3"; }).map(function(m) { return m.nome; });
    const fen = MOTS.filter(function(m) {
      const v = m.escalaMap[key] || "";
      return v === "FERIAS" || v === "RECESSO";
    }).map(function(m) { return m.nome + (m.escalaMap[key] === "RECESSO" ? " (Rec)" : " (Fér)"); });

    const isH = i === 0;
    const dtF = String(d.getDate()).padStart(2,"0") + "/" + String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();

    function chips(ns, cl) {
      return ns.length
        ? ns.map(function(n) { return '<span class="' + cl + '">' + esc(n) + '</span>'; }).join(" ")
        : '<span style="color:var(--muted);font-size:11px">—</span>';
    }

    rows.push(
      '<tr style="' + (isH ? "background:#f0faf6" : "") + '">'
      + '<td style="font-weight:700;font-size:12px;color:' + (isH ? "var(--p1)" : "var(--muted)") + '">'
      + dtF + (isH ? ' <span style="color:var(--p1);font-size:10px">●HOJE</span>' : "") + '</td>'
      + '<td style="font-size:12px;color:var(--muted)">' + DIAS_S[d.getDay()] + '</td>'
      + '<td>' + chips(p1n, "chip-p1") + '</td>'
      + '<td>' + chips(p2n, "chip-p2") + '</td>'
      + '<td>' + chips(p3n, "chip-p3") + '</td>'
      + '<td>' + (fen.length ? fen.map(function(n) { return '<span class="chip-off">🏖️ ' + esc(n) + '</span>'; }).join(" ") : "—") + '</td>'
      + '</tr>'
    );
  }

  document.getElementById("proxTbody").innerHTML =
    rows.join("") || '<tr><td colspan="6" class="empty">Sem dados no período</td></tr>';
}

// =============================================================================
//  ABA: VIAGENS
// =============================================================================
function renderViagens() {
  const agora    = new Date();
  const refHoje  = new Date(agora);
  if (agora.getHours() < 6) refHoje.setDate(refHoje.getDate() - 1);
  refHoje.setHours(0, 0, 0, 0);
  const hojeKey   = dk(refHoje);
  const ontemDate = new Date(refHoje); ontemDate.setDate(refHoje.getDate() - 1);
  const ontemKey  = dk(ontemDate);

  function keyToDt(k) { const p = k.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  const hojeStr  = keyToDt(hojeKey);
  const ontemStr = keyToDt(ontemKey);

  function sortByHora(arr) {
    return arr.slice().sort(function(a, b) { return (a.hora || "99:99").localeCompare(b.hora || "99:99"); });
  }

  const rowsHoje    = VIAGENS.filter(function(r) { return dtToKey(r.dt) === hojeKey; });
  const rowsOntem   = VIAGENS.filter(function(r) { return dtToKey(r.dt) === ontemKey; });
  const rowsFuturas = VIAGENS.filter(function(r) { return dtToKey(r.dt) > hojeKey; });
  rowsFuturas.sort(function(a, b) {
    const ka = dtToKey(a.dt), kb = dtToKey(b.dt);
    if (ka !== kb) return ka.localeCompare(kb);
    return (a.hora || "99:99").localeCompare(b.hora || "99:99");
  });

  const motsHoje = new Set(rowsHoje.map(function(r) { return r.m; })).size;
  const pacHoje  = rowsHoje.reduce(function(s, r) { return s + (parseInt(r.pac) || 0); }, 0);

  document.getElementById("vkHoje").textContent      = rowsHoje.length    || "--";
  document.getElementById("vkOntem").textContent     = rowsOntem.length   || "--";
  document.getElementById("vkMots").textContent      = motsHoje            || "--";
  document.getElementById("vkPac").textContent       = pacHoje             || "--";
  document.getElementById("vkFuturas").textContent   = rowsFuturas.length  || "--";
  document.getElementById("vkHojeData").textContent  = hojeStr;
  document.getElementById("vkOntemData").textContent = ontemStr;
  document.getElementById("vkFuturasSub").textContent = rowsFuturas.length === 1 ? "1 agendada" : rowsFuturas.length + " agendadas";
  document.getElementById("vSubtitle").textContent   = rowsHoje.length + " hoje · " + rowsOntem.length + " ontem";

  document.getElementById("avisoPostagem").style.display = agora.getHours() >= 19 ? "flex" : "none";

  viagensCache = sortByHora(rowsHoje).concat(sortByHora(rowsOntem));
  renderViagensTbody(hojeKey, ontemKey);

  // Futuras
  const cardFut = document.getElementById("cardFuturas");
  if (!rowsFuturas.length) { cardFut.style.display = "none"; return; }
  cardFut.style.display = "";

  const DIAS_PT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  let htmlFut = "", lastKey = "";

  rowsFuturas.forEach(function(r) {
    const rKey = dtToKey(r.dt);
    if (rKey !== lastKey) {
      lastKey = rKey;
      const dp    = r.dt.split("/");
      const rDate = new Date(parseInt(dp[2]), parseInt(dp[1]) - 1, parseInt(dp[0]));
      const diasAte = Math.round((rDate - refHoje) / 864e5);
      const sufixo  = diasAte === 1
        ? "<span style='color:var(--p3);font-weight:800'>● AMANHÃ</span>"
        : "<span style='color:var(--muted)'>em " + diasAte + " dias</span>";
      htmlFut += "<tr class='row-sep-data'><td colspan='7'><span style='color:var(--p3)'>"
        + DIAS_PT[rDate.getDay()] + " · " + esc(r.dt) + "</span> &nbsp;" + sufixo + "</td></tr>";
    }

    const cor  = MCORE[r.m] || "#555";
    const hora = r.hora ? '<span class="hora-badge" style="color:var(--p3)">' + esc(r.hora) + '</span>' : '<span style="color:var(--muted)">—</span>';
    const pac  = parseInt(r.pac) > 0 ? '<span class="pac-badge">' + esc(r.pac) + '</span>' : '<span style="color:var(--muted)">—</span>';
    const obs  = r.obs ? '<span class="obs-txt">' + esc(r.obs) + '</span>' : "";

    htmlFut += '<tr class="row-futuro">'
      + '<td><span class="fut-badge">' + esc(fmtDia(r.dt)) + '</span></td>'
      + '<td><div style="display:flex;align-items:center;gap:7px">'
      + '<div class="av" style="background:' + cor + '18;color:' + cor + ';border:1.5px solid ' + cor + '50">' + esc(ini(r.m)) + '</div>'
      + '<span style="font-weight:700;color:' + cor + ';font-size:13px">' + esc(r.m) + '</span></div></td>'
      + '<td><span class="dest-badge">📍 ' + esc(r.d) + '</span></td>'
      + '<td><span class="placa-badge">' + esc(r.placa || "—") + '</span></td>'
      + '<td>' + hora + '</td><td>' + pac + '</td><td>' + obs + '</td></tr>';
  });

  document.getElementById("futurasTbody").innerHTML = htmlFut;

  const datasFut = [...new Set(rowsFuturas.map(function(r) { return r.dt; }))];
  document.getElementById("vFuturasSub").textContent =
    rowsFuturas.length + " viagem" + (rowsFuturas.length !== 1 ? "s" : "")
    + " · " + datasFut.length + " dia" + (datasFut.length !== 1 ? "s" : "");
}

function renderViagensTbody(hojeKey, ontemKey) {
  if (!hojeKey) {
    const agora = new Date();
    const ref   = new Date(agora);
    if (agora.getHours() < 6) ref.setDate(ref.getDate() - 1);
    ref.setHours(0, 0, 0, 0);
    hojeKey = dk(ref);
    const ont = new Date(ref); ont.setDate(ref.getDate() - 1);
    ontemKey = dk(ont);
  }

  const q = norm(document.getElementById("viagensSearch").value || "");
  const filtered = q
    ? viagensCache.filter(function(r) {
        return norm(r.m).includes(q) || norm(r.d).includes(q) || norm(r.placa || "").includes(q) || (r.dt || "").includes(q);
      })
    : viagensCache;

  if (!filtered.length) {
    document.getElementById("viagensTbody").innerHTML = '<tr><td colspan="7" class="empty">Nenhuma viagem registrada para ontem ou hoje.</td></tr>';
    return;
  }

  document.getElementById("viagensTbody").innerHTML = filtered.map(function(r) {
    const cor    = MCORE[r.m] || "#555";
    const rKey   = dtToKey(r.dt);
    const isHoje = rKey === hojeKey;
    const rowClass = isHoje ? "row-hoje" : "row-ontem";
    const diaLabel = isHoje
      ? '<span style="color:var(--p1);font-weight:800;font-size:12px">● HOJE</span><br><span style="font-size:10px;color:var(--muted)">' + fmtDia(r.dt) + '</span>'
      : '<span style="color:var(--p2);font-weight:700;font-size:12px">ONTEM</span><br><span style="font-size:10px;color:var(--muted)">' + fmtDia(r.dt) + '</span>';
    const hora = r.hora ? '<span class="hora-badge">' + esc(r.hora) + '</span>' : '<span style="color:var(--muted)">—</span>';
    const pac  = parseInt(r.pac) > 0 ? '<span class="pac-badge">' + esc(r.pac) + '</span>' : '<span style="color:var(--muted)">—</span>';
    const obs  = r.obs ? '<span class="obs-txt">' + esc(r.obs) + '</span>' : "";

    return '<tr class="' + rowClass + '">'
      + '<td>' + diaLabel + '</td>'
      + '<td><div style="display:flex;align-items:center;gap:7px">'
      + '<div class="av" style="background:' + cor + '18;color:' + cor + ';border:1.5px solid ' + cor + '50">' + esc(ini(r.m)) + '</div>'
      + '<span style="font-weight:700;color:' + cor + ';font-size:13px">' + esc(r.m) + '</span></div></td>'
      + '<td><span class="dest-badge">📍 ' + esc(r.d) + '</span></td>'
      + '<td><span class="placa-badge">' + esc(r.placa || "—") + '</span></td>'
      + '<td>' + hora + '</td><td>' + pac + '</td><td>' + obs + '</td></tr>';
  }).join("");
}

// =============================================================================
//  ABA: ESCALA DO MÊS
// =============================================================================
function renderEscala() {
  const hojeKey = dk(new Date());
  const dias = [];
  const cur  = new Date(ESC_INICIO);
  while (cur <= ESC_FIM) {
    dias.push({ date: new Date(cur), key: dk(cur), d: cur.getDate(), ds: DIAS_S[cur.getDay()] });
    cur.setDate(cur.getDate() + 1);
  }

  // Coluna de nomes (fixa)
  let hn = '<table class="esc-table"><thead><tr><th style="text-align:left;min-width:110px">Motorista</th></tr></thead><tbody>';
  MOTS.forEach(function(m) {
    const cor = MCORE[m.nome] || "#555";
    hn += '<tr><td class="mc" style="color:' + cor + '" title="📱 ' + esc(m.fone) + ' · 🚐 ' + esc(m.placa) + '">' + esc(m.nome) + '</td></tr>';
  });
  hn += '</tbody></table>';

  // Colunas de dias (scroll)
  let hd = '<table class="esc-table"><thead><tr>';
  dias.forEach(function(x) {
    const isH = x.key === hojeKey;
    hd += '<th class="' + (isH ? "eh" : "") + '" style="' + (isH ? "color:var(--p1)" : "") + '">'
      + x.d + '<br><span style="font-size:8px;font-weight:400">' + x.ds + '</span></th>';
  });
  hd += '</tr></thead><tbody>';

  MOTS.forEach(function(m) {
    hd += '<tr>';
    dias.forEach(function(x) {
      const v  = m.escalaMap[x.key] || "";
      const isH = x.key === hojeKey;
      let badge = "";
      if      (v === "P1")      badge = '<span class="ep1">P1</span>';
      else if (v === "P2")      badge = '<span class="ep2">P2</span>';
      else if (v === "P3")      badge = '<span class="ep3">P3</span>';
      else if (v === "FERIAS")  badge = '<span class="efe">FER</span>';
      else if (v === "RECESSO") badge = '<span class="ere">REC</span>';
      const tip = v ? (m.nome + " · " + v + " · " + x.ds + " " + x.d) : "";
      hd += '<td style="' + (isH ? "background:#f0faf6" : "") + '"'
        + (tip ? ' onmouseenter="showTip(event,\'' + esc(tip) + '\')" onmouseleave="hideTip()" onmousemove="moveTip(event)"' : "")
        + '>' + badge + '</td>';
    });
    hd += '</tr>';
  });
  hd += '</tbody></table>';

  document.getElementById("escalaNomes").innerHTML = hn;
  document.getElementById("escalaDias").innerHTML  = hd;
  document.getElementById("escalaSub").textContent = CONFIG.MES_LABEL + " · " + dias.length + " dias";
}

// =============================================================================
//  ABA: ESTATÍSTICAS
// =============================================================================
function getF() {
  return VIAGENS.filter(function(r) {
    return (selMes.size  === 0 || selMes.has(r.mes))
        && (selMot.size  === 0 || selMot.has(r.m))
        && (selDest.size === 0 || selDest.has(r.d));
  });
}

function resetF() {
  selMes = new Set(); selMot = new Set(); selDest = new Set();
  buildF(); renderStats();
}

function buildF() {
  const mes  = [...new Set(VIAGENS.map(function(r) { return r.mes; }))].sort();
  const mot  = [...new Set(VIAGENS.map(function(r) { return r.m;   }))].sort();
  const dest = [...new Set(VIAGENS.map(function(r) { return r.d;   }))].sort();

  function makeChips(cid, items, set, cls, colorFn) {
    const el = document.getElementById(cid);
    el.innerHTML = "";
    items.slice(0, 30).forEach(function(val) {
      const btn = document.createElement("button");
      btn.className = "chip" + (set.has(val) ? " " + cls : "");
      btn.textContent = val;
      if (colorFn && set.has(val)) colorFn(btn, val);
      btn.addEventListener("click", function() {
        if (set.has(val)) { set.delete(val); btn.className = "chip"; btn.removeAttribute("style"); }
        else { set.add(val); btn.className = "chip " + cls; if (colorFn) colorFn(btn, val); }
        renderStats();
      });
      el.appendChild(btn);
    });
  }

  makeChips("fMes",  mes,  selMes,  "on", null);
  makeChips("fMot",  mot,  selMot,  "on", function(btn, m) {
    const c = MCORE[m] || "#555";
    btn.style.cssText = "border-color:" + c + ";color:" + c + ";background:" + c + "18";
  });
  makeChips("fDest", dest, selDest, "ob", null);
}

function renderStats() {
  const rows = getF();
  document.getElementById("fResult").innerHTML =
    '<span style="font-size:26px;font-weight:800;color:var(--p1)">' + rows.length + '</span>'
    + ' <span style="font-size:13px;color:var(--muted)">viagens</span>';

  const mm = {};
  rows.forEach(function(r) {
    if (!mm[r.m]) mm[r.m] = { name: r.m, color: MCORE[r.m] || CORES[0], init: ini(r.m), trips: 0, dests: {} };
    mm[r.m].trips++;
    mm[r.m].dests[r.d] = (mm[r.m].dests[r.d] || 0) + 1;
  });

  const list = Object.values(mm).sort(function(a, b) { return b.trips - a.trips; });
  list.forEach(function(d) {
    d.topDest = Object.entries(d.dests).sort(function(a, b) { return b[1] - a[1]; })[0]?.[0] || "";
  });

  const tot = list.reduce(function(s, d) { return s + d.trips; }, 0);
  const avg = list.length ? tot / list.length : 0;
  const max = list.length ? Math.max(...list.map(function(d) { return d.trips; })) : 0;
  const min = list.length ? Math.min(...list.map(function(d) { return d.trips; })) : 0;
  const per = [...selMes].join(", ") || "Todos os meses";

  document.getElementById("kT").textContent   = tot;
  document.getElementById("kP").textContent   = per;
  document.getElementById("kA").textContent   = Math.round(avg);
  document.getElementById("kD").textContent   = new Set(rows.map(function(r) { return r.d; })).size;
  document.getElementById("kTop").textContent = max || "--";
  document.getElementById("kTopN").textContent= list[0]?.name || "--";
  document.getElementById("kV").textContent   = max - min;
  document.getElementById("tblSub").textContent = list.length + " motoristas · " + per;
  document.getElementById("donutN").textContent = tot;
  document.getElementById("destSub").textContent= new Set(rows.map(function(r) { return r.d; })).size + " destinos";

  const emptyRow = '<tr><td colspan="6" class="empty">Nenhuma viagem encontrada.</td></tr>';
  if (!list.length) {
    ["drvTbody","destTbody","logTbody"].forEach(function(id) { document.getElementById(id).innerHTML = emptyRow; });
    document.getElementById("heatWrap").innerHTML = '<div class="empty">Sem dados.</div>';
    return;
  }

  // Ranking
  document.getElementById("drvTbody").innerHTML = list.map(function(d, i) {
    const df  = Math.round(d.trips - avg);
    const bdg = df > 2
      ? '<span style="background:#e6f9f2;color:var(--p1);border:1px solid #9adfc5;padding:1px 7px;border-radius:20px;font-size:10px;font-weight:700">+' + df + '</span>'
      : df < -2
        ? '<span style="background:#fff0f2;color:var(--red);border:1px solid #f0aab5;padding:1px 7px;border-radius:20px;font-size:10px;font-weight:700">' + df + '</span>'
        : '<span style="background:#fdf5e0;color:var(--p2);border:1px solid #e8c96a;padding:1px 7px;border-radius:20px;font-size:10px;font-weight:700">≈ méd</span>';
    return '<tr>'
      + '<td style="color:var(--muted);font-size:11px">' + (i + 1) + 'º</td>'
      + '<td><div style="display:flex;align-items:center;gap:7px">'
      + '<div class="av" style="background:' + d.color + '18;color:' + d.color + ';border:1.5px solid ' + d.color + '50">' + esc(d.init) + '</div>'
      + '<div><div style="font-weight:600;font-size:13px">' + esc(d.name) + '</div>'
      + '<div style="font-size:10px;color:var(--muted)">' + esc(d.topDest) + '</div></div></div></td>'
      + '<td><span class="n-big" style="color:' + d.color + '">' + d.trips + '</span></td>'
      + '<td><div class="bar-row"><div class="bar-bg"><div class="bar-fill" style="width:' + (d.trips / max * 100).toFixed(1) + '%;background:' + d.color + '"></div></div>'
      + '<span class="bar-pct">' + (d.trips / tot * 100).toFixed(1) + '%</span></div></td>'
      + '<td style="font-size:11px;color:var(--muted)">' + esc(d.topDest || "—") + '</td>'
      + '<td>' + bdg + '</td></tr>';
  }).join("");

  // Donut
  const svg = document.getElementById("donutSvg");
  const cx = 65, cy = 65, r = 52, sw = 14, circ = 2 * Math.PI * r;
  svg.innerHTML = "";
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", r);
  bg.setAttribute("fill", "none"); bg.setAttribute("stroke", "#e8eef4"); bg.setAttribute("stroke-width", sw);
  svg.appendChild(bg);

  let off = 0;
  list.forEach(function(d) {
    const pct  = d.trips / tot;
    const dash = pct * circ;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r);
    c.setAttribute("fill", "none"); c.setAttribute("stroke", d.color); c.setAttribute("stroke-width", sw);
    c.setAttribute("stroke-dasharray", Math.max(0, dash - 1) + " " + (circ - Math.max(0, dash - 1)));
    c.setAttribute("stroke-dashoffset", -off * circ);
    svg.appendChild(c);
    off += pct;
  });

  document.getElementById("donutLeg").innerHTML = list.slice(0, 8).map(function(d) {
    return '<div class="li">'
      + '<div class="ll"><div class="ld" style="background:' + d.color + '"></div>'
      + '<span class="ln">' + esc(d.name.split(" ")[0]) + '</span></div>'
      + '<div class="lr"><span class="lp" style="color:' + d.color + '">' + (d.trips / tot * 100).toFixed(1) + '%</span>'
      + '<span class="lt">' + d.trips + 'v</span></div></div>';
  }).join("");

  // Mapa de calor
  const dc   = {};
  rows.forEach(function(r) { dc[r.d] = (dc[r.d] || 0) + 1; });
  const topD = Object.entries(dc).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10).map(function(e) { return e[0]; });
  const maxV = Math.max(...list.flatMap(function(d) { return topD.map(function(dest) { return d.dests[dest] || 0; }); }), 1);

  let hh = '<div class="heat-hdr">' + topD.map(function(d) { return '<span title="' + esc(d) + '">' + esc(d) + '</span>'; }).join("") + '</div>';
  list.forEach(function(d) {
    hh += '<div class="heat-row"><div class="heat-lbl">' + esc(d.name.split(" ")[0]) + '</div>';
    topD.forEach(function(dest) {
      const v  = d.dests[dest] || 0;
      const al = v > 0 ? Math.min(1, .3 + v / maxV * .7) : .08;
      hh += '<div class="heat-cell" style="' + (v > 0 ? "background:" + d.color + ";opacity:" + al : "background:var(--s3)") + '"'
        + ' onmouseenter="showTip(event,\'<b>' + esc(d.name) + '</b> → ' + esc(dest) + '<br>' + v + ' viagens\')"'
        + ' onmouseleave="hideTip()" onmousemove="moveTip(event)">' + (v || "") + '</div>';
    });
    hh += "</div>";
  });
  document.getElementById("heatWrap").innerHTML = hh;

  // Destinos
  const ds  = Object.entries(dc).sort(function(a, b) { return b[1] - a[1]; });
  const dm  = ds[0]?.[1] || 1;
  const dt2 = ds.reduce(function(s, e) { return s + e[1]; }, 0);
  document.getElementById("destTbody").innerHTML = ds.map(function(entry) {
    const [d, t] = entry;
    return '<tr><td style="font-weight:600">📍 ' + esc(d) + '</td>'
      + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:800;color:var(--p2)">' + t + '</td>'
      + '<td><div class="bar-row"><div class="bar-bg"><div class="bar-fill" style="width:' + (t / dm * 100).toFixed(1) + '%;background:var(--p2)"></div></div>'
      + '<span class="bar-pct">' + (t / dt2 * 100).toFixed(1) + '%</span></div></td></tr>';
  }).join("");

  // Log
  logRowsCache = [...rows].sort(function(a, b) {
    return b.dt.split("/").reverse().join("").localeCompare(a.dt.split("/").reverse().join(""));
  });
  renderLog();
}

function renderLog() {
  const q = norm(document.getElementById("logSearch").value || "");
  const filtered = q
    ? logRowsCache.filter(function(r) {
        return norm(r.m).includes(q) || norm(r.d).includes(q) || norm(r.placa || "").includes(q) || r.dt.includes(q);
      })
    : logRowsCache;

  document.getElementById("logSub").textContent = filtered.length < logRowsCache.length
    ? "exibindo " + Math.min(filtered.length, 300) + " de " + filtered.length + " (total: " + logRowsCache.length + ")"
    : filtered.length + " viagens";

  document.getElementById("logTbody").innerHTML = filtered.slice(0, 300).map(function(r) {
    const cor = MCORE[r.m] || "#555";
    return '<tr>'
      + '<td style="color:var(--muted);font-size:12px">' + esc(r.dt) + '</td>'
      + '<td><div style="display:flex;align-items:center;gap:7px">'
      + '<div class="av" style="background:' + cor + '18;color:' + cor + ';border:1.5px solid ' + cor + '50">' + esc(ini(r.m)) + '</div>'
      + '<span style="font-weight:600;color:' + cor + '">' + esc(r.m) + '</span></div></td>'
      + '<td>📍 ' + esc(r.d) + '</td>'
      + '<td><span class="vb">' + esc(r.placa || "—") + '</span></td>'
      + '<td><span class="hv">' + esc(r.hora || "—") + '</span></td>'
      + '<td style="font-size:11px;color:var(--gold)">' + esc(r.obs) + '</td></tr>';
  }).join("");
}

// =============================================================================
//  FETCH DE VIAGENS (Google Sheets CSV)
// =============================================================================
function splitCSV(line) {
  const p = []; let cur = "", inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { p.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  p.push(cur.trim());
  return p.map(function(v) { return v.replace(/^"|"$/g, "").trim(); });
}

function scheduleFetch(delay) {
  if (fetchTimer) clearTimeout(fetchTimer);
  nextFetch  = Date.now() + delay;
  fetchTimer = setTimeout(fetchViagens, delay);
}

async function fetchViagens() {
  if (fetchTimer) clearTimeout(fetchTimer);
  const b = document.getElementById("banner");
  b.style.display = "flex";
  b.innerHTML = '<span style="color:var(--p1)">⏳ Buscando registro de viagens...</span>';

  try {
    const res = await fetch(CONFIG.VIAGENS_URL + "&cb=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const out  = [];

    for (const line of text.split(/\r?\n/)) {
      const p    = splitCSV(line);
      if (p.length < 4) continue;
      const placa = p[0], m = p[1].toUpperCase(), d = p[2], hora = p[3];
      let dt = p[4] || "";
      const pac = p[5] || "", obs = p[6] || "";
      if (!m || m === "MOTORISTA" || !d || !dt.includes("/")) continue;
      const dp = dt.split("/");
      if (dp.length === 3 && dp[2].length === 2) dt = dp[0] + "/" + dp[1] + "/20" + dp[2];
      const mn = parseInt(dp[1] || 0);
      out.push({ placa, m, d, hora, dt, pac, obs, mes: mn >= 1 && mn <= 12 ? MES_N[mn] : "?" });
    }

    out.sort(function(a, b) {
      return b.dt.split("/").reverse().join("").localeCompare(a.dt.split("/").reverse().join(""));
    });
    VIAGENS = out;

    [...new Set(out.map(function(v) { return v.m; }))].sort().forEach(function(m, i) {
      if (!MCORE[m]) MCORE[m] = CORES[i % CORES.length];
    });

    buildF(); renderStats(); renderViagens();

    b.innerHTML = '<span style="color:var(--p1)">🟢 ' + out.length + ' viagens · ' + new Date().toLocaleTimeString("pt-BR") + '</span>'
      + ' &nbsp;<button class="btn" id="btnBannerNow" style="font-size:10px;padding:3px 10px">⟳ Agora</button>';
    document.getElementById("btnBannerNow").addEventListener("click", fetchViagens);
    scheduleFetch(REFRESH_MS);

  } catch (err) {
    b.innerHTML = '<span style="color:var(--p2)">⚠️ Erro: ' + esc(err.message) + '</span>'
      + ' &nbsp;<button class="btn" id="btnBannerRetry" style="font-size:10px;padding:3px 10px">⟳ Tentar</button>';
    document.getElementById("btnBannerRetry").addEventListener("click", fetchViagens);
    scheduleFetch(30000);
  }
}

// =============================================================================
//  INICIALIZAÇÃO
// =============================================================================
function init() {
  document.getElementById("footerUTI").textContent  = CONFIG.VEICULOS_UTI    || "—";
  document.getElementById("footerFone").textContent = CONFIG.FONE_TRANSPORTE || "—";
  renderValBanner(MOTS, ESC_INICIO, ESC_FIM);
  renderPlantao();
  renderEscala();
  fetchViagens();
}

document.addEventListener("DOMContentLoaded", function() {

  // Navegação por abas
  document.querySelectorAll(".tab-btn").forEach(function(btn) {
    btn.addEventListener("click", function() { switchTab(btn.dataset.tab); });
  });

  // Botão atualizar
  document.getElementById("btnAtualizar").addEventListener("click", function() {
    renderValBanner(MOTS, ESC_INICIO, ESC_FIM);
    renderPlantao();
    renderEscala();
    fetchViagens();
  });

  // Filtros
  document.getElementById("btnResetF").addEventListener("click", resetF);

  // Buscas
  document.getElementById("logSearch").addEventListener("input", renderLog);
  document.getElementById("viagensSearch").addEventListener("input", function() { renderViagensTbody(); });

  // Pausa fetch quando aba fica em background
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "hidden") {
      if (fetchTimer) clearTimeout(fetchTimer);
    } else {
      const remaining = nextFetch ? nextFetch - Date.now() : 0;
      scheduleFetch(remaining > 1000 ? remaining : 0);
    }
  });

  init();
});
