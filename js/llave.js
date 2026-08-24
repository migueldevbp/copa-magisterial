/**
 * Llave eliminatoria (8 o 16 equipos) — estructura, avance y render público.
 */
const Llave = (() => {
  const RONDAS_16 = [
    { key: 'octavos', label: 'Octavos', count: 8 },
    { key: 'cuartos', label: 'Cuartos', count: 4 },
    { key: 'semis', label: 'Semifinales', count: 2 },
    { key: 'final', label: 'Final', count: 1 },
  ];

  const RONDAS_8 = [
    { key: 'cuartos', label: 'Cuartos', count: 4 },
    { key: 'semis', label: 'Semifinales', count: 2 },
    { key: 'final', label: 'Final', count: 1 },
  ];

  function emptyLlave() {
    return {
      activa: false,
      tamaño: 16,
      partidos: [],
    };
  }

  function rondasPara(tamaño) {
    return Number(tamaño) === 8 ? RONDAS_8 : RONDAS_16;
  }

  function crearEstructura(tamaño = 16) {
    const size = Number(tamaño) === 8 ? 8 : 16;
    const rondas = rondasPara(size);
    const partidos = [];

    rondas.forEach((ronda) => {
      for (let i = 0; i < ronda.count; i++) {
        const mitad = ronda.count / 2;
        let lado = 'centro';
        if (ronda.key !== 'final') {
          lado = i < mitad ? 'izq' : 'der';
        }
        partidos.push({
          id: `${ronda.key}-${i + 1}`,
          ronda: ronda.key,
          orden: i,
          lado,
          equipoAId: '',
          equipoBId: '',
          golesA: null,
          golesB: null,
          estado: 'Próximo',
          fecha: '',
          hora: '',
          cancha: '',
        });
      }
    });

    return {
      activa: true,
      tamaño: size,
      partidos,
    };
  }

  function mapPartido(p) {
    const rawA = p.golesA ?? p.Goles_A;
    const rawB = p.golesB ?? p.Goles_B;
    const golesA = rawA === '' || rawA === null || rawA === undefined ? null : Number(rawA);
    const golesB = rawB === '' || rawB === null || rawB === undefined ? null : Number(rawB);
    return {
      id: String(p.id ?? p.ID ?? '').trim(),
      ronda: String(p.ronda ?? p.Ronda ?? 'octavos').trim(),
      orden: Number(p.orden ?? p.Orden ?? 0) || 0,
      lado: String(p.lado ?? p.Lado ?? 'centro').trim(),
      equipoAId: String(p.equipoAId ?? p.Equipo_A_ID ?? '').trim(),
      equipoBId: String(p.equipoBId ?? p.Equipo_B_ID ?? '').trim(),
      golesA: Number.isFinite(golesA) ? golesA : null,
      golesB: Number.isFinite(golesB) ? golesB : null,
      estado: normalizarEstado(p.estado ?? p.Estado ?? 'Próximo'),
      fecha: String(p.fecha ?? p.Fecha ?? '').trim(),
      hora: String(p.hora ?? p.Hora ?? '').trim(),
      cancha: String(p.cancha ?? p.Cancha ?? '').trim(),
    };
  }

  function normalizarEstado(estado) {
    const e = String(estado || '').trim().toLowerCase();
    if (e.includes('juego') || e === 'live') return 'En Juego';
    if (e.includes('final') || e === 'ft') return 'Finalizado';
    return 'Próximo';
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return emptyLlave();
    const tamaño = Number(raw.tamaño) === 8 ? 8 : 16;
    let partidos = Array.isArray(raw.partidos) ? raw.partidos.map(mapPartido) : [];
    if (!partidos.length && raw.activa) {
      partidos = crearEstructura(tamaño).partidos;
    }
    return {
      activa: Boolean(raw.activa),
      tamaño,
      partidos,
    };
  }

  function ganadorDe(partido) {
    if (!partido || partido.estado !== 'Finalizado') return '';
    if (partido.golesA === null || partido.golesB === null) return '';
    if (partido.golesA > partido.golesB) return partido.equipoAId;
    if (partido.golesB > partido.golesA) return partido.equipoBId;
    return ''; // empate: no avanza automático
  }

  /**
   * Propaga ganadores a la siguiente ronda.
   * No pisa equipos ya cargados manualmente si el partido siguiente ya está finalizado.
   */
  function propagarGanadores(llave) {
    const data = normalize(llave);
    const rondas = rondasPara(data.tamaño).map((r) => r.key);

    for (let r = 0; r < rondas.length - 1; r++) {
      const actual = rondas[r];
      const siguiente = rondas[r + 1];
      const partidosActual = data.partidos
        .filter((p) => p.ronda === actual)
        .sort((a, b) => a.orden - b.orden);
      const partidosSig = data.partidos
        .filter((p) => p.ronda === siguiente)
        .sort((a, b) => a.orden - b.orden);

      partidosSig.forEach((sig, i) => {
        if (sig.estado === 'Finalizado') return;
        const a = partidosActual[i * 2];
        const b = partidosActual[i * 2 + 1];
        const ga = ganadorDe(a);
        const gb = ganadorDe(b);
        if (ga) sig.equipoAId = ga;
        if (gb) sig.equipoBId = gb;
      });
    }

    return data;
  }

  function partidosPorRonda(llave, ronda) {
    return normalize(llave)
      .partidos.filter((p) => p.ronda === ronda)
      .sort((a, b) => a.orden - b.orden);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function nombreEquipo(equipos, id) {
    if (!id) return 'Por definir';
    return equipos.find((e) => e.id === id)?.nombre || `Equipo ${id}`;
  }

  function colorEquipo(equipos, id) {
    return equipos.find((e) => e.id === id)?.color || '#0D1B3E';
  }

  function slotHtml(partido, equipos, sideClass = '') {
    const a = nombreEquipo(equipos, partido.equipoAId);
    const b = nombreEquipo(equipos, partido.equipoBId);
    const scoreA = partido.golesA === null ? '' : partido.golesA;
    const scoreB = partido.golesB === null ? '' : partido.golesB;
    const winA = ganadorDe(partido) && ganadorDe(partido) === partido.equipoAId;
    const winB = ganadorDe(partido) && ganadorDe(partido) === partido.equipoBId;
    const pending = !partido.equipoAId && !partido.equipoBId;

    return `
      <article class="bracket-match ${sideClass} ${pending ? 'is-empty' : ''} estado-${escapeHtml(partido.estado.replace(/\s/g, '-').toLowerCase())}" data-llave-id="${escapeHtml(partido.id)}">
        <div class="bracket-team ${winA ? 'is-winner' : ''} ${!partido.equipoAId ? 'is-tbd' : ''}">
          <span class="bracket-dot" style="background:${escapeHtml(colorEquipo(equipos, partido.equipoAId))}"></span>
          <span class="bracket-name">${escapeHtml(a)}</span>
          <span class="bracket-score">${scoreA}</span>
        </div>
        <div class="bracket-team ${winB ? 'is-winner' : ''} ${!partido.equipoBId ? 'is-tbd' : ''}">
          <span class="bracket-dot" style="background:${escapeHtml(colorEquipo(equipos, partido.equipoBId))}"></span>
          <span class="bracket-name">${escapeHtml(b)}</span>
          <span class="bracket-score">${scoreB}</span>
        </div>
      </article>`;
  }

  /**
   * Render estilo llave simétrica (izq → centro ← der).
   */
  function render(container, llave, equipos) {
    if (!container) return;
    const data = propagarGanadores(normalize(llave));

    if (!data.activa || !data.partidos.length) {
      container.innerHTML = `
        <div class="empty-state honor-locked">
          <h2>Llave aún no iniciada</h2>
          <p>Cuando el campeonato pase a eliminación directa, los operadores activarán la llave desde el panel y se irá colocando aquí.</p>
        </div>`;
      return;
    }

    const rondas = rondasPara(data.tamaño);
    const firstKey = rondas[0].key;

    // Columnas: izq rounds (sin final) + final + der rounds (sin final, invertidas)
    const sideRounds = rondas.filter((r) => r.key !== 'final');
    const finalMatch = data.partidos.find((p) => p.ronda === 'final');

    const colIzq = sideRounds
      .map((r) => {
        const matches = partidosPorRonda(data, r.key).filter((p) => p.lado === 'izq' || (p.lado === 'centro' && p.orden < r.count / 2));
        // For cuartos/semis after filter by lado
        const list =
          r.key === firstKey
            ? partidosPorRonda(data, r.key).filter((p) => p.lado === 'izq')
            : partidosPorRonda(data, r.key).filter((p) => p.lado === 'izq');
        return `
          <div class="bracket-round bracket-round-izq" data-ronda="${r.key}">
            <h3 class="bracket-round-title">${escapeHtml(r.label)}</h3>
            <div class="bracket-round-matches">
              ${list.map((p) => slotHtml(p, equipos)).join('')}
            </div>
          </div>`;
      })
      .join('');

    const colDer = [...sideRounds]
      .reverse()
      .map((r) => {
        const list = partidosPorRonda(data, r.key).filter((p) => p.lado === 'der');
        return `
          <div class="bracket-round bracket-round-der" data-ronda="${r.key}">
            <h3 class="bracket-round-title">${escapeHtml(r.label)}</h3>
            <div class="bracket-round-matches">
              ${list.map((p) => slotHtml(p, equipos)).join('')}
            </div>
          </div>`;
      })
      .join('');

    const campeonId = finalMatch ? ganadorDe(finalMatch) : '';
    const campeonNombre = campeonId ? nombreEquipo(equipos, campeonId) : '';

    container.innerHTML = `
      <div class="bracket-meta">
        <span class="badge badge-en-juego">Eliminación directa · ${data.tamaño} equipos</span>
        ${campeonNombre ? `<span class="bracket-champ">Campeón: <strong>${escapeHtml(campeonNombre)}</strong></span>` : ''}
      </div>
      <div class="bracket-scroll">
        <div class="bracket-board tamaño-${data.tamaño}">
          <div class="bracket-side bracket-side-izq">${colIzq}</div>
          <div class="bracket-final-col">
            <h3 class="bracket-round-title">Final</h3>
            ${finalMatch ? slotHtml(finalMatch, equipos, 'bracket-final-match') : ''}
            ${
              campeonNombre
                ? `<div class="bracket-trophy"><span>🏆</span><p>${escapeHtml(campeonNombre)}</p></div>`
                : '<div class="bracket-trophy is-pending"><span>🏆</span><p>Por definirse</p></div>'
            }
          </div>
          <div class="bracket-side bracket-side-der">${colDer}</div>
        </div>
      </div>
      <p class="bracket-hint">Deslizá horizontalmente en móvil para ver toda la llave.</p>`;
  }

  /** Demo parcial para modo ejemplo */
  function demoLlave(equipos) {
    const llave = crearEstructura(16);
    const ids = equipos.slice(0, 16).map((e) => e.id);
    while (ids.length < 16) ids.push('');

    const octavos = llave.partidos.filter((p) => p.ronda === 'octavos').sort((a, b) => a.orden - b.orden);
    octavos.forEach((p, i) => {
      p.equipoAId = ids[i * 2] || '';
      p.equipoBId = ids[i * 2 + 1] || '';
    });

    // Simular algunos resultados de octavos
    [0, 1, 2, 3].forEach((i) => {
      if (octavos[i]?.equipoAId && octavos[i]?.equipoBId) {
        octavos[i].golesA = 2;
        octavos[i].golesB = 1;
        octavos[i].estado = 'Finalizado';
      }
    });

    return propagarGanadores(llave);
  }

  return {
    emptyLlave,
    crearEstructura,
    normalize,
    mapPartido,
    propagarGanadores,
    ganadorDe,
    partidosPorRonda,
    rondasPara,
    render,
    demoLlave,
  };
})();
