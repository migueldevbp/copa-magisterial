/**
 * Copa Magisterial 2026 — Backend Google Sheets (Apps Script)
 * Incluye: torneo + llave + accesos delegados + reclamos + pendientes
 *
 * Tras actualizar: Guardar → Implementar → Nueva versión
 */

const CONFIG = {
  TOKEN: 'iespasco-sync-2026',
  /** Subí este número en cada cambio para verificar el deploy */
  VERSION: '2026-08-24-delegados-v4',
  SHEET_NAMES: {
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
};

const HEADERS = {
  Equipos: ['ID', 'Nombre', 'Colegio', 'Grupo', 'Color', 'Logo_URL'],
  Fixture: ['ID', 'Fecha', 'Hora', 'Equipo_A_ID', 'Equipo_B_ID', 'Cancha', 'Estado'],
  Resultados: [
    'Partido_ID', 'Goles_A', 'Goles_B', 'Aprobado',
    'Goleadores_A', 'Goleadores_B', 'Tarjetas_A', 'Tarjetas_B',
  ],
  Jugadores: [
    'Equipo_ID', 'Nombre', 'Apellido', 'DNI', 'Posicion', 'Numero',
    'Goles', 'Tarjetas_A', 'Tarjetas_R',
  ],
  Llave: [
    'ID', 'Ronda', 'Orden', 'Lado', 'Equipo_A_ID', 'Equipo_B_ID',
    'Goles_A', 'Goles_B', 'Estado', 'Fecha', 'Hora', 'Cancha',
  ],
  Config: ['Clave', 'Valor'],
  Delegados: ['Equipo_ID', 'Clave', 'Nombre', 'Telefono'],
  Reclamos: ['ID', 'Equipo_ID', 'Fecha', 'Asunto', 'Detalle', 'Estado', 'Respuesta', 'Fecha_Respuesta'],
  Pendientes: ['ID', 'Equipo_ID', 'Concepto', 'Monto', 'Vencimiento', 'Estado', 'Nota'],
};

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (headers && headers.length) {
    const first = sh.getRange(1, 1, 1, Math.max(headers.length, 1)).getValues()[0];
    const empty = !first || first.every(function (c) { return String(c).trim() === ''; });
    if (empty || sh.getLastRow() === 0) {
      sh.clear();
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    getOrCreateSheet_(ss, name, HEADERS[name]);
  });
  const cfg = ss.getSheetByName('Config');
  if (cfg.getLastRow() < 2) {
    cfg.getRange(2, 1, 3, 2).setValues([
      ['TORNEO_FINALIZADO', 'NO'],
      ['LLAVE_ACTIVA', 'NO'],
      ['LLAVE_TAMANO', '16'],
    ]);
  }
  return 'OK: hojas listas';
}

function sheetToObjects_(sh) {
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  const headers = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1)
    .filter(function (row) {
      return row.some(function (c) { return String(c).trim() !== ''; });
    })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) {
        obj[h] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
      });
      return obj;
    });
}

function readConfigMap_(ss) {
  const sh = ss.getSheetByName(CONFIG.SHEET_NAMES.config);
  const map = {};
  if (!sh) return map;
  sheetToObjects_(sh).forEach(function (r) {
    if (r.Clave) map[r.Clave] = r.Valor;
  });
  return map;
}

function padRow_(row, width) {
  const out = [];
  for (var i = 0; i < width; i++) {
    var v = row[i];
    out.push(v === null || v === undefined ? '' : v);
  }
  return out;
}

function writeConfigMap_(ss, map) {
  const sh = getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.config, HEADERS.Config);
  const rows = Object.keys(map).map(function (k) { return [k, map[k]]; });
  sh.clear();
  sh.getRange(1, 1, 1, 2).setValues([HEADERS.Config]);
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.setFrozenRows(1);
}

function replaceSheetRows_(ss, name, headers, rows) {
  const sh = getOrCreateSheet_(ss, name, headers);
  sh.clear();
  const width = headers.length;
  sh.getRange(1, 1, 1, width).setValues([headers]);
  if (rows.length) {
    const matrix = rows.map(function (r) { return padRow_(r, width); });
    sh.getRange(2, 1, matrix.length, width).setValues(matrix);
  }
  sh.setFrozenRows(1);
}

function appendRow_(ss, name, headers, row) {
  const sh = getOrCreateSheet_(ss, name, headers);
  sh.appendRow(padRow_(row, headers.length));
}

