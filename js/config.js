// =============================================================================
//  ✏️  ÁREA DE EDIÇÃO MENSAL — ATUALIZE AQUI E FAÇA COMMIT NO GITHUB
// =============================================================================
//
//  Este arquivo contém APENAS as configurações editáveis.
//  A lógica do sistema está em js/app.js — não precisa mexer lá.
//
// =============================================================================

const CONFIG = {

  // ══════════════════════════════════════════════════════════════════════════
  // 1. CABEÇALHO DO MÊS
  // ══════════════════════════════════════════════════════════════════════════
  MES_LABEL : "ABRIL 2026",
  INICIO    : "06/04/2026",
  FIM       : "05/05/2026",

  // ══════════════════════════════════════════════════════════════════════════
  // 2. RODÍZIO MENSAL — COMO ATUALIZAR NO GITHUB
  //
  //  ┌─ REGRA ──────────────────────────────────────────────────────────────┐
  //  │  Todo início de mês, 3 passos:                                      │
  //  │  1. Recorte a linha marcada "▼ PRÓXIMO A DESCER"                    │
  //  │  2. Cole-a como última linha (antes do comentário "← cole aqui")    │
  //  │  3. Atualize INICIO, FIM, MES_LABEL e as ESCALAs de todos          │
  //  └──────────────────────────────────────────────────────────────────────┘
  //
  //  Como fazer no GitHub:
  //  1. Clique no lápis ✏️ para editar este arquivo (js/config.js)
  //  2. Selecione a linha marcada com ← PRÓXIMO A DESCER
  //  3. Recorte: Ctrl+X  (Mac: ⌘+X)
  //  4. Posicione o cursor na linha "← cole aqui..." e cole: Ctrl+V
  //  5. Atualize INICIO / FIM / MES_LABEL para o novo ciclo
  //  6. Atualize a ESCALA de cada motorista com os dias/postos do novo mês
  //  7. Commit changes — o dashboard atualiza automaticamente
  //
  //  ┌──────────────────────────────────────────────────────────────────────┐
  //  │  ABRIL 2026 — próximo a descer no rodízio de MAIO: ROMÁRIO          │
  //  └──────────────────────────────────────────────────────────────────────┘
  //
  //  Formato ESCALA:  "DIA:POSTO  DIA:POSTO  ..."
  //  Postos válidos:  P1  P2  P3  FERIAS  RECESSO
  //  Intervalos:      "6-25:FERIAS"   "17-23:RECESSO"
  //  Dias < INICIO → pertencem ao mês seguinte (maio neste caso)
  //
  // ══════════════════════════════════════════════════════════════════════════
  MOTORISTAS: [

    // ▼ PRÓXIMO A DESCER — recorte esta linha e cole no final em MAIO ▼
    { NOME:"ROMÁRIO",      FONE:"98139-4366", PLACA:"QAB-5799", ESCALA:"8:P1  12:P2  16:P1  20:P2  24:P1  28:P2  2:P1" },
    // ▲ ──────────────────────────────────────────────────────────── ▲

    { NOME:"EDMAR",        FONE:"99947-5310", PLACA:"RWH-0D64", ESCALA:"8:P2  12:P1  16:P2  20:P1  24:P2  28:P1  2:P2" },
    { NOME:"JOSE MANOEL",  FONE:"99265-1581", PLACA:"SID-7G71", ESCALA:"9:P1  13:P2  17:P3  21:P1  25:P2  29:P3  3:P1" },
    { NOME:"ROBSON",       FONE:"99641-7423", PLACA:"RWH-0D67", ESCALA:"9:P2  13:P3  17:P1  21:P2  25:P3  29:P1  3:P2" },
    { NOME:"COSME",        FONE:"99677-0467", PLACA:"SYX-9F79", ESCALA:"9:P3  13:P1  17:P2  21:P3  25:P1  29:P2  3:P3" },
    { NOME:"SILVIO",       FONE:"99644-7196", PLACA:"TEA-4A97", ESCALA:"6:P1  10:P2  14:P3  18:P1  22:P2  26:P3  30:P1  4:P2" },
    { NOME:"PAULO GAIOLA", FONE:"99957-2433", PLACA:"RWB-4G28", ESCALA:"6:P2  10:P3  14:P1  18:P2  22:P3  26:P1  30:P2  4:P3" },
    { NOME:"IVO LEAL",     FONE:"99697-3163", PLACA:"RWA-0J92", ESCALA:"6:P3  10:P1  14:P2  18:P3  22:P1  26:P2  30:P3  4:P1" },
    { NOME:"ODAIR",        FONE:"99949-6233", PLACA:"QAU-4F33", ESCALA:"7:P1  11:P2  15:P1  19:P2  23:P1  27:P2  1:P3   5:P1" },
    { NOME:"EDIPO",        FONE:"99122-6035", PLACA:"GCW-5C63", ESCALA:"7:P2  11:P1  15:P2  19:P1  23:P2  27:P3  1:P1   5:P2" },
    { NOME:"PELKIN",       FONE:"99884-4437", PLACA:"SIL-9E23", ESCALA:"6-25:FERIAS  27:P1  1:P2  5:P3" },

    // ← cole aqui a linha recortada do topo (antes deste comentário)
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // 3. INFORMAÇÕES COMPLEMENTARES
  // ══════════════════════════════════════════════════════════════════════════
  VEICULOS_UTI    : "GCW-5C63 · RWA-0J92",
  FONE_TRANSPORTE : "99964-0675",

  // ══════════════════════════════════════════════════════════════════════════
  // 4. URL DA PLANILHA DE VIAGENS (Google Sheets publicado como CSV)
  // ══════════════════════════════════════════════════════════════════════════
  VIAGENS_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS6FJhhY7ifdW7q8c3mObGodJm8fz2mfcLo2qns7aWzUbzJfCKOebOYqEI31sNlsn1vuTAFB__q2egV/pub?gid=164510149&single=true&output=csv",
};
