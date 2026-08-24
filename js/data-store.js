/**
 * Almacén local del torneo (operadores).
 * Hasta conectar Google Sheets, esta es la fuente de verdad editable.
 * También sirve para publicar vía data/torneo.json en el repo.
 */
const DataStore = (() => {
  const KEY = () => CONFIG.DATA_STORE_KEY || 'copa_magisterial_2026_store';
  const AUTH_KEY = () => CONFIG.ADMIN_SESSION_KEY || 'copa_magisterial_2026_auth';

  function emptyBundle() {
    return {
      version: 1,
      updatedAt: null,
      torneoFinalizado: Boolean(CONFIG.TORNEO_FINALIZADO),
      equipos: [],
      fixture: [],
      resultados: [],
      jugadores: [],
      llave: typeof Llave !== 'undefined' ? Llave.emptyLlave() : { activa: false, tamaño: 16, partidos: [] },
      reclamos: [],
      pendientes: [],
      delegados: [],
      source: 'local',
      demo: false,
    };
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeBundle(raw) {
    const base = emptyBundle();
    if (!raw || typeof raw !== 'object') return base;

    const equipos = Array.isArray(raw.equipos) ? raw.equipos.map(mapEquipo) : [];
    const fixture = Array.isArray(raw.fixture) ? raw.fixture.map(mapFixture) : [];
    const resultados = Array.isArray(raw.resultados) ? raw.resultados.map(mapResultado) : [];
    const jugadores = Array.isArray(raw.jugadores) ? raw.jugadores.map(mapJugador) : [];
    const llave =
      typeof Llave !== 'undefined'
        ? Llave.normalize(raw.llave)
        : raw.llave || { activa: false, tamaño: 16, partidos: [] };
    const reclamos = Array.isArray(raw.reclamos) ? raw.reclamos.map(mapReclamo) : [];
    const pendientes = Array.isArray(raw.pendientes) ? raw.pendientes.map(mapPendiente) : [];
    const delegados = Array.isArray(raw.delegados) ? raw.delegados.map(mapDelegado) : [];

    return {
      version: raw.version || 1,
      updatedAt: raw.updatedAt || null,
      torneoFinalizado: Boolean(raw.torneoFinalizado ?? CONFIG.TORNEO_FINALIZADO),
      equipos,
      fixture,
      resultados,
      jugadores,
      llave,
      reclamos,
      pendientes,
      delegados,
      source: raw.source || 'local',
      demo: false,
    };
  }

  function mapEquipo(e) {
    return {
      id: String(e.id ?? e.ID ?? '').trim(),
      nombre: String(e.nombre ?? e.Nombre ?? '').trim(),
      colegio: String(e.colegio ?? e.Colegio ?? '').trim(),
      grupo: String(e.grupo ?? e.Grupo ?? '').trim(),
      color: String(e.color ?? e.Color ?? '#0D1B3E').trim() || '#0D1B3E',
      logo: String(e.logo ?? e.Logo_URL ?? e.Logo ?? '').trim(),
    };
  }

  function mapFixture(p) {
    return {
      id: String(p.id ?? p.ID ?? '').trim(),
      fecha: String(p.fecha ?? p.Fecha ?? '').trim(),
      hora: String(p.hora ?? p.Hora ?? '').trim(),
      equipoAId: String(p.equipoAId ?? p.Equipo_A_ID ?? '').trim(),
      equipoBId: String(p.equipoBId ?? p.Equipo_B_ID ?? '').trim(),
      cancha: String(p.cancha ?? p.Cancha ?? '').trim(),
      estado: normalizarEstado(p.estado ?? p.Estado ?? 'Próximo'),
    };
  }

  function mapResultado(r) {
    const aprobadoRaw = r.aprobado ?? r.Aprobado;
    let aprobado = true;
    if (aprobadoRaw !== undefined && aprobadoRaw !== null && String(aprobadoRaw).trim() !== '') {
      aprobado =
        typeof aprobadoRaw === 'boolean'
          ? aprobadoRaw
          : String(aprobadoRaw).toUpperCase() === 'SI' || String(aprobadoRaw) === 'true';
    }
    return {
      partidoId: String(r.partidoId ?? r.Partido_ID ?? '').trim(),
      golesA: Number(r.golesA ?? r.Goles_A ?? 0) || 0,
      golesB: Number(r.golesB ?? r.Goles_B ?? 0) || 0,
      aprobado,
      goleadoresA: String(r.goleadoresA ?? r.Goleadores_A ?? '').trim(),
      goleadoresB: String(r.goleadoresB ?? r.Goleadores_B ?? '').trim(),
      tarjetasA: String(r.tarjetasA ?? r.Tarjetas_A ?? '').trim(),
      tarjetasB: String(r.tarjetasB ?? r.Tarjetas_B ?? '').trim(),
    };
  }

  function mapJugador(j) {
    return {
      id: String(j.id ?? j.ID ?? `${j.equipoId || j.Equipo_ID}-${j.dni || j.DNI || j.numero || j.Numero || Date.now()}`).trim(),
      equipoId: String(j.equipoId ?? j.Equipo_ID ?? '').trim(),
      nombre: String(j.nombre ?? j.Nombre ?? '').trim(),
      apellido: String(j.apellido ?? j.Apellido ?? '').trim(),
      dni: String(j.dni ?? j.DNI ?? '').trim(),
      posicion: String(j.posicion ?? j.Posicion ?? j.Posición ?? '').trim(),
      numero: String(j.numero ?? j.Numero ?? j.Número ?? '').trim(),
      goles: Number(j.goles ?? j.Goles ?? 0) || 0,
      tarjetasA: Number(j.tarjetasA ?? j.Tarjetas_A ?? 0) || 0,
      tarjetasR: Number(j.tarjetasR ?? j.Tarjetas_R ?? 0) || 0,
    };
  }

  function mapReclamo(r) {
    return {
      id: String(r.id ?? r.ID ?? '').trim(),
      equipoId: String(r.equipoId ?? r.Equipo_ID ?? '').trim(),
      fecha: String(r.fecha ?? r.Fecha ?? '').trim(),
      asunto: String(r.asunto ?? r.Asunto ?? '').trim(),
      detalle: String(r.detalle ?? r.Detalle ?? '').trim(),
      estado: String(r.estado ?? r.Estado ?? 'Pendiente').trim() || 'Pendiente',
      respuesta: String(r.respuesta ?? r.Respuesta ?? '').trim(),
      fechaRespuesta: String(r.fechaRespuesta ?? r.Fecha_Respuesta ?? '').trim(),
    };
  }

  function mapPendiente(p) {
    return {
      id: String(p.id ?? p.ID ?? '').trim(),
      equipoId: String(p.equipoId ?? p.Equipo_ID ?? '').trim(),
      concepto: String(p.concepto ?? p.Concepto ?? '').trim(),
      monto: String(p.monto ?? p.Monto ?? '').trim(),
      vencimiento: String(p.vencimiento ?? p.Vencimiento ?? '').trim(),
      estado: String(p.estado ?? p.Estado ?? 'Pendiente').trim() || 'Pendiente',
      nota: String(p.nota ?? p.Nota ?? '').trim(),
    };
  }

  function mapDelegado(d) {
    return {
      equipoId: String(d.equipoId ?? d.Equipo_ID ?? '').trim(),
      clave: String(d.clave ?? d.Clave ?? '').trim(),
      nombre: String(d.nombre ?? d.Nombre ?? '').trim(),
      telefono: String(d.telefono ?? d.Telefono ?? '').trim(),
    };
  }

  function normalizarEstado(estado) {
    const e = String(estado || '').trim().toLowerCase();
    if (e.includes('juego') || e === 'live') return 'En Juego';
    if (e.includes('final') || e === 'ft') return 'Finalizado';
    return 'Próximo';
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY());
      if (!raw) return null;
      return normalizeBundle(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function saveLocal(bundle) {
    const data = normalizeBundle(bundle);
    data.updatedAt = new Date().toISOString();
    data.source = 'local';
    data.demo = false;
    localStorage.setItem(KEY(), JSON.stringify(data));
    return data;
  }

  function clearLocal() {
    localStorage.removeItem(KEY());
  }

  function hasLocalData() {
    const b = loadLocal();
    return Boolean(b && (b.equipos.length || b.fixture.length || b.jugadores.length));
  }

  async function loadPublishedJson() {
    try {
      const res = await fetch(`data/torneo.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      const bundle = normalizeBundle(json);
      if (!bundle.equipos.length && !bundle.fixture.length) return null;
      bundle.source = 'json';
      return bundle;
    } catch {
      return null;
    }
  }

  function toPublicPayload(bundle) {
    const b = normalizeBundle(bundle);
    return {
      equipos: b.equipos,
      fixture: b.fixture,
      resultados: b.resultados,
      jugadores: b.jugadores,
      llave: b.llave,
      reclamos: b.reclamos,
      pendientes: b.pendientes,
      /* no exponer claves de delegados al dashboard público */
      demo: false,
      source: b.source,
      torneoFinalizado: b.torneoFinalizado,
      updatedAt: b.updatedAt,
    };
  }

  function nextId(items, field = 'id') {
    const nums = items
      .map((x) => parseInt(String(x[field]), 10))
      .filter((n) => !Number.isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1);
  }

  function exportJson(bundle) {
    const data = normalizeBundle(bundle);
    data.updatedAt = new Date().toISOString();
    return JSON.stringify(data, null, 2);
  }

  function downloadText(filename, text, mime = 'application/json') {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toCsvValue(v) {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function exportCsvSheets(bundle) {
    const b = normalizeBundle(bundle);
    const sheets = {
      Equipos: [
        ['ID', 'Nombre', 'Colegio', 'Grupo', 'Color', 'Logo_URL'],
        ...b.equipos.map((e) => [e.id, e.nombre, e.colegio, e.grupo, e.color, e.logo]),
      ],
      Fixture: [
        ['ID', 'Fecha', 'Hora', 'Equipo_A_ID', 'Equipo_B_ID', 'Cancha', 'Estado'],
        ...b.fixture.map((p) => [p.id, p.fecha, p.hora, p.equipoAId, p.equipoBId, p.cancha, p.estado]),
      ],
      Resultados: [
        ['Partido_ID', 'Goles_A', 'Goles_B', 'Aprobado', 'Goleadores_A', 'Goleadores_B', 'Tarjetas_A', 'Tarjetas_B'],
        ...b.resultados.map((r) => [
          r.partidoId,
          r.golesA,
          r.golesB,
          r.aprobado ? 'SI' : 'NO',
          r.goleadoresA,
          r.goleadoresB,
          r.tarjetasA,
          r.tarjetasB,
        ]),
      ],
      Jugadores: [
        ['Equipo_ID', 'Nombre', 'Apellido', 'DNI', 'Posicion', 'Numero', 'Goles', 'Tarjetas_A', 'Tarjetas_R'],
        ...b.jugadores.map((j) => [
          j.equipoId,
          j.nombre,
          j.apellido,
          j.dni,
          j.posicion,
          j.numero,
          j.goles,
          j.tarjetasA,
          j.tarjetasR,
        ]),
      ],
      Llave: [
        ['ID', 'Ronda', 'Orden', 'Lado', 'Equipo_A_ID', 'Equipo_B_ID', 'Goles_A', 'Goles_B', 'Estado', 'Fecha', 'Hora', 'Cancha'],
        ...(b.llave?.partidos || []).map((p) => [
          p.id,
          p.ronda,
          p.orden,
          p.lado,
          p.equipoAId,
          p.equipoBId,
          p.golesA ?? '',
          p.golesB ?? '',
          p.estado,
          p.fecha,
          p.hora,
          p.cancha,
        ]),
      ],
    };

    Object.entries(sheets).forEach(([name, rows]) => {
      const csv = rows.map((row) => row.map(toCsvValue).join(',')).join('\n');
      downloadText(`CopaMagisterial_${name}.csv`, csv, 'text/csv');
    });
  }

  function isAuthenticated() {
    try {
      return sessionStorage.getItem(AUTH_KEY()) === '1';
    } catch {
      return false;
    }
  }

  function login(password) {
    const expected = String(CONFIG.ADMIN_PASSWORD || 'iespasco2026');
    if (String(password) !== expected) return false;
    sessionStorage.setItem(AUTH_KEY(), '1');
    return true;
  }

  function logout() {
    sessionStorage.removeItem(AUTH_KEY());
  }

  return {
    emptyBundle,
    normalizeBundle,
    loadLocal,
    saveLocal,
    clearLocal,
    hasLocalData,
    loadPublishedJson,
    toPublicPayload,
    nextId,
    exportJson,
    downloadText,
    exportCsvSheets,
    isAuthenticated,
    login,
    logout,
    clone,
    mapEquipo,
    mapFixture,
    mapResultado,
    mapJugador,
    mapReclamo,
    mapPendiente,
    mapDelegado,
  };
})();