function buildBundle_(ss, includeSecrets) {
  const cfg = readConfigMap_(ss);
  const equipos = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.equipos, HEADERS.Equipos));
  const fixture = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.fixture, HEADERS.Fixture));
  const resultados = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.resultados, HEADERS.Resultados));
  const jugadores = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.jugadores, HEADERS.Jugadores));
  const llaveRows = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.llave, HEADERS.Llave));
  const reclamos = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.reclamos, HEADERS.Reclamos));
  const pendientes = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.pendientes, HEADERS.Pendientes));

  const out = {
    ok: true,
    updatedAt: new Date().toISOString(),
    torneoFinalizado: String(cfg.TORNEO_FINALIZADO || '').toUpperCase() === 'SI',
    equipos: equipos,
    fixture: fixture,
    resultados: resultados,
    jugadores: jugadores,
    reclamos: reclamos,
    pendientes: pendientes,
    llave: {
      activa: String(cfg.LLAVE_ACTIVA || '').toUpperCase() === 'SI',
      tamaño: Number(cfg.LLAVE_TAMANO) === 8 ? 8 : 16,
      partidos: llaveRows,
    },
  };

  if (includeSecrets) {
    out.delegados = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.delegados, HEADERS.Delegados));
  }
  return out;
}

function writeBundle_(ss, body) {
  const equipos = body.equipos || [];
  const fixture = body.fixture || [];
  const resultados = body.resultados || [];
  const jugadores = body.jugadores || [];
  const llave = body.llave || { activa: false, tamaño: 16, partidos: [] };
  const reclamos = body.reclamos || [];
  const pendientes = body.pendientes || [];
  const delegados = body.delegados || [];

  replaceSheetRows_(ss, CONFIG.SHEET_NAMES.equipos, HEADERS.Equipos, equipos.map(function (e) {
    return [e.id || e.ID || '', e.nombre || e.Nombre || '', e.colegio || e.Colegio || '', e.grupo || e.Grupo || '', e.color || e.Color || '', e.logo || e.Logo_URL || ''];
  }));

  replaceSheetRows_(ss, CONFIG.SHEET_NAMES.fixture, HEADERS.Fixture, fixture.map(function (p) {
    return [p.id || p.ID || '', p.fecha || p.Fecha || '', p.hora || p.Hora || '', p.equipoAId || p.Equipo_A_ID || '', p.equipoBId || p.Equipo_B_ID || '', p.cancha || p.Cancha || '', p.estado || p.Estado || 'Próximo'];
  }));

  replaceSheetRows_(ss, CONFIG.SHEET_NAMES.resultados, HEADERS.Resultados, resultados.map(function (r) {
    return [
      r.partidoId || r.Partido_ID || '',
      r.golesA != null ? r.golesA : (r.Goles_A || 0),
      r.golesB != null ? r.golesB : (r.Goles_B || 0),
      r.aprobado === true || String(r.Aprobado || '').toUpperCase() === 'SI' ? 'SI' : 'NO',
      r.goleadoresA || r.Goleadores_A || '',
      r.goleadoresB || r.Goleadores_B || '',
      r.tarjetasA || r.Tarjetas_A || '',
      r.tarjetasB || r.Tarjetas_B || '',
    ];
  }));

  replaceSheetRows_(ss, CONFIG.SHEET_NAMES.jugadores, HEADERS.Jugadores, jugadores.map(function (j) {
    return [
      j.equipoId || j.Equipo_ID || '', j.nombre || j.Nombre || '', j.apellido || j.Apellido || '',
      j.dni || j.DNI || '', j.posicion || j.Posicion || '', j.numero || j.Numero || '',
      j.goles != null ? j.goles : (j.Goles || 0),
      j.tarjetasA != null ? j.tarjetasA : (j.Tarjetas_A || 0),
      j.tarjetasR != null ? j.tarjetasR : (j.Tarjetas_R || 0),
    ];
  }));

  replaceSheetRows_(ss, CONFIG.SHEET_NAMES.llave, HEADERS.Llave, (llave.partidos || []).map(function (p) {
    return [
      p.id || '', p.ronda || '', p.orden != null ? p.orden : '', p.lado || '',
      p.equipoAId || '', p.equipoBId || '',
      p.golesA === null || p.golesA === undefined ? '' : p.golesA,
      p.golesB === null || p.golesB === undefined ? '' : p.golesB,
      p.estado || 'Próximo', p.fecha || '', p.hora || '', p.cancha || '',
    ];
  }));

  replaceSheetRows_(ss, CONFIG.SHEET_NAMES.reclamos, HEADERS.Reclamos, reclamos.map(function (r) {
    return [
      r.id || r.ID || '', r.equipoId || r.Equipo_ID || '', r.fecha || r.Fecha || '',
      r.asunto || r.Asunto || '', r.detalle || r.Detalle || '', r.estado || r.Estado || 'Pendiente',
      r.respuesta || r.Respuesta || '', r.fechaRespuesta || r.Fecha_Respuesta || '',
    ];
  }));

  replaceSheetRows_(ss, CONFIG.SHEET_NAMES.pendientes, HEADERS.Pendientes, pendientes.map(function (p) {
    return [
      p.id || p.ID || '', p.equipoId || p.Equipo_ID || '', p.concepto || p.Concepto || '',
      p.monto != null ? p.monto : (p.Monto || ''), p.vencimiento || p.Vencimiento || '',
      p.estado || p.Estado || 'Pendiente', p.nota || p.Nota || '',
    ];
  }));

  replaceSheetRows_(ss, CONFIG.SHEET_NAMES.delegados, HEADERS.Delegados, delegados.map(function (d) {
    return [
      d.equipoId || d.Equipo_ID || '', d.clave || d.Clave || '',
      d.nombre || d.Nombre || '', d.telefono || d.Telefono || '',
    ];
  }));

  writeConfigMap_(ss, {
    TORNEO_FINALIZADO: body.torneoFinalizado ? 'SI' : 'NO',
    LLAVE_ACTIVA: llave.activa ? 'SI' : 'NO',
    LLAVE_TAMANO: String(llave.tamaño || 16),
  });
}

