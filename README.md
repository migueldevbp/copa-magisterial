# Copa Magisterial 2026 — Dashboard · IES Pasco

Sitio estático + **backend Google Sheets** (lectura API + escritura Apps Script).

## Sitio publicado

| Destino | URL |
|---------|-----|
| Dashboard público | https://migueldevbp.github.io/copa-magisterial/ |
| Operadores | https://migueldevbp.github.io/copa-magisterial/admin.html |
| Portal delegados | https://migueldevbp.github.io/copa-magisterial/delegado.html |
| Código | https://github.com/migueldevbp/copa-magisterial |

---

## Accesos

| Destino | Archivo | Quién |
|---------|---------|--------|
| Dashboard público | [`index.html`](index.html) | Comunidad (Tabla, Fixture, Llave, Honor) |
| Panel operadores | [`admin.html`](admin.html) | Carga de datos + sync Sheets |
| Portal delegados | [`delegado.html`](delegado.html) | Solo su equipo |
| Guía operadores | [`docs/GUIA-OPERADORES.md`](docs/GUIA-OPERADORES.md) | |
| **Backend Sheets** | [`docs/GOOGLE-SHEETS.md`](docs/GOOGLE-SHEETS.md) | Setup API + Apps Script |

**Clave admin:** `iespasco2026` → cambiar en `js/config.js` → `ADMIN_PASSWORD`

---

## Configurar backend (resumen)

1. Crear Google Sheet y compartirlo como lector público  
2. Pegar en `js/config.js`: `GOOGLE_SHEET_ID` + `GOOGLE_API_KEY`  
3. Pegar `apps-script/Codigo.gs` en Apps Script → desplegar app web  
4. Pegar `APPS_SCRIPT_URL` + mismo `APPS_SCRIPT_TOKEN`  
5. En admin → **Google Sheets** → Probar → Subir datos  

Detalle paso a paso: **[docs/GOOGLE-SHEETS.md](docs/GOOGLE-SHEETS.md)**

---

## Identidad

- Logos: `img/logo-copa-magisterial.png` · `img/logo-ies-pasco.png`
- Colores: navy `#0D1B3E` · rojo `#D32F2F` · sol `#FFEB3B`

---

## Fuentes de datos (prioridad)

1. **Google Sheets** (si ID + API Key)  
2. Datos locales del admin  
3. `data/torneo.json`  
4. Modo demo  

---

## Probar en local

```bash
python -m http.server 8080
```

- Público: http://localhost:8080/  
- Operadores: http://localhost:8080/admin.html  
- Delegados: http://localhost:8080/delegado.html  

---

## Estructura clave

```
├── index.html / admin.html / delegado.html
├── apps-script/Codigo.gs     ← backend Sheets
├── js/config.js              ← credenciales
├── js/google-sheets.js       ← cliente
├── docs/GOOGLE-SHEETS.md
├── templates/*.csv           ← encabezados de referencia
└── data/torneo.json
```

---

## Licencia

Uso libre para **Copa Magisterial 2026 · IES Pasco**.
