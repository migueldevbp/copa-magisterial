/**
 * Cuadro de honor: podio, destacados y goleadores.
 */
const CuadroHonor = (() => {
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function iniciales(nombre, apellido) {
    return `${(nombre || '?')[0] || ''}${(apellido || '')[0] || ''}`.toUpperCase();
  }

  function esPortero(posicion) {
    const p = String(posicion || '').toLowerCase();
    return p.includes('porter') || p.includes('arquero') || p.includes('goal');
  }

  function golesRecibidosPorEquipo(tabla) {
    const map = {};
    tabla.forEach((f) => {
      map[f.equipoId] = f.gc;
    });
    return map;
  }

  function calcularMaximoGoleador(jugadores) {
    if (!jugadores.length) return null;
    return [...jugadores].sort((a, b) => b.goles - a.goles || a.apellido.localeCompare(b.apellido, 'es'))[0];
  }

  function calcularPorteroMenosGoles(jugadores, tabla) {
    const gc = golesRecibidosPorEquipo(tabla);
    const porteros = jugadores.filter((j) => esPortero(j.posicion));
    if (!porteros.length) return null;
    return [...porteros].sort((a, b) => {
      const ga = gc[a.equipoId] ?? 999;
      const gb = gc[b.equipoId] ?? 999;
      if (ga !== gb) return ga - gb;
      return a.apellido.localeCompare(b.apellido, 'es');
    })[0];
  }

  function calcularEquipoMasDisciplinado(equipos, jugadores) {
    const tarjetas = {};
    equipos.forEach((e) => {
      tarjetas[e.id] = { equipo: e, amarillas: 0, rojas: 0, total: 0 };
    });
    jugadores.forEach((j) => {
      if (!tarjetas[j.equipoId]) return;
      tarjetas[j.equipoId].amarillas += j.tarjetasA;
      tarjetas[j.equipoId].rojas += j.tarjetasR;
      tarjetas[j.equipoId].total += j.tarjetasA + j.tarjetasR * 2;
    });
    return Object.values(tarjetas).sort((a, b) => {
      if (a.total !== b.total) return a.total - b.total;
      if (a.rojas !== b.rojas) return a.rojas - b.rojas;
      return a.equipo.nombre.localeCompare(b.equipo.nombre, 'es');
    })[0];
  }

  function topGoleadores(jugadores, n = 5) {
    return [...jugadores]
      .filter((j) => j.goles > 0)
      .sort((a, b) => b.goles - a.goles || a.apellido.localeCompare(b.apellido, 'es'))
      .slice(0, n);
  }

  function podioDesdeTabla(tabla) {
    const orden = [...tabla].sort(TablaPosiciones.compararFilas);
    return {
      campeon: orden[0] || null,
      subcampeon: orden[1] || null,
      tercero: orden[2] || null,
    };
  }

  function logoHtml(fila, sizeClass = 'podio-logo') {
    if (fila?.logo) {
      return `<img class="${sizeClass}" src="${escapeHtml(fila.logo)}" alt="" loading="lazy" onerror="this.style.display='none'" />`;
    }
    const color = fila?.color || '#0D1B3E';
    const letters = escapeHtml((fila?.nombre || '??').slice(0, 2).toUpperCase());
    return `<div class="honor-avatar" style="width:64px;height:64px;margin:0 auto 0.5rem;background:${escapeHtml(color)}">${letters}</div>`;
  }

  function cardJugador(titulo, jugador, equiposMap, stat, label) {
    if (!jugador) {
      return `<article class="honor-card"><h3>${escapeHtml(titulo)}</h3><p class="detalle-vacio">Sin datos</p></article>`;
    }
    const equipo = equiposMap[jugador.equipoId];
    return `
      <article class="honor-card">
        <h3>${escapeHtml(titulo)}</h3>
        <div class="honor-card-body">
          <div class="honor-avatar">${escapeHtml(iniciales(jugador.nombre, jugador.apellido))}</div>
          <div class="honor-card-info">
            <strong>${escapeHtml(jugador.nombre)} ${escapeHtml(jugador.apellido)}</strong>
            <span>${escapeHtml(equipo?.nombre || 'Equipo')}</span>
          </div>
          <div class="honor-stat" title="${escapeHtml(label)}">${escapeHtml(stat)}</div>
        </div>
      </article>`;
  }

  /**
   * @param {HTMLElement} container
   * @param {object} ctx
   * @param {boolean} forzarPreview — muestra honor aunque el torneo no haya finalizado
   */
  function generarCuadroHonor(container, ctx, forzarPreview = false) {
    if (!container) return;
    const { equipos, jugadores, tabla } = ctx;
    const finalizado = CONFIG.TORNEO_FINALIZADO || forzarPreview;

    if (!finalizado) {
      container.innerHTML = `
        <div class="honor-locked">
          <h2>Torneo en curso</h2>
          <p>El cuadro de honor (campeón, goleadores y destacados) se publica al finalizar la competencia.</p>
          <button type="button" class="btn-ghost" id="btn-preview-honor" style="margin-top:1rem">Ver vista previa con datos actuales</button>
        </div>`;
      const btn = container.querySelector('#btn-preview-honor');
      if (btn) {
        btn.addEventListener('click', () => generarCuadroHonor(container, ctx, true));
      }
      return;
    }

    const equiposMap = Object.fromEntries(equipos.map((e) => [e.id, e]));
    const gc = golesRecibidosPorEquipo(tabla);
    const { campeon, subcampeon, tercero } = podioDesdeTabla(tabla);
    const maxGoleador = calcularMaximoGoleador(jugadores);
    const portero = calcularPorteroMenosGoles(jugadores, tabla);
    const disciplinado = calcularEquipoMasDisciplinado(equipos, jugadores);
    const top5 = topGoleadores(jugadores, 5);
    const todosGoleadores = topGoleadores(jugadores, 50);

    const puesto = (fila, clase, medalla, label) => {
      if (!fila) return '';
      return `
        <div class="podio-puesto ${clase}">
          <div class="podio-medalla">${medalla}</div>
          ${logoHtml(fila)}
          <p class="podio-nombre">${escapeHtml(fila.nombre)}</p>
          <p class="podio-label">${label} · ${fila.pts} pts</p>
        </div>`;
    };

    container.innerHTML = `
      ${forzarPreview && !CONFIG.TORNEO_FINALIZADO ? '<p class="honor-preview-note">Vista previa — el torneo aún no está marcado como finalizado</p>' : ''}
      <div class="podio">
        ${puesto(subcampeon, 'podio-plata', '🥈', 'Subcampeón')}
        ${puesto(campeon, 'podio-oro', '🥇', 'Campeón')}
        ${puesto(tercero, 'podio-bronce', '🥉', 'Tercer puesto')}
      </div>
      <div class="honor-grid">
        ${cardJugador('Máximo goleador', maxGoleador, equiposMap, maxGoleador?.goles ?? '—', 'Goles')}
        ${cardJugador(
          'Portero menos vencido',
          portero,
          equiposMap,
          portero ? gc[portero.equipoId] ?? 0 : '—',
          'Goles recibidos'
        )}
        <article class="honor-card">
          <h3>Equipo más disciplinado</h3>
          ${
            disciplinado
              ? `<div class="honor-card-body">
                  <div class="honor-avatar" style="background:${escapeHtml(disciplinado.equipo.color)}">${escapeHtml(disciplinado.equipo.nombre.slice(0, 2).toUpperCase())}</div>
                  <div class="honor-card-info">
                    <strong>${escapeHtml(disciplinado.equipo.nombre)}</strong>
                    <span>${disciplinado.amarillas}A · ${disciplinado.rojas}R</span>
                  </div>
                  <div class="honor-stat">${disciplinado.total}</div>
                </div>`
              : '<p class="detalle-vacio">Sin datos</p>'
          }
        </article>
      </div>
      <div class="honor-charts">
        <div class="chart-wrap">
          <h3>Top 5 goleadores</h3>
          <div class="chart-canvas-box">
            <canvas id="chart-goleadores" aria-label="Gráfico de goleadores"></canvas>
          </div>
        </div>
        <div class="goleadores-wrap">
          <h3>Tabla de goleadores</h3>
          <table class="goleadores-table">
            <thead>
              <tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Goles</th></tr>
            </thead>
            <tbody>
              ${
                todosGoleadores.length
                  ? todosGoleadores
                      .map((j, i) => {
                        const eq = equiposMap[j.equipoId];
                        return `<tr>
                          <td>${i + 1}</td>
                          <td>${escapeHtml(j.nombre)} ${escapeHtml(j.apellido)}</td>
                          <td>${escapeHtml(eq?.nombre || '—')}</td>
                          <td>${j.goles}</td>
                        </tr>`;
                      })
                      .join('')
                  : '<tr><td colspan="4">Sin goles registrados</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>`;

    const canvas = container.querySelector('#chart-goleadores');
    ChartsHonor.renderTopGoleadores(
      canvas,
      top5.map((j) => ({
        label: `${j.nombre} ${j.apellido}`.trim(),
        value: j.goles,
      }))
    );
  }

  return {
    generarCuadroHonor,
    calcularMaximoGoleador,
    calcularPorteroMenosGoles,
    calcularEquipoMasDisciplinado,
    topGoleadores,
    podioDesdeTabla,
  };
})();
