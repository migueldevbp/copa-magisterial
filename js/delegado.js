/**
 * Portal de delegados — solo datos del propio equipo + stats globales.
 */
(() => {
  const SESSION_KEY = () => CONFIG.DELEGADO_SESSION_KEY || 'copa_magisterial_delegado_session';
  let state = null; // { equipoId, clave, data }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function saveSession(payload) {
    sessionStorage.setItem(SESSION_KEY(), JSON.stringify(payload));
  }

  function loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY()) || 'null');
    } catch {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY());
  }

  function showApp(on) {
    $('#login-view')?.classList.toggle('hidden', on);
    $('#app-view')?.classList.toggle('hidden', !on);
  }

  async function loadEquiposSelect() {
    const sel = $('#del-equipo');
    if (!sel) return;
    try {
      let equipos = [];
      if (GoogleSheets.isConfigured()) {
        const data = await GoogleSheets.fetchViaApi();
        equipos = data.equipos || [];
      } else if (GoogleSheets.isWriteConfigured()) {
        const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=read`, { redirect: 'follow' });
        const raw = await res.json();
        equipos = (raw.equipos || []).map((e) => ({
          id: e.ID || e.id,
          nombre: e.Nombre || e.nombre,
        }));
      }
      if (!equipos.length) {
        sel.innerHTML = '<option value="">Sin equipos — subí datos desde admin</option>';
        return;
      }
      sel.innerHTML =
        '<option value="">Seleccioná tu equipo</option>' +
        equipos
          .map((e) => `<option value="${esc(e.id)}">${esc(e.nombre)} (ID ${esc(e.id)})</option>`)
          .join('');
    } catch (err) {
      sel.innerHTML = `<option value="">Error al cargar equipos</option>`;
      console.error(err);
    }
  }

  async function login(equipoId, clave) {
    const data = await GoogleSheets.delegadoRequest('delegado_login', { equipoId, clave });
    state = { equipoId, clave, data };
    saveSession({ equipoId, clave });
    showApp(true);
    renderAll();
  }

  async function refresh() {
    if (!state) return;
    const data = await GoogleSheets.delegadoRequest('delegado_data', {
      equipoId: state.equipoId,
      clave: state.clave,
    });
    state.data = data;
    renderAll();
  }

  function activate(sec) {
    $$('.del-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.sec === sec));
    $$('.del-sec').forEach((s) => s.classList.toggle('is-active', s.id === `sec-${sec}`));
  }

  function nombreEquipo(id) {
    const list = state?.data?.equipos || [];
    const found = list.find((e) => String(e.ID || e.id) === String(id));
    return found?.Nombre || found?.nombre || id;
  }

  function renderResumen() {
    const el = $('#sec-resumen');
    if (!el || !state?.data) return;
    const d = state.data;
    const plantel = d.jugadores || [];
    const conAmarilla = plantel.filter((j) => Number(j.Tarjetas_A || 0) > 0).length;
    const conRoja = plantel.filter((j) => Number(j.Tarjetas_R || 0) > 0).length;
    const pend = (d.pendientes || []).filter((p) => String(p.Estado || '').toLowerCase() !== 'pagado');
    const reclPend = (d.reclamos || []).filter((r) => String(r.Estado || '') === 'Pendiente');
    const proximo = (d.partidos || [])
      .filter((p) => p.Estado === 'Próximo' || p.Estado === 'En Juego')
      .sort((a, b) => `${a.Fecha}${a.Hora}`.localeCompare(`${b.Fecha}${b.Hora}`))[0];

    let rival = '—';
    if (proximo) {
      const id = state.equipoId;
      rival =
        String(proximo.Equipo_A_ID) === id
          ? nombreEquipo(proximo.Equipo_B_ID)
          : nombreEquipo(proximo.Equipo_A_ID);
    }

    el.innerHTML = `
      <div class="del-grid del-grid-3">
        <div class="del-box"><h3>Pendientes</h3><div class="del-stat">${pend.length}</div><p class="del-help">Deudas / pagos abiertos</p></div>
        <div class="del-box"><h3>Tarjetas</h3><div class="del-stat">${conAmarilla}A · ${conRoja}R</div><p class="del-help">Jugadores con sanción</p></div>
        <div class="del-box"><h3>Reclamos abiertos</h3><div class="del-stat">${reclPend.length}</div><p class="del-help">En revisión por organización</p></div>
      </div>
      <div class="del-box" style="margin-top:0.75rem">
        <h3>Próximo partido</h3>
        ${
          proximo
            ? `<p><strong>vs ${esc(rival)}</strong></p>
               <p class="del-help">${esc(proximo.Fecha)} · ${esc(proximo.Hora)} · ${esc(proximo.Cancha)} · ${esc(proximo.Estado)}</p>`
            : '<p class="del-empty">Sin partidos próximos cargados</p>'
        }
      </div>`;
  }

  function renderPlantel() {
    const el = $('#sec-plantel');
    if (!el || !state?.data) return;
    const plantel = [...(state.data.jugadores || [])].sort(
      (a, b) => Number(a.Numero || 0) - Number(b.Numero || 0)
    );

    el.innerHTML = `
      <div class="del-box">
        <h2>Plantel y disciplina</h2>
        <p class="del-help">Amarillas y rojas cargadas por mesa/árbitro. Jugadores en alerta aparecen resaltados.</p>
        <div style="overflow:auto">
          <table class="del-table">
            <thead>
              <tr><th>#</th><th>Jugador</th><th>Posición</th><th>Goles</th><th>TA</th><th>TR</th><th>Estado</th></tr>
            </thead>
            <tbody>
              ${
                plantel.length
                  ? plantel
                      .map((j) => {
                        const ya = Number(j.Tarjetas_A || 0);
                        const yr = Number(j.Tarjetas_R || 0);
                        const alert = ya >= 2 || yr >= 1;
                        let estado = '<span class="badge-ok">OK</span>';
                        if (yr >= 1) estado = '<span class="badge-tr">Roja</span>';
                        else if (ya >= 2) estado = '<span class="badge-ya">Riesgo (2+ A)</span>';
                        else if (ya === 1) estado = '<span class="badge-ya">1 amarilla</span>';
                        return `<tr class="${alert ? 'is-alert' : ''}">
                          <td>${esc(j.Numero || '-')}</td>
                          <td>${esc(j.Nombre)} ${esc(j.Apellido)}</td>
                          <td>${esc(j.Posicion || '-')}</td>
                          <td>${esc(j.Goles || 0)}</td>
                          <td>${ya}</td>
                          <td>${yr}</td>
                          <td>${estado}</td>
                        </tr>`;
                      })
                      .join('')
                  : '<tr><td colspan="7" class="del-empty">Sin jugadores cargados</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderPartidos() {
    const el = $('#sec-partidos');
    if (!el || !state?.data) return;
    const id = state.equipoId;
    const resMap = Object.fromEntries((state.data.resultados || []).map((r) => [r.Partido_ID, r]));
    const partidos = [...(state.data.partidos || [])].sort((a, b) =>
      `${a.Fecha}${a.Hora}`.localeCompare(`${b.Fecha}${b.Hora}`)
    );

    el.innerHTML = `
      <div class="del-box">
        <h2>Partidos de tu equipo</h2>
        <div style="overflow:auto">
          <table class="del-table">
            <thead><tr><th>Fecha</th><th>Rival</th><th>Marcador</th><th>Estado</th><th>Tarjetas (acta)</th></tr></thead>
            <tbody>
              ${
                partidos.length
                  ? partidos
                      .map((p) => {
                        const soyA = String(p.Equipo_A_ID) === id;
                        const rival = nombreEquipo(soyA ? p.Equipo_B_ID : p.Equipo_A_ID);
                        const r = resMap[p.ID];
                        const marcador = r
                          ? soyA
                            ? `${r.Goles_A} — ${r.Goles_B}`
                            : `${r.Goles_B} — ${r.Goles_A}`
                          : '—';
                        const tarjetas = r
                          ? soyA
                            ? r.Tarjetas_A || '-'
                            : r.Tarjetas_B || '-'
                          : '—';
                        return `<tr>
                          <td>${esc(p.Fecha)} ${esc(p.Hora)}</td>
                          <td>${esc(rival)}</td>
                          <td><strong>${esc(marcador)}</strong></td>
                          <td>${esc(p.Estado)}</td>
                          <td>${esc(tarjetas)}</td>
                        </tr>`;
                      })
                      .join('')
                  : '<tr><td colspan="5" class="del-empty">Sin partidos</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderPendientes() {
    const el = $('#sec-pendientes');
    if (!el || !state?.data) return;
    const list = state.data.pendientes || [];
    el.innerHTML = `
      <div class="del-box">
        <h2>Pendientes / deudas / pagos</h2>
        <p class="del-help">Cargados por la organización del torneo.</p>
        <div style="overflow:auto">
          <table class="del-table">
            <thead><tr><th>Concepto</th><th>Monto</th><th>Vence</th><th>Estado</th><th>Nota</th></tr></thead>
            <tbody>
              ${
                list.length
                  ? list
                      .map((p) => {
                        const pagado = String(p.Estado || '').toLowerCase() === 'pagado';
                        return `<tr>
                          <td>${esc(p.Concepto)}</td>
                          <td>${esc(p.Monto)}</td>
                          <td>${esc(p.Vencimiento || '-')}</td>
                          <td>${pagado ? '<span class="badge-ok">Pagado</span>' : '<span class="badge-pend">' + esc(p.Estado || 'Pendiente') + '</span>'}</td>
                          <td>${esc(p.Nota || '-')}</td>
                        </tr>`;
                      })
                      .join('')
                  : '<tr><td colspan="5" class="del-empty">Sin pendientes</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderReclamos() {
    const el = $('#sec-reclamos');
    if (!el || !state?.data) return;
    const list = state.data.reclamos || [];
    el.innerHTML = `
      <div class="del-grid del-grid-2">
        <div class="del-box">
          <h2>Nuevo reclamo</h2>
          <p class="del-help">Por tarjetas, resultados, fixture u otras incidencias del árbitro/mesa.</p>
          <form id="form-reclamo" class="del-form">
            <label>Asunto <input name="asunto" required maxlength="120" placeholder="Ej. Tarjeta mal aplicada" /></label>
            <label>Detalle <textarea name="detalle" required rows="4" placeholder="Describí el hecho, partido y jugador"></textarea></label>
            <button type="submit" class="btn-primary">Enviar reclamo</button>
            <p id="reclamo-msg" class="del-help"></p>
          </form>
        </div>
        <div class="del-box">
          <h2>Mis reclamos</h2>
          <div style="overflow:auto;max-height:420px">
            <table class="del-table">
              <thead><tr><th>Fecha</th><th>Asunto</th><th>Estado</th><th>Respuesta</th></tr></thead>
              <tbody>
                ${
                  list.length
                    ? list
                        .map(
                          (r) => `<tr>
                          <td>${esc(r.Fecha)}</td>
                          <td>${esc(r.Asunto)}</td>
                          <td>${esc(r.Estado)}</td>
                          <td>${esc(r.Respuesta || '—')}</td>
                        </tr>`
                        )
                        .join('')
                    : '<tr><td colspan="4" class="del-empty">Sin reclamos aún</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    $('#form-reclamo')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const msg = $('#reclamo-msg');
      try {
        msg.textContent = 'Enviando…';
        await GoogleSheets.delegadoRequest('reclamo_crear', {
          equipoId: state.equipoId,
          clave: state.clave,
          asunto: fd.get('asunto'),
          detalle: fd.get('detalle'),
        });
        msg.textContent = 'Reclamo enviado correctamente';
        e.target.reset();
        await refresh();
        activate('reclamos');
        renderReclamos();
      } catch (err) {
        msg.textContent = String(err.message || err);
      }
    });
  }

  function renderTorneo() {
    const el = $('#sec-torneo');
    if (!el || !state?.data) return;
    const stats = state.data.stats || {};
    const eqMap = stats.equiposMap || {};
    const goleadores = stats.goleadores || [];
    const portero = stats.porteroMenosVencido;

    el.innerHTML = `
      <div class="del-grid del-grid-2">
        <div class="del-box">
          <h2>Máximos goleadores</h2>
          <table class="del-table">
            <thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Goles</th></tr></thead>
            <tbody>
              ${
                goleadores.length
                  ? goleadores
                      .map(
                        (g, i) => `<tr>
                        <td>${i + 1}</td>
                        <td>${esc(g.nombre)} ${esc(g.apellido)}</td>
                        <td>${esc(eqMap[g.equipoId] || g.equipoId)}</td>
                        <td><strong>${g.goles}</strong></td>
                      </tr>`
                      )
                      .join('')
                  : '<tr><td colspan="4" class="del-empty">Sin goles aún</td></tr>'
              }
            </tbody>
          </table>
        </div>
        <div class="del-box">
          <h2>Portero menos vencido</h2>
          <p class="del-help">Menos goles recibidos por su equipo (no “atajadas”).</p>
          ${
            portero
              ? `<p class="del-stat" style="font-size:1.2rem">${esc(portero.nombre)} ${esc(portero.apellido)}</p>
                 <p>${esc(eqMap[portero.equipoId] || '')} · GC: <strong>${portero.golesRecibidos === 999 ? '—' : portero.golesRecibidos}</strong></p>`
              : '<p class="del-empty">Sin datos de porteros</p>'
          }
          <p style="margin-top:1rem"><a href="index.html" target="_blank" rel="noopener">Ver dashboard público completo →</a></p>
        </div>
      </div>`;
  }

  function renderAll() {
    const d = state?.data;
    if (!d) return;
    $('#del-equipo-nombre').textContent = d.equipo?.Nombre || 'Equipo';
    $('#del-delegado-nombre').textContent = d.delegado?.nombre
      ? `Delegado: ${d.delegado.nombre}`
      : '';
    renderResumen();
    renderPlantel();
    renderPartidos();
    renderPendientes();
    renderReclamos();
    renderTorneo();
  }

  function bind() {
    $('#del-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#del-login-error');
      const btn = e.target.querySelector('button[type="submit"]');
      err?.classList.add('hidden');
      const equipoId = String($('#del-equipo').value || '').trim();
      const clave = String($('#del-clave').value || '').trim();
      if (!equipoId || !clave) {
        if (err) {
          err.textContent = 'Seleccioná el equipo e ingresá la clave.';
          err.classList.remove('hidden');
        }
        return;
      }
      if (btn) btn.disabled = true;
      try {
        await login(equipoId, clave);
      } catch (ex) {
        if (err) {
          err.textContent = String(ex.message || ex);
          err.classList.remove('hidden');
        }
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    $$('.del-tab').forEach((t) => t.addEventListener('click', () => activate(t.dataset.sec)));
    $('#del-logout')?.addEventListener('click', () => {
      clearSession();
      state = null;
      showApp(false);
    });
    $('#del-refresh')?.addEventListener('click', async () => {
      try {
        await refresh();
      } catch (err) {
        alert(String(err.message || err));
      }
    });
  }

  async function init() {
    bind();
    if (location.protocol === 'file:') {
      const err = $('#del-login-error');
      if (err) {
        err.textContent =
          'Abrí el portal con http://localhost (no file://). En la carpeta del proyecto: python -m http.server 8080 → http://localhost:8080/delegado.html';
        err.classList.remove('hidden');
      }
    }
    await loadEquiposSelect();
    const sess = loadSession();
    if (sess?.equipoId && sess?.clave) {
      try {
        await login(sess.equipoId, sess.clave);
      } catch {
        clearSession();
        showApp(false);
      }
    } else {
      showApp(false);
    }
  }

  init();
})();
