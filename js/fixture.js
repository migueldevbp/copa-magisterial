/**
 * Fixture dinámico + detalle de partido.
 */
const Fixture = (() => {
  let onPartidoClick = null;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatFecha(iso) {
    if (!iso) return 'Sin fecha';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function badgeClass(estado) {
    if (estado === 'En Juego') return 'badge-en-juego';
    if (estado === 'Finalizado') return 'badge-finalizado';
    return 'badge-proximo';
  }

  function mapaEquipos(equipos) {
    return Object.fromEntries(equipos.map((e) => [e.id, e]));
  }

  function mapaResultados(resultados) {
    return Object.fromEntries(resultados.map((r) => [r.partidoId, r]));
  }

  function enriquecer(fixture, equipos, resultados) {
    const eq = mapaEquipos(equipos);
    const res = mapaResultados(resultados);
    return fixture.map((p) => ({
      ...p,
      equipoA: eq[p.equipoAId] || { id: p.equipoAId, nombre: 'TBD', color: '#999', logo: '' },
      equipoB: eq[p.equipoBId] || { id: p.equipoBId, nombre: 'TBD', color: '#999', logo: '' },
      resultado: res[p.id] || null,
    }));
  }

  function agruparPorFecha(partidos) {
    const map = {};
    partidos.forEach((p) => {
      const key = p.fecha || 'sin-fecha';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => String(a.hora).localeCompare(String(b.hora)))
    );
    return map;
  }

  function logoOrDot(equipo) {
    if (equipo.logo) {
      return `<img class="equipo-logo" src="${escapeHtml(equipo.logo)}" alt="" loading="lazy" width="24" height="24" onerror="this.outerHTML='<span class=\\'equipo-color\\' style=\\'background:${escapeHtml(equipo.color)}\\'></span>'" />`;
    }
    return `<span class="equipo-color" style="background:${escapeHtml(equipo.color)}"></span>`;
  }

  function scoreOrDash(partido, side) {
    if (!partido.resultado) {
      return partido.estado === 'Próximo' ? '—' : '—';
    }
    return side === 'A' ? partido.resultado.golesA : partido.resultado.golesB;
  }

  function cardHtml(partido) {
    const scoreA = scoreOrDash(partido, 'A');
    const scoreB = scoreOrDash(partido, 'B');
    const showScore = partido.estado !== 'Próximo' || partido.resultado;

    return `
      <button type="button" class="partido-card" data-partido-id="${escapeHtml(partido.id)}" aria-label="Ver detalle: ${escapeHtml(partido.equipoA.nombre)} vs ${escapeHtml(partido.equipoB.nombre)}">
        <div>
          <div class="partido-meta">
            <span>${escapeHtml(partido.hora || '--:--')}</span>
            <span>${escapeHtml(partido.cancha || 'Cancha TBD')}</span>
          </div>
          <div class="partido-equipos">
            <div class="partido-equipo">
              <div class="partido-equipo-nombre">
                ${logoOrDot(partido.equipoA)}
                <span>${escapeHtml(partido.equipoA.nombre)}</span>
              </div>
              <span class="partido-score">${showScore ? scoreA : '—'}</span>
            </div>
            <div class="partido-vs">vs</div>
            <div class="partido-equipo">
              <div class="partido-equipo-nombre">
                ${logoOrDot(partido.equipoB)}
                <span>${escapeHtml(partido.equipoB.nombre)}</span>
              </div>
              <span class="partido-score">${showScore ? scoreB : '—'}</span>
            </div>
          </div>
        </div>
        <span class="badge ${badgeClass(partido.estado)}">${escapeHtml(partido.estado)}</span>
      </button>`;
  }

  function generarFixture(container, fixture, equipos, resultados, filtros = {}) {
    if (!container) return;
    let partidos = enriquecer(fixture, equipos, resultados);

    if (filtros.fecha) {
      partidos = partidos.filter((p) => p.fecha === filtros.fecha);
    }
    if (filtros.estado) {
      partidos = partidos.filter((p) => p.estado === filtros.estado);
    }
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase();
      partidos = partidos.filter(
        (p) =>
          p.equipoA.nombre.toLowerCase().includes(q) ||
          p.equipoB.nombre.toLowerCase().includes(q)
      );
    }

    if (!partidos.length) {
      container.innerHTML = '<p class="empty-state">No hay partidos para este filtro.</p>';
      return;
    }

    const porFecha = agruparPorFecha(partidos);
    const fechas = Object.keys(porFecha).sort();

    container.innerHTML = fechas
      .map((fecha) => {
        const cards = porFecha[fecha].map(cardHtml).join('');
        return `
          <div class="fecha-bloque" data-fecha="${escapeHtml(fecha)}">
            <h2 class="fecha-titulo">${escapeHtml(formatFecha(fecha))}</h2>
            <div class="partidos-grid">${cards}</div>
          </div>`;
      })
      .join('');

    container.querySelectorAll('.partido-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-partido-id');
        if (onPartidoClick) onPartidoClick(id);
      });
    });
  }

  function poblarFiltroFechas(select, fixture) {
    if (!select) return;
    const current = select.value;
    const fechas = [...new Set(fixture.map((p) => p.fecha).filter(Boolean))].sort();
    select.innerHTML =
      '<option value="">Todas las fechas</option>' +
      fechas
        .map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(formatFecha(f))}</option>`)
        .join('');
    if (fechas.includes(current)) select.value = current;
  }

  function parseLista(texto) {
    if (!texto || texto === '-' || texto.toLowerCase() === 'n/a') return [];
    return String(texto)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function jugadoresDeEquipo(jugadores, equipoId) {
    return jugadores
      .filter((j) => j.equipoId === equipoId)
      .sort((a, b) => Number(a.numero) - Number(b.numero) || a.apellido.localeCompare(b.apellido, 'es'));
  }

  function renderDetalle(container, partidoId, fixture, equipos, resultados, jugadores) {
    if (!container) return;
    const partidos = enriquecer(fixture, equipos, resultados);
    const partido = partidos.find((p) => p.id === partidoId);

    if (!partido) {
      container.innerHTML = '<p class="empty-state">Partido no encontrado.</p>';
      return;
    }

    const res = partido.resultado;
    const marcador = res ? `${res.golesA} — ${res.golesB}` : 'vs';
    const plantelA = jugadoresDeEquipo(jugadores, partido.equipoAId);
    const plantelB = jugadoresDeEquipo(jugadores, partido.equipoBId);

    const listaJugadores = (lista) =>
      lista.length
        ? `<ul class="detalle-lista">${lista
            .map(
              (j) =>
                `<li>#${escapeHtml(j.numero || '-')} ${escapeHtml(j.nombre)} ${escapeHtml(j.apellido)} <em>(${escapeHtml(j.posicion || 'Jugador')})</em></li>`
            )
            .join('')}</ul>`
        : '<p class="detalle-vacio">Sin plantel cargado.</p>';

    const listaIncidencias = (texto, vacio) => {
      const items = parseLista(texto);
      return items.length
        ? `<ul class="detalle-lista">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
        : `<p class="detalle-vacio">${vacio}</p>`;
    };

    const logo = (eq) =>
      eq.logo
        ? `<img src="${escapeHtml(eq.logo)}" alt="" loading="lazy" width="56" height="56" onerror="this.style.display='none'" />`
        : `<span class="honor-avatar" style="background:${escapeHtml(eq.color)}">${escapeHtml((eq.nombre || '?').slice(0, 2).toUpperCase())}</span>`;

    container.innerHTML = `
      <div class="detalle-header">
        <div class="detalle-info">${escapeHtml(formatFecha(partido.fecha))} · ${escapeHtml(partido.hora)} · ${escapeHtml(partido.cancha)}</div>
        <div class="detalle-marcador">
          <div class="detalle-equipo">
            ${logo(partido.equipoA)}
            <span>${escapeHtml(partido.equipoA.nombre)}</span>
          </div>
          <div class="detalle-goles">${escapeHtml(marcador)}</div>
          <div class="detalle-equipo">
            ${logo(partido.equipoB)}
            <span>${escapeHtml(partido.equipoB.nombre)}</span>
          </div>
        </div>
        <span class="badge ${badgeClass(partido.estado)}">${escapeHtml(partido.estado)}</span>
      </div>
      <div class="detalle-grid">
        <div class="detalle-bloque">
          <h3>Alineación — ${escapeHtml(partido.equipoA.nombre)}</h3>
          ${listaJugadores(plantelA)}
        </div>
        <div class="detalle-bloque">
          <h3>Alineación — ${escapeHtml(partido.equipoB.nombre)}</h3>
          ${listaJugadores(plantelB)}
        </div>
        <div class="detalle-bloque">
          <h3>Goleadores</h3>
          <p><strong>${escapeHtml(partido.equipoA.nombre)}</strong></p>
          ${listaIncidencias(res?.goleadoresA, 'Sin goles')}
          <p><strong>${escapeHtml(partido.equipoB.nombre)}</strong></p>
          ${listaIncidencias(res?.goleadoresB, 'Sin goles')}
        </div>
        <div class="detalle-bloque">
          <h3>Tarjetas</h3>
          <p><strong>${escapeHtml(partido.equipoA.nombre)}</strong></p>
          ${listaIncidencias(res?.tarjetasA, 'Sin tarjetas')}
          <p><strong>${escapeHtml(partido.equipoB.nombre)}</strong></p>
          ${listaIncidencias(res?.tarjetasB, 'Sin tarjetas')}
        </div>
      </div>`;
  }

  function setOnPartidoClick(fn) {
    onPartidoClick = fn;
  }

  return {
    generarFixture,
    enriquecer,
    agruparPorFecha,
    poblarFiltroFechas,
    renderDetalle,
    setOnPartidoClick,
    formatFecha,
  };
})();