function verifyDelegado_(ss, equipoId, clave) {
  const eid = String(equipoId || '').trim();
  const cl = String(clave || '').trim();
  if (!eid || !cl) return null;
  const rows = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.delegados, HEADERS.Delegados));
  const found = rows.filter(function (r) {
    return String(r.Equipo_ID || '').trim() === eid && String(r.Clave || '').trim() === cl;
  })[0];
  return found || null;
}

function statsGlobales_(jugadores, equipos, fixture, resultados) {
  const goleadores = jugadores
    .map(function (j) {
      return {
        nombre: j.Nombre || '',
        apellido: j.Apellido || '',
        equipoId: j.Equipo_ID || '',
        goles: Number(j.Goles || 0) || 0,
      };
    })
    .filter(function (j) { return j.goles > 0; })
    .sort(function (a, b) { return b.goles - a.goles; })
    .slice(0, 15);

  // GC por equipo desde resultados finalizados
  const gc = {};
  const resMap = {};
  resultados.forEach(function (r) {
    if (String(r.Aprobado || '').toUpperCase() === 'SI') resMap[r.Partido_ID] = r;
  });
  fixture.forEach(function (p) {
    if (String(p.Estado || '') !== 'Finalizado') return;
    const r = resMap[p.ID];
    if (!r) return;
    var a = p.Equipo_A_ID;
    var b = p.Equipo_B_ID;
    gc[a] = (gc[a] || 0) + (Number(r.Goles_B) || 0);
    gc[b] = (gc[b] || 0) + (Number(r.Goles_A) || 0);
  });

  const porteros = jugadores
    .filter(function (j) {
      var pos = String(j.Posicion || '').toLowerCase();
      return pos.indexOf('porter') >= 0 || pos.indexOf('arquero') >= 0;
    })
    .map(function (j) {
      return {
        nombre: j.Nombre || '',
        apellido: j.Apellido || '',
        equipoId: j.Equipo_ID || '',
        golesRecibidos: gc[j.Equipo_ID] != null ? gc[j.Equipo_ID] : 999,
      };
    })
    .sort(function (a, b) { return a.golesRecibidos - b.golesRecibidos; });

  return {
    goleadores: goleadores,
    porteroMenosVencido: porteros[0] || null,
    equiposMap: equipos.reduce(function (acc, e) {
      acc[e.ID] = e.Nombre;
      return acc;
    }, {}),
  };
}

