/**
 * Aplicación principal — tabs, filtros, polling y sincronización.
 */
(() => {
  const state = {
    data: null,
    tabla: [],
    partidoSeleccionado: null,
    lastUpdate: null,
    timer: null,
    clock: null,
    updating: false,
  };

  const els = {
    overlay: document.getElementById('loading-overlay'),
    sync: document.getElementById('sync-indicator'),
    syncText: document.getElementById('sync-text'),
    demoBadge: document.getElementById('demo-badge'),
    lastUpdate: document.getElementById('last-update'),
    tablaContainer: document.getElementById('tabla-container'),
    fixtureContainer: document.getElementById('fixture-container'),
    detalleContainer: document.getElementById('detalle-container'),
    honorContainer: document.getElementById('honor-container'),
    llaveContainer: document.getElementById('llave-container'),
    filtroGrupo: document.getElementById('filtro-grupo'),
    buscarEquipo: document.getElementById('buscar-equipo'),
    filtroFecha: document.getElementById('filtro-fecha'),
    filtroEstado: document.getElementById('filtro-estado'),
    btnVolver: document.getElementById('btn-volver-fixture'),
    tabs: document.querySelectorAll('.tab'),
    panels: {
      tabla: document.getElementById('panel-tabla'),
      fixture: document.getElementById('panel-fixture'),
      llave: document.getElementById('panel-llave'),
      detalles: document.getElementById('panel-detalles'),
      honor: document.getElementById('panel-honor'),
    },
  };

  function setLoading(show) {
    if (!els.overlay) return;
    els.overlay.classList.toggle('is-hidden', !show);
    els.overlay.setAttribute('aria-busy', show ? 'true' : 'false');
  }

  function setSync(status, message) {
    if (!els.sync || !els.syncText) return;
    els.sync.classList.toggle('is-updating', status === 'updating');
    els.sync.classList.toggle('is-error', status === 'error');
    els.syncText.textContent = message;
  }

  function relativeTime(ts) {
    if (!ts) return '—';
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (sec < 5) return 'hace unos segundos';
    if (sec < 60) return `hace ${sec} s`;
    const min = Math.floor(sec / 60);
    return `hace ${min} min`;
  }

  function refreshTimestamps() {
    if (els.lastUpdate) {
      els.lastUpdate.textContent = `Última actualización: ${relativeTime(state.lastUpdate)}`;
    }
    if (!state.updating && state.lastUpdate && els.syncText && !els.sync.classList.contains('is-error')) {
      els.syncText.textContent = `Actualizado ${relativeTime(state.lastUpdate)}`;
    }
  }

  function activateTab(name) {
    els.tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    Object.entries(els.panels).forEach(([key, panel]) => {
      if (!panel) return;
      const active = key === name;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    if (name === 'honor' && state.data) {
      renderHonor();
    }
    if (name === 'llave' && state.data) {
      renderLlave();
    }
  }

  function filtrosTabla() {
    return {
      grupo: els.filtroGrupo?.value || '',
      busqueda: els.buscarEquipo?.value || '',
    };
  }

  function filtrosFixture() {
    return {
      fecha: els.filtroFecha?.value || '',
      estado: els.filtroEstado?.value || '',
      busqueda: els.buscarEquipo?.value || '',
    };
  }

  function renderTabla() {
    if (!state.data) return;
    TablaPosiciones.render(els.tablaContainer, state.tabla, filtrosTabla());
  }

  function renderFixture() {
    if (!state.data) return;
    Fixture.generarFixture(
      els.fixtureContainer,
      state.data.fixture,
      state.data.equipos,
      state.data.resultados,
      filtrosFixture()
    );
  }

  function renderDetalle() {
    if (!state.data || !state.partidoSeleccionado) return;
    Fixture.renderDetalle(
      els.detalleContainer,
      state.partidoSeleccionado,
      state.data.fixture,
      state.data.equipos,
      state.data.resultados,
      state.data.jugadores
    );
  }

  function renderHonor() {
    if (!state.data) return;
    CuadroHonor.generarCuadroHonor(els.honorContainer, {
      equipos: state.data.equipos,
      jugadores: state.data.jugadores,
      tabla: state.tabla,
      torneoFinalizado: Boolean(state.data.torneoFinalizado ?? CONFIG.TORNEO_FINALIZADO),
    });
  }

  function renderLlave() {
    if (!state.data || !els.llaveContainer) return;
    const llave = state.data.llave || { activa: false, tamaño: 16, partidos: [] };
    Llave.render(els.llaveContainer, llave, state.data.equipos || []);
  }

  function renderAll({ updateFilters = true } = {}) {
    if (!state.data) return;
    state.tabla = TablaPosiciones.calcularTablaPosiciones(
      state.data.equipos,
      state.data.fixture,
      state.data.resultados
    );

    if (updateFilters) {
      TablaPosiciones.poblarFiltroGrupos(els.filtroGrupo, state.tabla);
      Fixture.poblarFiltroFechas(els.filtroFecha, state.data.fixture);
    }

    renderTabla();
    renderFixture();
    renderLlave();
    if (state.partidoSeleccionado) renderDetalle();

    const honorVisible = els.panels.honor?.classList.contains('is-active');
    if (honorVisible) renderHonor();
  }

  async function actualizarDatos({ force = false, initial = false } = {}) {
    if (state.updating) return;
    state.updating = true;
    setSync('updating', 'Actualizando…');

    try {
      const result = await GoogleSheets.cargarDatos({ force });
      state.data = result.data;
      state.lastUpdate = Date.now();

      if (els.demoBadge) {
        const source = result.source || (result.demo ? 'demo' : 'local');
        const labels = {
          demo: 'Modo demo',
          local: 'Datos locales',
          json: 'Datos publicados',
          sheets: 'Google Sheets',
        };
        els.demoBadge.textContent = labels[source] || source;
        els.demoBadge.classList.toggle('hidden', source === 'sheets');
        els.demoBadge.classList.toggle('is-live', source === 'local' || source === 'json');
      }

      if (result.changed || initial || !state.tabla.length) {
        renderAll({ updateFilters: true });
      }

      if (result.offline) {
        setSync('error', 'Sin conexión · caché');
      } else if (result.error) {
        setSync('error', 'Error · usando caché');
      } else {
        setSync('ok', `Actualizado ${relativeTime(state.lastUpdate)}`);
      }
    } catch (err) {
      console.error('[Copa Magisterial]', err);
      setSync('error', 'Error al cargar datos');
      if (initial && els.tablaContainer) {
        els.tablaContainer.innerHTML = `
          <p class="empty-state">
            No se pudieron cargar los datos.<br />
            <small>${String(err.message || err)}</small><br />
            Revisá la API Key / Sheet ID en <code>js/config.js</code> o usá el modo demo.
          </p>`;
      }
    } finally {
      state.updating = false;
      if (initial) setLoading(false);
      refreshTimestamps();
    }
  }

  function bindEvents() {
    els.tabs.forEach((tab) => {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    });

    els.filtroGrupo?.addEventListener('change', renderTabla);
    els.buscarEquipo?.addEventListener('input', () => {
      renderTabla();
      renderFixture();
    });
    els.filtroFecha?.addEventListener('change', renderFixture);
    els.filtroEstado?.addEventListener('change', renderFixture);

    Fixture.setOnPartidoClick((id) => {
      state.partidoSeleccionado = id;
      renderDetalle();
      activateTab('detalles');
    });

    els.btnVolver?.addEventListener('click', () => activateTab('fixture'));

    window.addEventListener('online', () => actualizarDatos({ force: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') actualizarDatos({ force: true });
    });
  }

  function startPolling() {
    const interval = Math.max(3000, CONFIG.ACTUALIZAR_CADA || 5000);
    state.timer = setInterval(() => actualizarDatos(), interval);
    state.clock = setInterval(refreshTimestamps, 1000);
  }

  async function init() {
    document.title = CONFIG.TORNEO_NOMBRE || document.title;
    bindEvents();
    activateTab('tabla');
    await actualizarDatos({ force: true, initial: true });
    startPolling();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
