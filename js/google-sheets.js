/**
 * Google Sheets API v4 (lectura) + Apps Script (escritura/sync).
 */
const GoogleSheets = (() => {
  function sheetNames() {
    return {
      equipos: CONFIG.HOJAS.equipos || 'Equipos',
      fixture: CONFIG.HOJAS.fixture || 'Fixture',
      resultados: CONFIG.HOJAS.resultados || 'Resultados',
      jugadores: CONFIG.HOJAS.jugadores || 'Jugadores',
      llave: CONFIG.HOJAS.llave || 'Llave',
      config: CONFIG.HOJAS.config || 'Config',
    };
  }

  function isConfigured() {
    return Boolean(CONFIG.GOOGLE_SHEET_ID && CONFIG.GOOGLE_API_KEY && CONFIG.PREFERIR_SHEETS !== false);
  }

  function isWriteConfigured() {
    return Boolean(CONFIG.APPS_SCRIPT_URL && CONFIG.APPS_SCRIPT_TOKEN);
  }

  function rowsToObjects(values) {
    if (!values || values.length < 2) return [];
    const headers = values[0].map((h) => String(h).trim());
    return values
      .slice(1)
      .filter((row) => row.some((c) => String(c || '').trim() !== ''))
      .map((row) => {
        const obj = {};
        headers.forEach((key, i) => {
          obj[key] = row[i] !== undefined ? String(row[i]).trim() : '';
        });
        return obj;
      });
  }

  function normalizeEquipo(r) {
    return {
      id: String(r.ID || r.Id || r.id || ''),
      nombre: r.Nombre || r.nombre || '',
      colegio: r.Colegio || r.colegio || '',
      grupo: r.Grupo || r.grupo || '',
      color: r.Color || r.color || '#0D1B3E',
      logo: r.Logo_URL || r.Logo || r.logo || '',
    };
  }

  function normalizeFixture(r) {
    return {
      id: String(r.ID || r.Id || r.id || ''),
      fecha: r.Fecha || r.fecha || '',
      hora: r.Hora || r.hora || '',
      equipoAId: String(r.Equipo_A_ID || r.EquipoA || ''),
      equipoBId: String(r.Equipo_B_ID || r.EquipoB || ''),
      cancha: r.Cancha || r.cancha || '',
      estado: normalizarEstado(r.Estado || r.estado || 'Próximo'),
    };
  }

  function normalizeResultado(r) {
    return {
      partidoId: String(r.Partido_ID || r.PartidoId || r.ID || ''),
      golesA: parseInt(r.Goles_A || r.GolesA || '0', 10) || 0,
      golesB: parseInt(r.Goles_B || r.GolesB || '0', 10) || 0,
      aprobado: String(r.Aprobado || '').toUpperCase() === 'SI',
      goleadoresA: r.Goleadores_A || r.GoleadoresA || '',
      goleadoresB: r.Goleadores_B || r.GoleadoresB || '',
      tarjetasA: r.Tarjetas_A || r.TarjetasA || '',
      tarjetasB: r.Tarjetas_B || r.TarjetasB || '',
    };
  }

  function normalizeJugador(r) {
    return {
      id: String(r.ID || r.id || `${r.Equipo_ID || r.EquipoId}-${r.DNI || r.Numero || ''}`),
      equipoId: String(r.Equipo_ID || r.EquipoId || ''),
      nombre: r.Nombre || '',
      apellido: r.Apellido || '',
      dni: r.DNI || r.Dni || '',
      posicion: r.Posicion || r.Posición || '',
      numero: r.Numero || r.Número || '',
      goles: parseInt(r.Goles || '0', 10) || 0,
      tarjetasA: parseInt(r.Tarjetas_A || r.TarjetasA || '0', 10) || 0,
      tarjetasR: parseInt(r.Tarjetas_R || r.TarjetasR || '0', 10) || 0,
    };
  }

  function normalizarEstado(estado) {
    const e = String(estado).trim().toLowerCase();
    if (e.includes('juego') || e === 'live') return 'En Juego';
    if (e.includes('final') || e === 'ft') return 'Finalizado';
    return 'Próximo';
  }

  function configToMap(rows) {
    const map = {};
    (rows || []).forEach((r) => {
      const k = r.Clave || r.clave || r.Key;
      const v = r.Valor || r.valor || r.Value;
      if (k) map[String(k).trim()] = String(v ?? '').trim();
    });
    return map;
  }

  function parseLlaveFromSheets(llaveRows, cfgMap) {
    const activa = String(cfgMap.LLAVE_ACTIVA || '').toUpperCase() === 'SI';
    const tamaño = Number(cfgMap.LLAVE_TAMANO) === 8 ? 8 : 16;
    const partidos = (llaveRows || []).map((r) => {
      if (typeof Llave !== 'undefined') {
        return Llave.mapPartido({
          id: r.ID || r.id,
          ronda: r.Ronda || r.ronda,
          orden: r.Orden || r.orden,
          lado: r.Lado || r.lado,
          equipoAId: r.Equipo_A_ID,
          equipoBId: r.Equipo_B_ID,
          golesA: r.Goles_A === '' ? null : r.Goles_A,
          golesB: r.Goles_B === '' ? null : r.Goles_B,
          estado: r.Estado,
          fecha: r.Fecha,
          hora: r.Hora,
          cancha: r.Cancha,
        });
      }
      return r;
    });

    let llave = { activa, tamaño, partidos };
    if (typeof Llave !== 'undefined') {
      llave = Llave.normalize(llave);
      if (activa && !llave.partidos.length) {
        llave = Llave.crearEstructura(tamaño);
      } else if (activa) {
        llave = Llave.propagarGanadores(llave);
      }
    }
    return llave;
  }

  function parsePayload(raw, { allowEmpty = false } = {}) {
    const equipos = (raw.equipos || []).map(normalizeEquipo).filter((e) => e.id && e.nombre);
    const fixture = (raw.fixture || []).map(normalizeFixture).filter((p) => p.id);
    const resultados = (raw.resultados || []).map(normalizeResultado).filter((r) => r.partidoId);
    const jugadores = (raw.jugadores || []).map(normalizeJugador).filter((j) => j.equipoId && j.nombre);

    if (!allowEmpty && !equipos.length) {
      throw new Error('No hay equipos válidos en Google Sheets. Revisá la hoja Equipos.');
    }

    const cfgMap = raw.configMap || configToMap(raw.config || []);
    const torneoFinalizado =
      raw.torneoFinalizado === true ||
      String(cfgMap.TORNEO_FINALIZADO || '').toUpperCase() === 'SI';

    let llave;
    if (raw.llave && raw.llave.partidos) {
      llave =
        typeof Llave !== 'undefined' ? Llave.normalize(raw.llave) : raw.llave;
      if (cfgMap.LLAVE_ACTIVA) {
        llave.activa = String(cfgMap.LLAVE_ACTIVA).toUpperCase() === 'SI';
      }
    } else {
      llave = parseLlaveFromSheets(raw.llaveRows || raw.llave || [], cfgMap);
    }

    if (torneoFinalizado) CONFIG.TORNEO_FINALIZADO = true;

    const reclamos = Array.isArray(raw.reclamos)
      ? raw.reclamos.map((r) =>
          typeof DataStore !== 'undefined' ? DataStore.mapReclamo(r) : r
        )
      : [];
    const pendientes = Array.isArray(raw.pendientes)
      ? raw.pendientes.map((p) =>
          typeof DataStore !== 'undefined' ? DataStore.mapPendiente(p) : p
        )
      : [];
    const delegados = Array.isArray(raw.delegados)
      ? raw.delegados.map((d) =>
          typeof DataStore !== 'undefined' ? DataStore.mapDelegado(d) : d
        )
      : [];

    return {
      equipos,
      fixture,
      resultados,
      jugadores,
      llave,
      reclamos,
      pendientes,
      delegados,
      torneoFinalizado,
      demo: Boolean(raw.demo),
      source: raw.source || '',
    };
  }

  async function fetchViaApi() {
    const names = sheetNames();
    const ranges = [
      names.equipos,
      names.fixture,
      names.resultados,
      names.jugadores,
      names.llave,
      names.config,
    ]
      .map((n) => encodeURIComponent(n))
      .join('&ranges=');

    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.GOOGLE_SHEET_ID}` +
      `/values:batchGet?ranges=${ranges}&key=${CONFIG.GOOGLE_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Sheets API error ${res.status}`);
    }
    const data = await res.json();
    const valueRanges = data.valueRanges || [];

    return parsePayload({
      equipos: rowsToObjects(valueRanges[0]?.values),
      fixture: rowsToObjects(valueRanges[1]?.values),
      resultados: rowsToObjects(valueRanges[2]?.values),
      jugadores: rowsToObjects(valueRanges[3]?.values),
      llaveRows: rowsToObjects(valueRanges[4]?.values),
      config: rowsToObjects(valueRanges[5]?.values),
      source: 'sheets',
    });
  }

  function scriptUrl(action) {
    const base = String(CONFIG.APPS_SCRIPT_URL || '').replace(/\/$/, '');
    if (!base) throw new Error('Falta APPS_SCRIPT_URL en config.js');
    const sep = base.includes('?') ? '&' : '?';
    return action ? `${base}${sep}action=${encodeURIComponent(action)}` : base;
  }

  async function pingScript() {
    if (!isWriteConfigured()) throw new Error('Configurá APPS_SCRIPT_URL y APPS_SCRIPT_TOKEN');
    const url = scriptUrl('ping');
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.error || 'Ping falló');
    return data;
  }

  async function pullFromScript() {
    if (!isWriteConfigured()) throw new Error('Configurá APPS_SCRIPT_URL y APPS_SCRIPT_TOKEN');
    // POST read con token → incluye claves de delegados (solo admin)
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: CONFIG.APPS_SCRIPT_TOKEN,
        action: 'read',
      }),
    });
    const raw = await res.json();
    if (raw.ok === false) throw new Error(raw.error || 'Error al leer Apps Script');

    return parsePayload(
      {
        equipos: raw.equipos,
        fixture: raw.fixture,
        resultados: raw.resultados,
        jugadores: raw.jugadores,
        llave: raw.llave,
        reclamos: raw.reclamos,
        pendientes: raw.pendientes,
        delegados: raw.delegados,
        torneoFinalizado: raw.torneoFinalizado,
        configMap: {
          TORNEO_FINALIZADO: raw.torneoFinalizado ? 'SI' : 'NO',
          LLAVE_ACTIVA: raw.llave?.activa ? 'SI' : 'NO',
          LLAVE_TAMANO: String(raw.llave?.tamaño || 16),
        },
        source: 'sheets',
      },
      { allowEmpty: true }
    );
  }

  async function pushToScript(bundle) {
    if (!isWriteConfigured()) throw new Error('Configurá APPS_SCRIPT_URL y APPS_SCRIPT_TOKEN');

    const payload = {
      token: CONFIG.APPS_SCRIPT_TOKEN,
      action: 'write',
      torneoFinalizado: Boolean(bundle.torneoFinalizado),
      equipos: bundle.equipos || [],
      fixture: bundle.fixture || [],
      resultados: bundle.resultados || [],
      jugadores: bundle.jugadores || [],
      llave: bundle.llave || { activa: false, tamaño: 16, partidos: [] },
      reclamos: bundle.reclamos || [],
      pendientes: bundle.pendientes || [],
      delegados: bundle.delegados || [],
    };

    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.error || `Error al guardar (${res.status})`);
    // Si el POST redirigió a GET, Apps Script devuelve el bundle público (ok:true) sin escribir
    if (data.kind !== 'write' && !/guardados/i.test(String(data.message || ''))) {
      throw new Error(
        'No se confirmó la escritura. Actualizá Codigo.gs y desplegá Nueva versión; luego volvé a subir.'
      );
    }
    return data;
  }

  async function delegadoRequest(action, payload) {
    if (!CONFIG.APPS_SCRIPT_URL) throw new Error('Falta APPS_SCRIPT_URL');
    const equipoId = String(payload.equipoId || '').trim();
    const clave = String(payload.clave || '').trim();

    const fileHint =
      typeof location !== 'undefined' && location.protocol === 'file:'
        ? ' Abrí con http://localhost (no file://), p. ej. python -m http.server 8080'
        : '';

    function interpret(data) {
      if (!data || data.ok === false) {
        let msg = (data && data.error) || 'Error en portal delegado';
        if (/Acción desconocida|Token inválido/i.test(msg)) {
          msg =
            'Apps Script desactualizado (Token inválido). ' +
            'En script.google.com pegá Codigo.gs → Implementar → Administrar implementaciones → ' +
            'lápiz → Nueva versión → Implementar. Luego en admin: Probar Apps Script (debe decir versión …delegados-v3).';
        } else if (/Clave incorrecta|sin acceso/i.test(msg)) {
          msg +=
            ' · En admin: Preparar hojas → guardar acceso Delegados → ↑ Subir a Sheets. En el Sheet debe existir la pestaña Delegados.';
        }
        throw new Error(msg);
      }
      if (action === 'reclamo_crear') {
        if (data.kind === 'reclamo' || data.id || data.message) return data;
        return null;
      }
      if (data.equipo || data.kind === 'delegado') return data;
      return null;
    }

    // GET primero: el POST de Apps Script a menudo pierde el body (Token inválido / lectura pública)
    const q = new URLSearchParams({
      action,
      equipoId,
      clave,
      asunto: String(payload.asunto || ''),
      detalle: String(payload.detalle || ''),
    });
    let res;
    try {
      res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?${q.toString()}`, {
        method: 'GET',
        redirect: 'follow',
      });
    } catch (err) {
      throw new Error(`No se pudo conectar con el servidor.${fileHint}`);
    }
    let data = await res.json().catch(() => ({}));
    let okData = interpret(data);
    if (okData) return okData;

    // Si GET devolvió el bundle público (script viejo), el error es de deploy
    if (data && data.ok && Array.isArray(data.equipos) && !data.equipo) {
      throw new Error(
        'Apps Script sin login de delegados. Pegá Codigo.gs completo y desplegá Nueva versión. ' +
          'En admin → Probar Apps Script debe mostrar: 2026-08-24-delegados-v3'
      );
    }

    // Reintento POST por si el GET no estaba habilitado pero el POST sí
    try {
      res = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload, equipoId, clave }),
      });
    } catch (err) {
      throw new Error(`No se pudo conectar con el servidor.${fileHint}`);
    }
    data = await res.json().catch(() => ({}));
    okData = interpret(data);
    if (okData) return okData;
    if (data && data.ok === false) interpret(data); // lanza con mensaje claro
    throw new Error(
      'No se pudo iniciar sesión. Actualizá y redesplegá Codigo.gs (versión delegados-v3).' + fileHint
    );
  }

  async function setupViaScript() {
    if (!isWriteConfigured()) throw new Error('Configurá APPS_SCRIPT_URL y APPS_SCRIPT_TOKEN');
    // GET es más fiable que POST con Apps Script (redirects)
    const q = new URLSearchParams({
      action: 'setup',
      token: CONFIG.APPS_SCRIPT_TOKEN,
    });
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?${q.toString()}`, {
      method: 'GET',
      redirect: 'follow',
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.error || 'No se pudo preparar el Sheet');
    return data;
  }

  function statusInfo() {
    return {
      lectura: isConfigured(),
      escritura: isWriteConfigured(),
      sheetId: CONFIG.GOOGLE_SHEET_ID || null,
      hasApiKey: Boolean(CONFIG.GOOGLE_API_KEY),
      hasScript: Boolean(CONFIG.APPS_SCRIPT_URL),
    };
  }

  function getDemoData() {
    const data = parsePayload({
      demo: true,
      equipos: [
        { ID: '1', Nombre: 'Colegio San Juan A', Colegio: 'Colegio San Juan', Grupo: 'A', Color: '#C62828', Logo_URL: '' },
        { ID: '2', Nombre: 'Colegio San Juan B', Colegio: 'Colegio San Juan', Grupo: 'A', Color: '#1565C0', Logo_URL: '' },
        { ID: '3', Nombre: 'Instituto Norte', Colegio: 'Instituto Norte', Grupo: 'A', Color: '#1B5E20', Logo_URL: '' },
        { ID: '4', Nombre: 'Escuela del Sur', Colegio: 'Escuela del Sur', Grupo: 'A', Color: '#F9A825', Logo_URL: '' },
        { ID: '5', Nombre: 'Liceo Central', Colegio: 'Liceo Central', Grupo: 'B', Color: '#D32F2F', Logo_URL: '' },
        { ID: '6', Nombre: 'Colegio Andes', Colegio: 'Colegio Andes', Grupo: 'B', Color: '#0D1B3E', Logo_URL: '' },
        { ID: '7', Nombre: 'Escuela Rivadavia', Colegio: 'Escuela Rivadavia', Grupo: 'B', Color: '#E65100', Logo_URL: '' },
        { ID: '8', Nombre: 'Instituto Pacífico', Colegio: 'Instituto Pacífico', Grupo: 'B', Color: '#37474F', Logo_URL: '' },
      ],
      fixture: [
        { ID: '1', Fecha: '2026-09-01', Hora: '09:00', Equipo_A_ID: '1', Equipo_B_ID: '2', Cancha: 'Campo A', Estado: 'Finalizado' },
        { ID: '2', Fecha: '2026-09-01', Hora: '10:00', Equipo_A_ID: '3', Equipo_B_ID: '4', Cancha: 'Campo B', Estado: 'Finalizado' },
        { ID: '3', Fecha: '2026-09-01', Hora: '11:00', Equipo_A_ID: '5', Equipo_B_ID: '6', Cancha: 'Campo A', Estado: 'Finalizado' },
        { ID: '4', Fecha: '2026-09-01', Hora: '12:00', Equipo_A_ID: '7', Equipo_B_ID: '8', Cancha: 'Campo B', Estado: 'Finalizado' },
        { ID: '5', Fecha: '2026-09-02', Hora: '09:00', Equipo_A_ID: '1', Equipo_B_ID: '3', Cancha: 'Campo A', Estado: 'Finalizado' },
        { ID: '6', Fecha: '2026-09-02', Hora: '10:00', Equipo_A_ID: '2', Equipo_B_ID: '4', Cancha: 'Campo B', Estado: 'En Juego' },
        { ID: '7', Fecha: '2026-09-02', Hora: '11:00', Equipo_A_ID: '5', Equipo_B_ID: '7', Cancha: 'Campo A', Estado: 'Próximo' },
        { ID: '8', Fecha: '2026-09-02', Hora: '12:00', Equipo_A_ID: '6', Equipo_B_ID: '8', Cancha: 'Campo B', Estado: 'Próximo' },
        { ID: '9', Fecha: '2026-09-03', Hora: '14:00', Equipo_A_ID: '1', Equipo_B_ID: '4', Cancha: 'Campo A', Estado: 'Próximo' },
        { ID: '10', Fecha: '2026-09-03', Hora: '15:00', Equipo_A_ID: '2', Equipo_B_ID: '3', Cancha: 'Campo B', Estado: 'Próximo' },
      ],
      resultados: [
        { Partido_ID: '1', Goles_A: '3', Goles_B: '2', Aprobado: 'SI', Goleadores_A: 'Juan(2), Pedro(1)', Goleadores_B: 'Mario(2)', Tarjetas_A: 'Carlos(A), Luis(R)', Tarjetas_B: '-' },
        { Partido_ID: '2', Goles_A: '1', Goles_B: '1', Aprobado: 'SI', Goleadores_A: 'Ana(1)', Goleadores_B: 'Sofía(1)', Tarjetas_A: '-', Tarjetas_B: 'Diego(A)' },
        { Partido_ID: '3', Goles_A: '2', Goles_B: '0', Aprobado: 'SI', Goleadores_A: 'Tomás(2)', Goleadores_B: '-', Tarjetas_A: '-', Tarjetas_B: '-' },
        { Partido_ID: '4', Goles_A: '0', Goles_B: '2', Aprobado: 'SI', Goleadores_A: '-', Goleadores_B: 'Lucía(1), Nico(1)', Tarjetas_A: 'Martín(A)', Tarjetas_B: '-' },
        { Partido_ID: '5', Goles_A: '1', Goles_B: '0', Aprobado: 'SI', Goleadores_A: 'Juan(1)', Goleadores_B: '-', Tarjetas_A: '-', Tarjetas_B: 'Ana(A)' },
        { Partido_ID: '6', Goles_A: '1', Goles_B: '1', Aprobado: 'SI', Goleadores_A: 'Pedro(1)', Goleadores_B: 'Sofía(1)', Tarjetas_A: '-', Tarjetas_B: '-' },
      ],
      jugadores: [
        { Equipo_ID: '1', Nombre: 'Juan', Apellido: 'Pérez', DNI: '12345678', Posicion: 'Delantero', Numero: '9', Goles: '5', Tarjetas_A: '1', Tarjetas_R: '0' },
        { Equipo_ID: '1', Nombre: 'Pedro', Apellido: 'García', DNI: '12345679', Posicion: 'Mediocampista', Numero: '8', Goles: '2', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '1', Nombre: 'Carlos', Apellido: 'López', DNI: '87654321', Posicion: 'Portero', Numero: '1', Goles: '0', Tarjetas_A: '1', Tarjetas_R: '0' },
        { Equipo_ID: '1', Nombre: 'Luis', Apellido: 'Ruiz', DNI: '11223344', Posicion: 'Defensa', Numero: '4', Goles: '0', Tarjetas_A: '0', Tarjetas_R: '1' },
        { Equipo_ID: '2', Nombre: 'Mario', Apellido: 'Díaz', DNI: '22334455', Posicion: 'Delantero', Numero: '10', Goles: '3', Tarjetas_A: '1', Tarjetas_R: '0' },
        { Equipo_ID: '2', Nombre: 'Andrés', Apellido: 'Vega', DNI: '33445566', Posicion: 'Portero', Numero: '1', Goles: '0', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '3', Nombre: 'Ana', Apellido: 'Martínez', DNI: '44556677', Posicion: 'Delantera', Numero: '7', Goles: '2', Tarjetas_A: '1', Tarjetas_R: '0' },
        { Equipo_ID: '3', Nombre: 'Pablo', Apellido: 'Soto', DNI: '55667788', Posicion: 'Portero', Numero: '1', Goles: '0', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '4', Nombre: 'Sofía', Apellido: 'Ramos', DNI: '66778899', Posicion: 'Delantera', Numero: '11', Goles: '3', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '4', Nombre: 'Elena', Apellido: 'Cruz', DNI: '77889900', Posicion: 'Portera', Numero: '1', Goles: '0', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '5', Nombre: 'Tomás', Apellido: 'Herrera', DNI: '88990011', Posicion: 'Delantero', Numero: '9', Goles: '4', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '5', Nombre: 'Iván', Apellido: 'Mora', DNI: '99001122', Posicion: 'Portero', Numero: '1', Goles: '0', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '6', Nombre: 'Diego', Apellido: 'Castro', DNI: '10111213', Posicion: 'Mediocampista', Numero: '6', Goles: '1', Tarjetas_A: '1', Tarjetas_R: '0' },
        { Equipo_ID: '6', Nombre: 'Bruno', Apellido: 'Silva', DNI: '12131415', Posicion: 'Portero', Numero: '1', Goles: '0', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '7', Nombre: 'Martín', Apellido: 'Ortiz', DNI: '14151617', Posicion: 'Defensa', Numero: '5', Goles: '0', Tarjetas_A: '2', Tarjetas_R: '0' },
        { Equipo_ID: '7', Nombre: 'Julián', Apellido: 'Peña', DNI: '16171819', Posicion: 'Portero', Numero: '1', Goles: '0', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '8', Nombre: 'Lucía', Apellido: 'Navarro', DNI: '18192021', Posicion: 'Delantera', Numero: '9', Goles: '2', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '8', Nombre: 'Nico', Apellido: 'Blanco', DNI: '20212223', Posicion: 'Mediocampista', Numero: '8', Goles: '1', Tarjetas_A: '0', Tarjetas_R: '0' },
        { Equipo_ID: '8', Nombre: 'Camila', Apellido: 'Reyes', DNI: '22232425', Posicion: 'Portera', Numero: '1', Goles: '0', Tarjetas_A: '0', Tarjetas_R: '0' },
      ],
    });

    if (typeof Llave !== 'undefined') {
      const llave = Llave.crearEstructura(8);
      const ids = data.equipos.map((e) => e.id);
      const cuartos = llave.partidos.filter((p) => p.ronda === 'cuartos').sort((a, b) => a.orden - b.orden);
      cuartos.forEach((p, i) => {
        p.equipoAId = ids[i * 2] || '';
        p.equipoBId = ids[i * 2 + 1] || '';
      });
      cuartos.slice(0, 2).forEach((p) => {
        if (p.equipoAId && p.equipoBId) {
          p.golesA = 2;
          p.golesB = 0;
          p.estado = 'Finalizado';
        }
      });
      data.llave = Llave.propagarGanadores(llave);
    }
    return data;
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CONFIG.CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.data || !parsed?.ts) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(
        CONFIG.CACHE_KEY,
        JSON.stringify({ ts: Date.now(), fingerprint: fingerprint(data), data })
      );
    } catch {
      /* ignore */
    }
  }

  function fingerprint(data) {
    return JSON.stringify({
      e: data.equipos?.length,
      f: data.fixture,
      r: data.resultados,
      j: data.jugadores?.map((x) => [x.dni, x.goles, x.tarjetasA, x.tarjetasR]),
      l: data.llave,
      t: data.torneoFinalizado,
    });
  }

  async function cargarDatos({ force = false } = {}) {
    const cached = readCache();
    const freshEnough = cached && Date.now() - cached.ts < CONFIG.CACHE_TTL && !force;

    if (!navigator.onLine && cached) {
      return {
        data: cached.data,
        fromCache: true,
        changed: false,
        demo: cached.data.demo,
        source: cached.data.source || 'cache',
        offline: true,
      };
    }

    let data;
    let source = 'demo';

    try {
      if (isConfigured()) {
        data = await fetchViaApi();
        source = 'sheets';
        data.source = 'sheets';
        data.demo = false;
      } else if (typeof DataStore !== 'undefined' && DataStore.hasLocalData()) {
        data = DataStore.toPublicPayload(DataStore.loadLocal());
        source = 'local';
        if (data.torneoFinalizado) CONFIG.TORNEO_FINALIZADO = true;
      } else if (typeof DataStore !== 'undefined') {
        const published = await DataStore.loadPublishedJson();
        if (published) {
          data = DataStore.toPublicPayload(published);
          source = 'json';
          if (data.torneoFinalizado) CONFIG.TORNEO_FINALIZADO = true;
        } else {
          data = getDemoData();
          source = 'demo';
        }
      } else {
        data = getDemoData();
        source = 'demo';
      }
    } catch (err) {
      if (cached) {
        return {
          data: cached.data,
          fromCache: true,
          changed: false,
          demo: cached.data.demo,
          source: cached.data.source || 'cache',
          error: err.message,
        };
      }
      throw err;
    }

    data.source = source;
    const fp = fingerprint(data);
    const changed = !cached || cached.fingerprint !== fp;
    writeCache(data);

    if (freshEnough && !changed) {
      return {
        data: cached.data,
        fromCache: true,
        changed: false,
        demo: cached.data.demo,
        source: cached.data.source || source,
      };
    }

    return { data, fromCache: false, changed, demo: Boolean(data.demo), source };
  }

  return {
    isConfigured,
    isWriteConfigured,
    cargarDatos,
    getDemoData,
    readCache,
    fingerprint,
    fetchViaApi,
    pingScript,
    pullFromScript,
    pushToScript,
    setupViaScript,
    statusInfo,
    parsePayload,
    delegadoRequest,
  };
})();