function handleDelegado_(ss, body) {
  var equipoId = String(body.equipoId || '').trim();
  var clave = String(body.clave || '').trim();
  var action = body.action;

  if (!equipoId || !clave) {
    return jsonOut({ ok: false, error: 'Equipo y clave requeridos' });
  }

  var del = verifyDelegado_(ss, equipoId, clave);
  if (!del) {
    return jsonOut({ ok: false, error: 'Clave incorrecta o equipo sin acceso' });
  }

  if (action === 'reclamo_crear') {
    var id = 'R' + Date.now();
    var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    appendRow_(ss, CONFIG.SHEET_NAMES.reclamos, HEADERS.Reclamos, [
      id, equipoId, fecha, String(body.asunto || '').trim(), String(body.detalle || '').trim(),
      'Pendiente', '', '',
    ]);
    return jsonOut({ ok: true, kind: 'reclamo', message: 'Reclamo enviado', id: id });
  }

  // delegado_login / delegado_data
  var equipos = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.equipos, HEADERS.Equipos));
  var fixture = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.fixture, HEADERS.Fixture));
  var resultados = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.resultados, HEADERS.Resultados));
  var jugadores = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.jugadores, HEADERS.Jugadores));
  var reclamos = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.reclamos, HEADERS.Reclamos));
  var pendientes = sheetToObjects_(getOrCreateSheet_(ss, CONFIG.SHEET_NAMES.pendientes, HEADERS.Pendientes));

  var equipo = equipos.filter(function (e) { return String(e.ID) === equipoId; })[0];
  if (!equipo) return jsonOut({ ok: false, error: 'Equipo no encontrado' });

  var plantel = jugadores.filter(function (j) { return String(j.Equipo_ID) === equipoId; });
  var partidos = fixture.filter(function (p) {
    return String(p.Equipo_A_ID) === equipoId || String(p.Equipo_B_ID) === equipoId;
  });
  var misReclamos = reclamos.filter(function (r) { return String(r.Equipo_ID) === equipoId; });
  var misPendientes = pendientes.filter(function (p) { return String(p.Equipo_ID) === equipoId; });

  return jsonOut({
    ok: true,
    kind: 'delegado',
    delegado: { nombre: del.Nombre || '', telefono: del.Telefono || '' },
    equipo: equipo,
    jugadores: plantel,
    partidos: partidos,
    resultados: resultados,
    equipos: equipos,
    reclamos: misReclamos,
    pendientes: misPendientes,
    stats: statsGlobales_(jugadores, equipos, fixture, resultados),
    updatedAt: new Date().toISOString(),
  });
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'read';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping') {
      return jsonOut({
        ok: true,
        kind: 'ping',
        version: CONFIG.VERSION,
        name: ss.getName(),
        id: ss.getId(),
        message: 'Copa Magisterial backend OK',
      });
    }
    if (action === 'setup') {
      var token = (e.parameter && e.parameter.token) || '';
      if (token !== CONFIG.TOKEN) return jsonOut({ ok: false, error: 'Token inválido' });
      setupSheets();
      return jsonOut({ ok: true, message: 'Hojas creadas/verificadas' });
    }
    if (action === 'read') {
      var tokenRead = (e.parameter && e.parameter.token) || '';
      if (tokenRead === CONFIG.TOKEN) {
        return jsonOut(buildBundle_(ss, true));
      }
      // sin token = lectura pública
      return jsonOut(buildBundle_(ss, false));
    }
    // Fallback por si el POST se convierte en GET (redirect de Apps Script)
    if (action === 'delegado_login' || action === 'delegado_data' || action === 'reclamo_crear') {
      return handleDelegado_(ss, {
        action: action,
        equipoId: (e.parameter && e.parameter.equipoId) || '',
        clave: (e.parameter && e.parameter.clave) || '',
        asunto: (e.parameter && e.parameter.asunto) || '',
        detalle: (e.parameter && e.parameter.detalle) || '',
      });
    }
    // Lectura pública: sin claves de delegados
    return jsonOut(buildBundle_(ss, false));
  } catch (err) {
    return jsonOut({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}';
    var body = JSON.parse(raw);
    var action = body.action || 'write';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'delegado_login' || action === 'delegado_data' || action === 'reclamo_crear') {
      return handleDelegado_(ss, body);
    }

    if (body.token !== CONFIG.TOKEN) {
      return jsonOut({ ok: false, error: 'Token inválido' });
    }

    if (action === 'ping') {
      return jsonOut({
        ok: true,
        kind: 'ping',
        version: CONFIG.VERSION,
        message: 'auth ok',
        id: ss.getId(),
      });
    }
    if (action === 'setup') {
      setupSheets();
      return jsonOut({ ok: true, message: 'Hojas creadas/verificadas' });
    }
    if (action === 'read') {
      return jsonOut(buildBundle_(ss, true));
    }
    if (action === 'write') {
      writeBundle_(ss, body);
      return jsonOut({ ok: true, kind: 'write', message: 'Datos guardados en Google Sheets', updatedAt: new Date().toISOString() });
    }

    return jsonOut({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err.message || err) });
  }
}
