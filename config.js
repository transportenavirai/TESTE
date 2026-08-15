// =============================================================================
//  GMS · CONFIGURAÇÃO CENTRAL
//  EDITE SOMENTE ESTE ARQUIVO PARA ATUALIZAR AS FONTES E A ESCALA MENSAL.
// =============================================================================

const SOURCES = {
  // REGISTRO GERAL: PLACA, MOTORISTA, DESTINO, HORA, DATA, OBS
  REGISTRO_GERAL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQI6auY_9xHSJGEj2yjUXBCGyx3K9acP3qRApIm6EqTuXw6rtd6BArAH12OAJx8HtRqvpbDsiawgbc2/pub?gid=936830313&single=true&output=csv",

  // ESCALA/VIAGENS: VEICULO, MOTORISTA, DESTINO, SAIDA, PACIENTES, OBS, DATA, POSTADO, MES
  ESCALA_VIAGENS: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS6FJhhY7ifdW7q8c3mObGodJm8fz2mfcLo2qns7aWzUbzJfCKOebOYqEI31sNlsn1vuTAFB__q2egV/pub?gid=164510149&single=true&output=csv"
};

const REFRESH_MS = 60 * 1000;
const RETRY_MS   = 10 * 1000;
const MAX_RETRY  = 5;

// Destinos que permanecem visíveis na escala, mas não entram na estatística de equidade.
const SKIP = new Set([
  "FERIAS", "RECESSO", "RURAL", "HEMODIALISE",
  "MALOTE", "DISPONIVEL", "TRANSITO", "TRÂNSITO", "CANCELADA"
]);

// Destinos ignorados nos KPIs gerais de viagens convencionais.
const SKIP_KPI = new Set([
  "RURAL", "HEMODIALISE", "MALOTE", "DISPONIVEL",
  "TRANSITO", "TRÂNSITO", "FERIAS", "RECESSO", "CANCELADA"
]);

// Apenas para o indicador operacional "Em serviço".
const SKIP_SERVICO = new Set([
  "DISPONIVEL", "FERIAS", "RECESSO", "CANCELADA"
]);

const COLORS = [
  "#0a7c55", "#1a5fa8", "#b07800", "#7a3fa8",
  "#c0283e", "#0e7a8a", "#5a7a20", "#a05800",
  "#1a6fa8", "#0a6644", "#884020", "#3a5fa8"
];

const CONFIG = {
  MES_LABEL: "AGOSTO 2026",
  INICIO: "06/08/2026",
  FIM: "05/09/2026",

  MOTORISTAS: [
    { NOME:"COSME",        FONE:"99677-0467", PLACA:"SYX-9F79", ESCALA:"6:P2 10:P1 14:P2 18:P1 22:P2 26:P1 30:P2 3:P1" },
    { NOME:"SILVIO",       FONE:"99644-7196", PLACA:"TEA-4A97", ESCALA:"6:P1 10:P2 14:P1 18:P2 22:P1 26:P2 30:P1 3:P2" },
    { NOME:"PAULO GAIOLA", FONE:"99957-2433", PLACA:"RWB-4G28", ESCALA:"7:P1 11:P2 15:P3 19:P1 23:P2 27:P3 31:P1 4:P2" },
    { NOME:"IVO LEAL",     FONE:"99697-3163", PLACA:"RWA-0J92", ESCALA:"7:P2 11:P3 15:P1 19:P2 23:P3 27:P1 31:P2 1-5:FERIAS" },
    { NOME:"ODAIR",        FONE:"99949-6233", PLACA:"QAU-4F33", ESCALA:"7:P3 11:P1 15:P2 19:P3 23:P1 27:P2 31:P3 4:P1" },
    { NOME:"EDIPO",        FONE:"99122-6035", PLACA:"TRX-2F71", ESCALA:"8:P1 12:P2 16:P3 20:P1 24:P2 28:P3 1:P1 5:P2" },
    { NOME:"PELKIN",       FONE:"99884-4437", PLACA:"SIL-9E23", ESCALA:"8:P3 12:P1 16:P2 20:P3 24:P1 28:P2 1:P3 5:P1" },
    { NOME:"ROMÁRIO",      FONE:"98139-4366", PLACA:"QAB-5799", ESCALA:"8:P2 12:P3 16:P1 20:P2 24:P3 28:P1 1:P2 5:P3" },
    { NOME:"EDMAR",        FONE:"99947-5310", PLACA:"RWH-0D64", ESCALA:"9:P2 13:P1 17:P2 21:P3 25:P1 29:P2 2:P3" },
    { NOME:"JOSE MANOEL",  FONE:"99265-1581", PLACA:"SID-7G71", ESCALA:"9:P1 13:P2 17:P1 21:P2 25:P3 29:P1 2:P2" },
    { NOME:"ROBSON",       FONE:"99641-7423", PLACA:"RWH-0D67", ESCALA:"6-18:FERIAS 21:P1 25:P2 29:P3 2:P1" }
  ],

  VEICULOS_UTI: "TRX-2F71 · RWA-0J92",
  FONE_TRANSPORTE: "99964-0675",

  REGRAS: {
    LIMITE_KM_APOS_14: 160,
    BLOQUEIA_ACIONAMENTO_APOS_19: true
  }
};
