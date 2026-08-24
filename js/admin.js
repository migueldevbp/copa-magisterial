/**
 * Panel operadores — CRUD + export/import.
 */
(() => {
  let store = DataStore.emptyBundle();
  let modalMode = null; // { type, id? }
  let toastTimer = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function toast(msg, isError = false) {
    const el = $('#admin-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('is-error', isError);
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
  }

  function persist() {
    store = DataStore.saveLocal(store);
    // Invalidar caché del dashboard público
    try {
      localStorage.removeItem(CONFIG.CACHE_KEY);
    } catch {
      /* ignore */
    }
    renderAll();
    updateMeta();
  }

  function loadStore() {
    store = DataStore.loadLocal() || DataStore.emptyBundle();
  }

  function equipoNombre(id) {
    return store.equipos.find((e) => e.id === id)?.nombre || `ID ${id}`;
  }

  function updateMeta() {
    const el = $('#store-meta');
    const chk = $('#chk-finalizado');
    if (chk) chk.checked = Boolean(store.torneoFinalizado);
    if (!el) return;
    if (!store.updatedAt && !store.equipos.length) {
      el.textContent = 'Sin datos guardados aún. Empezá cargando equipos o usá el ejemplo.';
      return;
    }
    const when = store.updatedAt ? new Date(store.updatedAt).toLocaleString('es-AR') : '—';
    el.textContent = `Último guardado: ${when} · ${store.equipos.length} equipos · ${store.fixture.length} partidos · ${store.jugadores.length} jugadores · llave ${store.llave?.activa ? 'ON' : 'OFF'}`;
  }

  function updateLlaveMeta() {
    const el = $('#llave-meta');
    if (!el) return;
    if (!store.llave?.activa) {
      el.textContent = 'Llave inactiva.';
      return;
    }
    const n = store.llave.partidos?.length || 0;
    el.textContent = `Llave activa · ${store.llave.tamaño} equipos · ${n} partidos en el cuadro`;
    const sizeSel = $('#llave-size');
    if (sizeSel) sizeSel.value = String(store.llave.tamaño || 16);
  }

  function showApp(show) {
    $('#login-screen')?.classList.toggle('hidden', show);
    $('#admin-app')?.classList.toggle('hidden', !show);
  }

  function activateSection(name) {
    $$('.admin-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.section === name));
    $$('.admin-section').forEach((s) => s.classList.toggle('is-active', s.id === `sec-${name}`));
    if (['delegados', 'pendientes', 'reclamos', 'jugadores'].includes(name) && !store.equipos.length) {
      ensureEquiposLoaded();
    }
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderEquipos() {
    const tbody = $('#table-equipos tbody');
    if (!tbody) return;
    if (!store.equipos.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-admin">Sin equipos. Agregá el primero.</td></tr>`;
      return;
    }
    tbody.innerHTML = store.equipos
      .map(
        (e) => `<tr>
        <td>${escapeHtml(e.id)}</td>
        <td>${escapeHtml(e.nombre)}</td>
        <td>${escapeHtml(e.colegio)}</td>
        <td>${escapeHtml(e.grupo)}</td>
        <td><span class="color-swatch" style="background:${escapeHtml(e.color)}"></span>${escapeHtml(e.color)}</td>
        <td class="actions">
          <button type="button" data-edit="equipo" data-id="${escapeHtml(e.id)}">Editar</button>
          <button type="button" class="btn-del" data-del="equipo" data-id="${escapeHtml(e.id)}">Borrar</button>
        </td>
      </tr>`
      )
      .join('');
  }

  function renderFixture() {
    const tbody = $('#table-fixture tbody');
    if (!tbody) return;
    if (!store.fixture.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-admin">Sin partidos.</td></tr>`;
      return;
    }
    const sorted = [...store.fixture].sort((a, b) =>
      `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`)
    );
    tbody.innerHTML = sorted
      .map(
        (p) => `<tr>
        <td>${escapeHtml(p.id)}</td>
        <td>${escapeHtml(p.fecha)}</td>
        <td>${escapeHtml(p.hora)}</td>
        <td>${escapeHtml(equipoNombre(p.equipoAId))}</td>
        <td>${escapeHtml(equipoNombre(p.equipoBId))}</td>
        <td>${escapeHtml(p.cancha)}</td>
        <td>${escapeHtml(p.estado)}</td>
        <td class="actions">
          <button type="button" data-edit="partido" data-id="${escapeHtml(p.id)}">Editar</button>
          <button type="button" data-edit="resultado-rapido" data-id="${escapeHtml(p.id)}">Acta</button>
          <button type="button" class="btn-del" data-del="partido" data-id="${escapeHtml(p.id)}">Borrar</button>
        </td>
      </tr>`
      )
      .join('');
  }

  function renderResultados() {
    const tbody = $('#table-resultados tbody');
    if (!tbody) return;
    if (!store.resultados.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-admin">Sin resultados cargados.</td></tr>`;
      return;
    }
    tbody.innerHTML = store.resultados
      .map((r) => {
        const p = store.fixture.find((x) => x.id === r.partidoId);
        const label = p
          ? `${equipoNombre(p.equipoAId)} vs ${equipoNombre(p.equipoBId)}`
          : `Partido ${r.partidoId}`;
        return `<tr>
          <td>${escapeHtml(label)} <small>(#${escapeHtml(r.partidoId)})</small></td>
          <td><strong>${r.golesA} — ${r.golesB}</strong></td>
          <td>${r.aprobado ? 'SI' : 'NO'}</td>
          <td>${escapeHtml(r.goleadoresA || '-')} / ${escapeHtml(r.goleadoresB || '-')}</td>
          <td class="actions">
            <button type="button" data-edit="resultado" data-id="${escapeHtml(r.partidoId)}">Editar</button>
            <button type="button" class="btn-del" data-del="resultado" data-id="${escapeHtml(r.partidoId)}">Borrar</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function fillJugEquipoFilter() {
    const sel = $('#filtro-jug-equipo');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML =
      '<option value="">Todos los equipos</option>' +
      store.equipos
        .map((e) => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.nombre)}</option>`)
        .join('');
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
  }

  function renderJugadores() {
    const tbody = $('#table-jugadores tbody');
    if (!tbody) return;
    const filtro = $('#filtro-jug-equipo')?.value || '';
    let list = store.jugadores;
    if (filtro) list = list.filter((j) => j.equipoId === filtro);
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-admin">Sin jugadores.</td></tr>`;
      return;
    }
    tbody.innerHTML = list
      .map(
        (j) => `<tr>
        <td>${escapeHtml(equipoNombre(j.equipoId))}</td>
        <td>${escapeHtml(j.numero)}</td>
        <td>${escapeHtml(j.nombre)} ${escapeHtml(j.apellido)}</td>
        <td>${escapeHtml(j.posicion)}</td>
        <td>${j.goles}</td>
        <td>${j.tarjetasA}</td>
        <td>${j.tarjetasR}</td>
        <td class="actions">
          <button type="button" data-edit="jugador" data-id="${escapeHtml(j.id)}">Editar</button>
          <button type="button" class="btn-del" data-del="jugador" data-id="${escapeHtml(j.id)}">Borrar</button>
        </td>
      </tr>`
      )
      .join('');
  }

  function renderLlave() {
    const tbody = $('#table-llave tbody');
    updateLlaveMeta();
    if (!tbody) return;
    if (!store.llave?.activa || !store.llave.partidos?.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-admin">Generá la llave para comenzar a colocar equipos.</td></tr>`;
      return;
    }
    store.llave = Llave.propagarGanadores(store.llave);
    const order = { octavos: 1, cuartos: 2, semis: 3, final: 4 };
    const list = [...store.llave.partidos].sort(
      (a, b) => (order[a.ronda] || 9) - (order[b.ronda] || 9) || a.orden - b.orden
    );
    tbody.innerHTML = list
      .map((p) => {
        const marcador =
          p.golesA === null && p.golesB === null ? '—' : `${p.golesA ?? '-'} — ${p.golesB ?? '-'}`;
        return `<tr>
          <td>${escapeHtml(p.id)}</td>
          <td>${escapeHtml(p.ronda)}</td>
          <td>${escapeHtml(p.equipoAId ? equipoNombre(p.equipoAId) : 'Por definir')}</td>
          <td>${escapeHtml(p.equipoBId ? equipoNombre(p.equipoBId) : 'Por definir')}</td>
          <td>${escapeHtml(marcador)}</td>
          <td>${escapeHtml(p.estado)}</td>
          <td class="actions">
            <button type="button" data-edit="llave" data-id="${escapeHtml(p.id)}">Editar</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function renderDelegados() {
    const tbody = $('#table-delegados tbody');
    if (!tbody) return;
    if (!store.equipos.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-admin">Primero bajá los equipos: <strong>Google Sheets → ↓ Bajar desde Sheets</strong></td></tr>`;
      return;
    }
    if (!store.delegados?.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-admin">Sin accesos. Creá uno por equipo (+ Acceso).</td></tr>`;
      return;
    }
    tbody.innerHTML = store.delegados
      .map(
        (d) => `<tr>
        <td>${escapeHtml(equipoNombre(d.equipoId))}</td>
        <td>${escapeHtml(d.nombre || '—')}</td>
        <td>${escapeHtml(d.telefono || '—')}</td>
        <td><code>${escapeHtml(d.clave)}</code></td>
        <td class="actions">
          <button type="button" data-edit="delegado" data-id="${escapeHtml(d.equipoId)}">Editar</button>
          <button type="button" class="btn-del" data-del="delegado" data-id="${escapeHtml(d.equipoId)}">Borrar</button>
        </td>
      </tr>`
      )
      .join('');
  }

  function renderReclamosAdmin() {
    const tbody = $('#table-reclamos tbody');
    if (!tbody) return;
    if (!store.reclamos?.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-admin">Sin reclamos.</td></tr>`;
      return;
    }
    tbody.innerHTML = [...store.reclamos]
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
      .map(
        (r) => `<tr>
        <td>${escapeHtml(r.fecha)}</td>
        <td>${escapeHtml(equipoNombre(r.equipoId))}</td>
        <td>${escapeHtml(r.asunto)}<br><small>${escapeHtml(r.detalle)}</small></td>
        <td>${escapeHtml(r.estado)}</td>
        <td class="actions">
          <button type="button" data-edit="reclamo" data-id="${escapeHtml(r.id)}">Responder</button>
          <button type="button" class="btn-del" data-del="reclamo" data-id="${escapeHtml(r.id)}">Borrar</button>
        </td>
      </tr>`
      )
      .join('');
  }

  function renderPendientesAdmin() {
    const tbody = $('#table-pendientes tbody');
    if (!tbody) return;
    if (!store.pendientes?.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-admin">Sin pendientes.</td></tr>`;
      return;
    }
    tbody.innerHTML = store.pendientes
      .map(
        (p) => `<tr>
        <td>${escapeHtml(equipoNombre(p.equipoId))}</td>
        <td>${escapeHtml(p.concepto)}</td>
        <td>${escapeHtml(p.monto)}</td>
        <td>${escapeHtml(p.vencimiento || '—')}</td>
        <td>${escapeHtml(p.estado)}</td>
        <td class="actions">
          <button type="button" data-edit="pendiente" data-id="${escapeHtml(p.id)}">Editar</button>
          <button type="button" class="btn-del" data-del="pendiente" data-id="${escapeHtml(p.id)}">Borrar</button>
        </td>
      </tr>`
      )
      .join('');
  }

  function renderAll() {
    fillJugEquipoFilter();
    renderEquipos();
    renderFixture();
    renderResultados();
    renderJugadores();
    renderLlave();
    renderDelegados();
    renderReclamosAdmin();
    renderPendientesAdmin();
    updateMeta();
  }

  function equipoOptions(selected = '') {
    if (!store.equipos.length) {
      return '<option value="">— Sin equipos cargados —</option>';
    }
    return store.equipos
      .map(
        (e) =>
          `<option value="${escapeHtml(e.id)}" ${e.id === selected ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`
      )
      .join('');
  }

  async function ensureEquiposLoaded() {
    if (store.equipos.length) return true;
    try {
      toast('Cargando equipos desde Sheets…');
      let data = null;

      // 1) Lectura por API Key (no depende de action "read" del Apps Script)
      if (GoogleSheets.isConfigured()) {
        try {
          data = await GoogleSheets.fetchViaApi();
        } catch (apiErr) {
          console.warn('API Sheets:', apiErr);
        }
      }

      // 2) Fallback Apps Script (admin read)
      if ((!data || !data.equipos?.length) && GoogleSheets.isWriteConfigured()) {
        try {
          data = await GoogleSheets.pullFromScript();
        } catch (scriptErr) {
          console.warn('Apps Script:', scriptErr);
          if (!data) throw scriptErr;
        }
      }

      if (!data) {
        toast('No hay equipos. Cargalos en Equipos o conectá Sheets.', true);
        return false;
      }

      const prevDelegados = store.delegados || [];
      const prevReclamos = store.reclamos || [];
      const prevPendientes = store.pendientes || [];
      store = DataStore.normalizeBundle({
        ...data,
        delegados: data.delegados?.length ? data.delegados : prevDelegados,
        reclamos: data.reclamos?.length ? data.reclamos : prevReclamos,
        pendientes: data.pendientes?.length ? data.pendientes : prevPendientes,
        torneoFinalizado: data.torneoFinalizado,
        source: 'local',
      });
      persist();
      if (!store.equipos.length) {
        toast('El Sheet no tiene equipos. Cargalos en Equipos y subí a Sheets.', true);
        return false;
      }
      toast(`${store.equipos.length} equipos cargados`);
      return true;
    } catch (err) {
      toast(String(err.message || err), true);
      return false;
    }
  }

  function partidoOptions(selected = '') {
    return store.fixture
      .map((p) => {
        const label = `#${p.id} ${equipoNombre(p.equipoAId)} vs ${equipoNombre(p.equipoBId)} (${p.fecha})`;
        return `<option value="${escapeHtml(p.id)}" ${p.id === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
      })
      .join('');
  }

  function openModal(type, id = null) {
    modalMode = { type, id };
    const title = $('#modal-title');
    const fields = $('#modal-fields');
    const modal = $('#modal');
    if (!fields || !modal) return;

    const titles = {
      equipo: id ? 'Editar equipo' : 'Nuevo equipo',
      partido: id ? 'Editar partido' : 'Nuevo partido',
      resultado: id ? 'Editar resultado' : 'Cargar resultado',
      'resultado-rapido': 'Cargar / editar acta',
      jugador: id ? 'Editar jugador' : 'Nuevo jugador',
      llave: 'Editar partido de llave',
      delegado: id ? 'Editar acceso delegado' : 'Nuevo acceso delegado',
      reclamo: 'Responder reclamo',
      pendiente: id ? 'Editar pendiente' : 'Nuevo pendiente',
    };
    title.textContent = titles[type] || 'Editar';

    if (type === 'equipo') {
      const e = store.equipos.find((x) => x.id === id) || {
        id: DataStore.nextId(store.equipos),
        nombre: '',
        colegio: '',
        grupo: 'A',
        color: '#0D1B3E',
        logo: '',
      };
      fields.innerHTML = `
        <label>ID <input name="id" value="${escapeHtml(e.id)}" ${id ? 'readonly' : ''} required /></label>
        <label>Nombre <input name="nombre" value="${escapeHtml(e.nombre)}" required /></label>
        <label>Colegio <input name="colegio" value="${escapeHtml(e.colegio)}" /></label>
        <label>Grupo <input name="grupo" value="${escapeHtml(e.grupo)}" required /></label>
        <label>Color <input name="color" type="color" value="${escapeHtml(e.color || '#0D1B3E')}" /></label>
        <label>Logo URL <input name="logo" value="${escapeHtml(e.logo)}" placeholder="https://..." /></label>`;
    }

    if (type === 'partido') {
      const p = store.fixture.find((x) => x.id === id) || {
        id: DataStore.nextId(store.fixture),
        fecha: '',
        hora: '',
        equipoAId: store.equipos[0]?.id || '',
        equipoBId: store.equipos[1]?.id || '',
        cancha: '',
        estado: 'Próximo',
      };
      fields.innerHTML = `
        <label>ID <input name="id" value="${escapeHtml(p.id)}" ${id ? 'readonly' : ''} required /></label>
        <label>Fecha <input name="fecha" type="date" value="${escapeHtml(p.fecha)}" required /></label>
        <label>Hora <input name="hora" type="time" value="${escapeHtml(p.hora)}" required /></label>
        <label>Equipo A <select name="equipoAId" required>${equipoOptions(p.equipoAId)}</select></label>
        <label>Equipo B <select name="equipoBId" required>${equipoOptions(p.equipoBId)}</select></label>
        <label>Cancha <input name="cancha" value="${escapeHtml(p.cancha)}" /></label>
        <label>Estado
          <select name="estado">
            <option ${p.estado === 'Próximo' ? 'selected' : ''}>Próximo</option>
            <option ${p.estado === 'En Juego' ? 'selected' : ''}>En Juego</option>
            <option ${p.estado === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
          </select>
        </label>`;
    }

    if (type === 'resultado' || type === 'resultado-rapido') {
      const partidoId = id || '';
      const r = store.resultados.find((x) => x.partidoId === partidoId) || {
        partidoId,
        golesA: 0,
        golesB: 0,
        aprobado: true,
        goleadoresA: '',
        goleadoresB: '',
        tarjetasA: '',
        tarjetasB: '',
      };
      fields.innerHTML = `
        <label>Partido
          <select name="partidoId" required ${type === 'resultado-rapido' ? '' : ''}>
            ${partidoOptions(r.partidoId)}
          </select>
        </label>
        <label>Goles A <input name="golesA" type="number" min="0" value="${r.golesA}" required /></label>
        <label>Goles B <input name="golesB" type="number" min="0" value="${r.golesB}" required /></label>
        <label>Aprobado
          <select name="aprobado">
            <option value="SI" ${r.aprobado ? 'selected' : ''}>SI</option>
            <option value="NO" ${!r.aprobado ? 'selected' : ''}>NO</option>
          </select>
        </label>
        <label>Goleadores A <input name="goleadoresA" value="${escapeHtml(r.goleadoresA)}" placeholder="Juan(2), Pedro(1)" /></label>
        <label>Goleadores B <input name="goleadoresB" value="${escapeHtml(r.goleadoresB)}" /></label>
        <label>Tarjetas A <input name="tarjetasA" value="${escapeHtml(r.tarjetasA)}" placeholder="Carlos(A)" /></label>
        <label>Tarjetas B <input name="tarjetasB" value="${escapeHtml(r.tarjetasB)}" /></label>
        <label class="switch-row"><input type="checkbox" name="marcarFinalizado" checked /> Marcar partido como Finalizado</label>`;
    }

    if (type === 'jugador') {
      const j = store.jugadores.find((x) => x.id === id) || {
        id: '',
        equipoId: store.equipos[0]?.id || '',
        nombre: '',
        apellido: '',
        dni: '',
        posicion: 'Delantero',
        numero: '',
        goles: 0,
        tarjetasA: 0,
        tarjetasR: 0,
      };
      fields.innerHTML = `
        <input type="hidden" name="id" value="${escapeHtml(j.id)}" />
        <label>Equipo <select name="equipoId" required>${equipoOptions(j.equipoId)}</select></label>
        <label>Nombre <input name="nombre" value="${escapeHtml(j.nombre)}" required /></label>
        <label>Apellido <input name="apellido" value="${escapeHtml(j.apellido)}" required /></label>
        <label>DNI / código <input name="dni" value="${escapeHtml(j.dni)}" /></label>
        <label>Posición <input name="posicion" value="${escapeHtml(j.posicion)}" list="pos-list" />
          <datalist id="pos-list">
            <option value="Portero"><option value="Defensa"><option value="Mediocampista"><option value="Delantero">
          </datalist>
        </label>
        <label>Número <input name="numero" value="${escapeHtml(j.numero)}" /></label>
        <label>Goles <input name="goles" type="number" min="0" value="${j.goles}" /></label>
        <label>Tarjetas amarillas <input name="tarjetasA" type="number" min="0" value="${j.tarjetasA}" /></label>
        <label>Tarjetas rojas <input name="tarjetasR" type="number" min="0" value="${j.tarjetasR}" /></label>`;
    }

    if (type === 'llave') {
      const p = store.llave?.partidos?.find((x) => x.id === id);
      if (!p) {
        toast('Partido de llave no encontrado', true);
        return;
      }
      const optEmpty = '<option value="">Por definir</option>';
      fields.innerHTML = `
        <p class="admin-help">Ronda: <strong>${escapeHtml(p.ronda)}</strong> · ${escapeHtml(p.id)}</p>
        <input type="hidden" name="id" value="${escapeHtml(p.id)}" />
        <label>Equipo A <select name="equipoAId">${optEmpty}${equipoOptions(p.equipoAId)}</select></label>
        <label>Equipo B <select name="equipoBId">${optEmpty}${equipoOptions(p.equipoBId)}</select></label>
        <label>Goles A <input name="golesA" type="number" min="0" value="${p.golesA === null ? '' : p.golesA}" /></label>
        <label>Goles B <input name="golesB" type="number" min="0" value="${p.golesB === null ? '' : p.golesB}" /></label>
        <label>Estado
          <select name="estado">
            <option ${p.estado === 'Próximo' ? 'selected' : ''}>Próximo</option>
            <option ${p.estado === 'En Juego' ? 'selected' : ''}>En Juego</option>
            <option ${p.estado === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
          </select>
        </label>
        <label>Fecha <input name="fecha" type="date" value="${escapeHtml(p.fecha)}" /></label>
        <label>Hora <input name="hora" type="time" value="${escapeHtml(p.hora)}" /></label>
        <label>Cancha <input name="cancha" value="${escapeHtml(p.cancha)}" /></label>`;
    }

    if (type === 'delegado') {
      if (!store.equipos.length) {
        fields.innerHTML = `
          <p class="admin-help" style="color:#c62828">
            No hay equipos en el panel.<br />
            Andá a <strong>Google Sheets → ↓ Bajar desde Sheets</strong> (o cargá equipos en la pestaña Equipos) y volvé a intentar.
          </p>`;
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
        return;
      }
      const d = store.delegados.find((x) => x.equipoId === id) || {
        equipoId: store.equipos[0]?.id || '',
        clave: '',
        nombre: '',
        telefono: '',
      };
      fields.innerHTML = `
        <label>Equipo <select name="equipoId" required ${id ? 'disabled' : ''}>${equipoOptions(d.equipoId)}</select></label>
        ${id ? `<input type="hidden" name="equipoId" value="${escapeHtml(d.equipoId)}" />` : ''}
        <label>Nombre delegado <input name="nombre" value="${escapeHtml(d.nombre)}" /></label>
        <label>Teléfono <input name="telefono" value="${escapeHtml(d.telefono)}" /></label>
        <label>Clave de acceso <input name="clave" value="${escapeHtml(d.clave)}" required minlength="4" /></label>`;
    }

    if (type === 'reclamo') {
      const r = store.reclamos.find((x) => x.id === id);
      if (!r) return toast('Reclamo no encontrado', true);
      fields.innerHTML = `
        <input type="hidden" name="id" value="${escapeHtml(r.id)}" />
        <p class="admin-help"><strong>${escapeHtml(equipoNombre(r.equipoId))}</strong> · ${escapeHtml(r.fecha)}<br>${escapeHtml(r.asunto)}<br>${escapeHtml(r.detalle)}</p>
        <label>Estado
          <select name="estado">
            <option ${r.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            <option ${r.estado === 'En revisión' ? 'selected' : ''}>En revisión</option>
            <option ${r.estado === 'Resuelto' ? 'selected' : ''}>Resuelto</option>
            <option ${r.estado === 'Rechazado' ? 'selected' : ''}>Rechazado</option>
          </select>
        </label>
        <label>Respuesta <textarea name="respuesta">${escapeHtml(r.respuesta)}</textarea></label>`;
    }

    if (type === 'pendiente') {
      const p = store.pendientes.find((x) => x.id === id) || {
        id: `P${Date.now()}`,
        equipoId: store.equipos[0]?.id || '',
        concepto: '',
        monto: '',
        vencimiento: '',
        estado: 'Pendiente',
        nota: '',
      };
      fields.innerHTML = `
        <input type="hidden" name="id" value="${escapeHtml(p.id)}" />
        <label>Equipo <select name="equipoId" required>${equipoOptions(p.equipoId)}</select></label>
        <label>Concepto <input name="concepto" value="${escapeHtml(p.concepto)}" required /></label>
        <label>Monto <input name="monto" value="${escapeHtml(p.monto)}" placeholder="S/ 50" /></label>
        <label>Vencimiento <input name="vencimiento" type="date" value="${escapeHtml(p.vencimiento)}" /></label>
        <label>Estado
          <select name="estado">
            <option ${p.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            <option ${p.estado === 'Parcial' ? 'selected' : ''}>Parcial</option>
            <option ${p.estado === 'Pagado' ? 'selected' : ''}>Pagado</option>
          </select>
        </label>
        <label>Nota <input name="nota" value="${escapeHtml(p.nota)}" /></label>`;
    }

    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  }

  function closeModal() {
    const modal = $('#modal');
    if (!modal) return;
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
    modalMode = null;
  }

  function formToObject(form) {
    const fd = new FormData(form);
    const obj = {};
    fd.forEach((v, k) => {
      obj[k] = typeof v === 'string' ? v.trim() : v;
    });
    return obj;
  }

  function saveModal(e) {
    e.preventDefault();
    if (!modalMode) return;
    const form = $('#modal-form');
    const raw = formToObject(form);
    const { type, id } = modalMode;

    if (type === 'equipo') {
      const equipo = DataStore.mapEquipo(raw);
      if (!equipo.id || !equipo.nombre) return toast('Completá ID y nombre', true);
      const idx = store.equipos.findIndex((x) => x.id === equipo.id);
      if (idx >= 0) store.equipos[idx] = equipo;
      else {
        if (store.equipos.some((x) => x.id === equipo.id)) return toast('ID duplicado', true);
        store.equipos.push(equipo);
      }
    }

    if (type === 'partido') {
      const partido = DataStore.mapFixture(raw);
      if (partido.equipoAId === partido.equipoBId) return toast('Los equipos deben ser distintos', true);
      const idx = store.fixture.findIndex((x) => x.id === partido.id);
      if (idx >= 0) store.fixture[idx] = partido;
      else {
        if (store.fixture.some((x) => x.id === partido.id)) return toast('ID duplicado', true);
        store.fixture.push(partido);
      }
    }

    if (type === 'resultado' || type === 'resultado-rapido') {
      const resultado = DataStore.mapResultado({
        ...raw,
        Aprobado: raw.aprobado,
      });
      if (!resultado.partidoId) return toast('Elegí un partido', true);
      const idx = store.resultados.findIndex((x) => x.partidoId === resultado.partidoId);
      if (idx >= 0) store.resultados[idx] = resultado;
      else store.resultados.push(resultado);

      if (raw.marcarFinalizado === 'on' || form.querySelector('[name="marcarFinalizado"]')?.checked) {
        const p = store.fixture.find((x) => x.id === resultado.partidoId);
        if (p) p.estado = 'Finalizado';
      }
    }

    if (type === 'jugador') {
      const jugador = DataStore.mapJugador(raw);
      if (!jugador.nombre || !jugador.apellido || !jugador.equipoId) {
        return toast('Completá equipo y nombre', true);
      }
      if (!jugador.id) {
        jugador.id = `j-${DataStore.nextId(store.jugadores.map((j) => ({ id: j.id.replace(/\D/g, '') || '0' })))}-${Date.now()}`;
      }
      const idx = store.jugadores.findIndex((x) => x.id === jugador.id);
      if (idx >= 0) store.jugadores[idx] = jugador;
      else store.jugadores.push(jugador);
    }

    if (type === 'llave') {
      const idx = store.llave.partidos.findIndex((x) => x.id === raw.id);
      if (idx < 0) return toast('Partido no encontrado', true);
      const prev = store.llave.partidos[idx];
      store.llave.partidos[idx] = Llave.mapPartido({
        ...prev,
        ...raw,
        orden: prev.orden,
        ronda: prev.ronda,
        lado: prev.lado,
        golesA: raw.golesA === '' ? null : raw.golesA,
        golesB: raw.golesB === '' ? null : raw.golesB,
      });
      store.llave = Llave.propagarGanadores(store.llave);
    }

    if (type === 'delegado') {
      const d = DataStore.mapDelegado(raw);
      if (!d.equipoId || !d.clave) return toast('Equipo y clave requeridos', true);
      const idx = store.delegados.findIndex((x) => x.equipoId === d.equipoId);
      if (idx >= 0) store.delegados[idx] = d;
      else store.delegados.push(d);
      persist();
      closeModal();
      toast('Acceso guardado — subiendo a Sheets…');
      // Crítico: sin subir, el portal no puede validar la clave
      (async () => {
        try {
          if (!GoogleSheets.isWriteConfigured()) {
            toast('Guardado local. Configurá Apps Script y subí a Sheets.', true);
            return;
          }
          await GoogleSheets.pushToScript(store);
          toast(`Listo. Portal: equipo "${equipoNombre(d.equipoId)}" · clave: ${d.clave}`);
        } catch (err) {
          toast(`Guardado local, pero no subió: ${err.message}. Usá ↑ Subir a Sheets.`, true);
        }
      })();
      return;
    }

    if (type === 'reclamo') {
      const idx = store.reclamos.findIndex((x) => x.id === raw.id);
      if (idx < 0) return toast('No encontrado', true);
      store.reclamos[idx] = {
        ...store.reclamos[idx],
        estado: raw.estado || 'Pendiente',
        respuesta: raw.respuesta || '',
        fechaRespuesta: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };
    }

    if (type === 'pendiente') {
      const p = DataStore.mapPendiente(raw);
      if (!p.id) p.id = `P${Date.now()}`;
      const idx = store.pendientes.findIndex((x) => x.id === p.id);
      if (idx >= 0) store.pendientes[idx] = p;
      else store.pendientes.push(p);
    }

    persist();
    closeModal();
    toast('Guardado');
  }

  function deleteItem(type, id) {
    if (!confirm('¿Eliminar este registro?')) return;
    if (type === 'equipo') {
      store.equipos = store.equipos.filter((x) => x.id !== id);
      store.jugadores = store.jugadores.filter((x) => x.equipoId !== id);
      store.fixture = store.fixture.filter((x) => x.equipoAId !== id && x.equipoBId !== id);
    }
    if (type === 'partido') {
      store.fixture = store.fixture.filter((x) => x.id !== id);
      store.resultados = store.resultados.filter((x) => x.partidoId !== id);
    }
    if (type === 'resultado') {
      store.resultados = store.resultados.filter((x) => x.partidoId !== id);
    }
    if (type === 'jugador') {
      store.jugadores = store.jugadores.filter((x) => x.id !== id);
    }
    if (type === 'delegado') {
      store.delegados = store.delegados.filter((x) => x.equipoId !== id);
      persist();
      toast('Eliminado — subiendo a Sheets…');
      (async () => {
        try {
          if (GoogleSheets.isWriteConfigured()) {
            await GoogleSheets.pushToScript(store);
            toast('Acceso eliminado en Sheets');
          } else {
            toast('Eliminado local. Subí a Sheets cuando configures el script.');
          }
        } catch (err) {
          toast(`Eliminado local; no subió: ${err.message}`, true);
        }
      })();
      return;
    }
    if (type === 'reclamo') {
      store.reclamos = store.reclamos.filter((x) => x.id !== id);
    }
    if (type === 'pendiente') {
      store.pendientes = store.pendientes.filter((x) => x.id !== id);
    }
    persist();
    toast('Eliminado');
  }

  function seedDemo() {
    if (store.equipos.length && !confirm('Esto reemplaza los datos actuales por el ejemplo. ¿Continuar?')) {
      return;
    }
    const demo = GoogleSheets.getDemoData();
    store = DataStore.normalizeBundle({
      ...demo,
      llave: demo.llave,
      torneoFinalizado: false,
      source: 'local',
      demo: false,
    });
    store.jugadores = store.jugadores.map((j, i) => ({
      ...j,
      id: j.id || `j-${i + 1}`,
    }));
    store.delegados = store.equipos.map((e, i) => ({
      equipoId: e.id,
      clave: `equipo${e.id}`,
      nombre: `Delegado ${e.nombre}`,
      telefono: '',
    }));
    store.pendientes = [
      {
        id: 'P1',
        equipoId: store.equipos[0]?.id || '1',
        concepto: 'Inscripción',
        monto: 'S/ 50',
        vencimiento: '2026-09-01',
        estado: 'Pendiente',
        nota: 'Ejemplo',
      },
    ];
    store.reclamos = store.reclamos || [];
    persist();
    toast('Datos de ejemplo cargados (claves delegado: equipo1, equipo2, ...)');
  }

  function clearAll() {
    if (!confirm('Se borrarán TODOS los datos locales del torneo. ¿Seguro?')) return;
    DataStore.clearLocal();
    store = DataStore.emptyBundle();
    try {
      localStorage.removeItem(CONFIG.CACHE_KEY);
    } catch {
      /* ignore */
    }
    renderAll();
    updateMeta();
    toast('Datos borrados');
  }

  function bindEvents() {
    $('#login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = $('#login-password')?.value || '';
      const err = $('#login-error');
      if (DataStore.login(pass)) {
        err?.classList.add('hidden');
        loadStore();
        showApp(true);
        renderAll();
        updateMeta();
      } else {
        err?.classList.remove('hidden');
      }
    });

    $('#btn-logout')?.addEventListener('click', () => {
      DataStore.logout();
      showApp(false);
    });

    $$('.admin-tab').forEach((tab) => {
      tab.addEventListener('click', () => activateSection(tab.dataset.section));
    });

    $$('[data-open-modal]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.openModal;
        if (['delegado', 'pendiente', 'jugador', 'partido', 'resultado'].includes(type)) {
          if (!store.equipos.length) {
            const ok = await ensureEquiposLoaded();
            if (!ok) return;
          }
        }
        openModal(type);
      });
    });

    $('#modal-close')?.addEventListener('click', closeModal);
    $('#modal-cancel')?.addEventListener('click', closeModal);
    $('#modal-form')?.addEventListener('submit', saveModal);

    document.addEventListener('click', (e) => {
      const edit = e.target.closest('[data-edit]');
      if (edit) openModal(edit.dataset.edit, edit.dataset.id);
      const del = e.target.closest('[data-del]');
      if (del) deleteItem(del.dataset.del, del.dataset.id);
    });

    $('#filtro-jug-equipo')?.addEventListener('change', renderJugadores);

    $('#btn-save-torneo')?.addEventListener('click', () => {
      store.torneoFinalizado = Boolean($('#chk-finalizado')?.checked);
      CONFIG.TORNEO_FINALIZADO = store.torneoFinalizado;
      persist();
      toast('Estado del torneo guardado');
    });

    $('#btn-seed-demo')?.addEventListener('click', seedDemo);
    $('#btn-clear-data')?.addEventListener('click', clearAll);

    $('#btn-crear-llave')?.addEventListener('click', () => {
      const size = Number($('#llave-size')?.value || 16);
      if (store.llave?.activa && store.llave.partidos?.length) {
        if (!confirm('Esto regenera la llave y borra marcadores actuales. ¿Continuar?')) return;
      }
      store.llave = Llave.crearEstructura(size);
      persist();
      toast(`Llave de ${size} generada`);
      activateSection('llave');
    });

    $('#btn-propagar-llave')?.addEventListener('click', () => {
      if (!store.llave?.activa) return toast('No hay llave activa', true);
      store.llave = Llave.propagarGanadores(store.llave);
      persist();
      toast('Avance de ganadores actualizado');
    });

    $('#btn-desactivar-llave')?.addEventListener('click', () => {
      if (!confirm('¿Desactivar la llave pública?')) return;
      store.llave = Llave.emptyLlave();
      persist();
      toast('Llave desactivada');
    });

    function refreshSheetsStatus() {
      const el = $('#sheets-status');
      if (!el || typeof GoogleSheets === 'undefined') return;
      const s = GoogleSheets.statusInfo();
      const lines = [
        `Lectura API: ${s.lectura ? '✅ configurada' : '⏳ pendiente (SHEET_ID + API_KEY)'}`,
        `Escritura Apps Script: ${s.escritura ? '✅ configurada' : '⏳ pendiente (APPS_SCRIPT_URL + TOKEN)'}`,
      ];
      if (s.sheetId) lines.push(`Sheet ID: ${s.sheetId.slice(0, 12)}…`);
      el.textContent = lines.join(' · ');
    }

    $('#btn-sheets-ping')?.addEventListener('click', async () => {
      const msg = $('#sheets-sync-msg');
      try {
        msg.textContent = 'Probando…';
        const r = await GoogleSheets.pingScript();
        const ver = r.version || '(sin versión — script viejo)';
        msg.textContent = `OK · versión: ${ver} · ${r.name || r.message || ''}`;
        if (!r.version || !String(r.version).includes('delegados-v3')) {
          toast('Script viejo: pegá Codigo.gs y desplegá Nueva versión', true);
        } else {
          toast('Apps Script al día (delegados-v3)');
        }
      } catch (err) {
        msg.textContent = String(err.message || err);
        toast(String(err.message || err), true);
      }
      refreshSheetsStatus();
    });

    $('#btn-sheets-setup')?.addEventListener('click', async () => {
      try {
        await GoogleSheets.setupViaScript();
        toast('Hojas preparadas en el Sheet');
        $('#sheets-sync-msg').textContent = 'Hojas listas (incluye Delegados, Reclamos, Pendientes)';
      } catch (err) {
        toast(String(err.message || err), true);
      }
    });

    $('#btn-sheets-pull')?.addEventListener('click', async () => {
      if (!confirm('¿Reemplazar los datos del panel con lo que hay en Google Sheets?')) return;
      const msg = $('#sheets-sync-msg');
      try {
        msg.textContent = 'Descargando…';
        let data = null;
        let pullError = null;

        // Preferir API Key para datos públicos; Apps Script para secretos (delegados)
        if (GoogleSheets.isConfigured()) {
          try {
            data = await GoogleSheets.fetchViaApi();
          } catch (err) {
            pullError = err;
          }
        }

        if (GoogleSheets.isWriteConfigured()) {
          try {
            const full = await GoogleSheets.pullFromScript();
            data = {
              ...(data || {}),
              ...full,
              // si API ya trajo equipos y script falló parcial, priorizar full
              equipos: full.equipos?.length ? full.equipos : data?.equipos || [],
              delegados: full.delegados || data?.delegados || [],
              reclamos: full.reclamos || data?.reclamos || [],
              pendientes: full.pendientes || data?.pendientes || [],
            };
          } catch (err) {
            pullError = err;
            // Si el script viejo no tiene action "read", seguimos con API
            if (!data) throw err;
            console.warn('Pull script (se usa API):', err);
            toast('Apps Script sin action read — se bajó por API. Actualizá Codigo.gs y redesplegá.', true);
          }
        }

        if (!data) {
          throw pullError || new Error('Configurá Sheets o Apps Script en config.js');
        }

        store = DataStore.normalizeBundle({
          ...data,
          torneoFinalizado: data.torneoFinalizado,
          source: 'local',
        });
        persist();
        msg.textContent = `Descargado: ${store.equipos.length} equipos · ${store.fixture.length} partidos`;
        toast('Datos bajados desde Sheets');
      } catch (err) {
        msg.textContent = String(err.message || err);
        toast(String(err.message || err), true);
      }
    });

    $('#btn-sheets-push')?.addEventListener('click', async () => {
      if (!confirm('¿Subir los datos del panel a Google Sheets? Esto sobrescribe el Sheet.')) return;
      const msg = $('#sheets-sync-msg');
      try {
        msg.textContent = 'Subiendo…';
        store.llave = Llave.propagarGanadores(store.llave || Llave.emptyLlave());
        const result = await GoogleSheets.pushToScript(store);
        try {
          localStorage.removeItem(CONFIG.CACHE_KEY);
        } catch {
          /* ignore */
        }
        msg.textContent = `Subido OK · ${result.updatedAt || ''}`;
        toast('Datos publicados en Google Sheets');
      } catch (err) {
        msg.textContent = String(err.message || err);
        toast(String(err.message || err), true);
      }
    });

    // refrescar estado al entrar
    document.querySelector('[data-section="sheets"]')?.addEventListener('click', refreshSheetsStatus);
    refreshSheetsStatus();

    $('#btn-export-json')?.addEventListener('click', () => {
      const json = DataStore.exportJson(store);
      DataStore.downloadText('torneo.json', json);
      toast('JSON descargado — reemplazá data/torneo.json y publicá');
    });

    $('#btn-export-csv')?.addEventListener('click', () => {
      DataStore.exportCsvSheets(store);
      toast('CSV descargados (4 archivos)');
    });

    $('#import-json')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        store = DataStore.normalizeBundle(parsed);
        persist();
        toast('Importación correcta');
      } catch (err) {
        toast('JSON inválido', true);
        console.error(err);
      }
      e.target.value = '';
    });
  }

  function init() {
    bindEvents();
    if (DataStore.isAuthenticated()) {
      loadStore();
      showApp(true);
      renderAll();
      updateMeta();
    } else {
      showApp(false);
    }
  }

  init();
})();
