/**
 * Cálculo y render de la tabla de posiciones.
 */
const TablaPosiciones = (() => {
  /**
   * @param {Array} equipos
   * @param {Array} fixture
   * @param {Array} resultados
   * @returns {Array} filas ordenadas
   */
  function calcularTablaPosiciones(equipos, fixture, resultados) {
    const byId = Object.fromEntries(equipos.map((e) => [e.id, e]));
    const resultadoByPartido = Object.fromEntries(
      resultados.filter((r) => r.aprobado).map((r) => [r.partidoId, r])
    );

    const stats = {};
    equipos.forEach((e) => {
      stats[e.id] = {
        equipoId: e.id,
        nombre: e.nombre,
        colegio: e.colegio,
        grupo: e.grupo,
        color: e.color,
        logo: e.logo,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        dg: 0,
        pts: 0,
      };
    });

    fixture.forEach((partido) => {
      const res = resultadoByPartido[partido.id];
      if (!res) return;
      // Solo partidos finalizados con acta aprobada suman a la tabla oficial
      if (partido.estado !== 'Finalizado') return;

      const a = stats[partido.equipoAId];
      const b = stats[partido.equipoBId];
      if (!a || !b) return;

      a.pj += 1;
      b.pj += 1;
      a.gf += res.golesA;
      a.gc += res.golesB;
      b.gf += res.golesB;
      b.gc += res.golesA;

      if (res.golesA > res.golesB) {
        a.pg += 1;
        b.pp += 1;
        a.pts += 3;
      } else if (res.golesA < res.golesB) {
        b.pg += 1;
        a.pp += 1;
        b.pts += 3;
      } else {
        a.pe += 1;
        b.pe += 1;
        a.pts += 1;
        b.pts += 1;
      }
    });

    Object.values(stats).forEach((s) => {
      s.dg = s.gf - s.gc;
    });

    return Object.values(stats).sort(compararFilas);
  }

  function compararFilas(a, b) {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.nombre.localeCompare(b.nombre, 'es');
  }

  function agruparPorGrupo(filas) {
    const grupos = {};
    filas.forEach((f) => {
      const g = f.grupo || 'General';
      if (!grupos[g]) grupos[g] = [];
      grupos[g].push(f);
    });
    Object.values(grupos).forEach((arr) => arr.sort(compararFilas));
    return grupos;
  }

  function zonaClass(index, total) {
    if (index === 0) return 'zona-lider';
    const riesgo = CONFIG.ZONA_ELIMINACION || 2;
    if (index >= total - riesgo) return 'zona-riesgo';
    return 'zona-medio';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function logoHtml(fila) {
    if (fila.logo) {
      return `<img class="equipo-logo" src="${escapeHtml(fila.logo)}" alt="" loading="lazy" width="24" height="24" onerror="this.style.display='none'" />`;
    }
    return `<span class="equipo-color" style="background:${escapeHtml(fila.color)}"></span>`;
  }

  function renderTablaGrupo(grupo, filas) {
    const rows = filas
      .map((f, i) => {
        const zona = zonaClass(i, filas.length);
        return `
        <tr class="${zona}">
          <td>${i + 1}</td>
          <td>
            <div class="equipo-cell">
              ${logoHtml(f)}
              <span>${escapeHtml(f.nombre)}</span>
            </div>
          </td>
          <td>${f.pj}</td>
          <td>${f.pg}</td>
          <td>${f.pe}</td>
          <td>${f.pp}</td>
          <td>${f.gf}</td>
          <td>${f.gc}</td>
          <td>${f.dg > 0 ? '+' : ''}${f.dg}</td>
          <td class="pts-cell">${f.pts}</td>
        </tr>`;
      })
      .join('');

    return `
      <div class="tabla-grupo" data-grupo="${escapeHtml(grupo)}">
        <h2 class="tabla-grupo-title">Grupo ${escapeHtml(grupo)}</h2>
        <table class="standings">
          <thead>
            <tr>
              <th>#</th>
              <th>Equipo</th>
              <th>PJ</th>
              <th>PG</th>
              <th>PE</th>
              <th>PP</th>
              <th>GF</th>
              <th>GC</th>
              <th>DG</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  /**
   * @param {HTMLElement} container
   * @param {Array} filas
   * @param {{grupo?: string, busqueda?: string}} filtros
   */
  function render(container, filas, filtros = {}) {
    if (!container) return;
    let data = filas.slice();

    if (filtros.grupo) {
      data = data.filter((f) => f.grupo === filtros.grupo);
    }
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase().trim();
      data = data.filter(
        (f) =>
          f.nombre.toLowerCase().includes(q) ||
          (f.colegio || '').toLowerCase().includes(q)
      );
    }

    if (!data.length) {
      container.innerHTML = '<p class="empty-state">No hay equipos que coincidan con el filtro.</p>';
      return;
    }

    const grupos = agruparPorGrupo(data);
    const keys = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es'));
    container.innerHTML = keys.map((g) => renderTablaGrupo(g, grupos[g])).join('');
  }

  function poblarFiltroGrupos(select, filas) {
    if (!select) return;
    const current = select.value;
    const grupos = [...new Set(filas.map((f) => f.grupo).filter(Boolean))].sort();
    select.innerHTML =
      '<option value="">Todos los grupos</option>' +
      grupos.map((g) => `<option value="${escapeHtml(g)}">Grupo ${escapeHtml(g)}</option>`).join('');
    if (grupos.includes(current)) select.value = current;
  }

  return {
    calcularTablaPosiciones,
    compararFilas,
    agruparPorGrupo,
    render,
    poblarFiltroGrupos,
  };
})();
