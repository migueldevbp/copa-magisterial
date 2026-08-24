/**
 * Copa Magisterial 2026 — IES Pasco
 *
 * BACKEND Google Sheets:
 * 1) Lectura pública: GOOGLE_SHEET_ID + GOOGLE_API_KEY
 * 2) Escritura operadores: APPS_SCRIPT_URL + APPS_SCRIPT_TOKEN
 *
 * Guía: docs/GOOGLE-SHEETS.md
 */
const CONFIG = {
  /* ——— Google Sheets (lectura) ——— */
  GOOGLE_SHEET_ID: '1LghhmNhPE6Kad1DC48IG0pBtFgIbMGGxWmOCdmFplIY',
  GOOGLE_API_KEY: 'AIzaSyAzWI6xVvNIU5cx-WSBf2a9S7dUL3a_Sy8',

  /* ——— Apps Script (escritura / sync admin) ——— */
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw5aWHZ8wYmO21CXgUmkh0ZVbCmHuxwdFuzWpxFIptIoZnDk5REG9MVkjClgxblg_Bg/exec',
  APPS_SCRIPT_TOKEN: 'iespasco-sync-2026',

  /** Si true y Sheets está configurado, el público lee siempre desde Sheets */
  PREFERIR_SHEETS: true,

  HOJAS: {
    equipos: 'Equipos',
    fixture: 'Fixture',
    resultados: 'Resultados',
    jugadores: 'Jugadores',
    llave: 'Llave',
    config: 'Config',
    delegados: 'Delegados',
    reclamos: 'Reclamos',
    pendientes: 'Pendientes',
  },

  DELEGADO_SESSION_KEY: 'copa_magisterial_delegado_session',

  ACTUALIZAR_CADA: 5000,

  TORNEO_NOMBRE: 'Copa Magisterial 2026',
  TORNEO_INSTITUCION: 'IES Pasco',
  TORNEO_ESLOGAN: 'Por una educación de calidad',
  TORNEO_LOGO: 'img/logo-copa-magisterial.png',
  INSTITUCION_LOGO: 'img/logo-ies-pasco.png',
  TORNEO_FINALIZADO: false,

  ADMIN_PASSWORD: 'iespasco2026',
  ADMIN_SESSION_KEY: 'copa_magisterial_2026_auth',
  DATA_STORE_KEY: 'copa_magisterial_2026_store',

  CACHE_TTL: 4000,
  CACHE_KEY: 'copa_magisterial_2026_cache',

  COLORES: {
    navy: '#0D1B3E',
    red: '#D32F2F',
    sun: '#FFEB3B',
    lider: '#1B5E20',
    promedio: '#F9A825',
    descendencia: '#D32F2F',
    neutral: '#E8EAF0',
    enJuego: '#D32F2F',
    proximo: '#0D1B3E',
    finalizado: '#546E7A',
  },

  ZONA_ELIMINACION: 2,
};
