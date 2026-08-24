# Backend Google Sheets — Copa Magisterial 2026

El sitio es estático (GitHub Pages). Google Sheets actúa como base de datos:

| Función | Tecnología |
|---------|------------|
| Lectura pública (dashboard) | Google Sheets API v4 + API Key |
| Escritura (operadores) | Google Apps Script (app web) |

---

## 1. Crear el Google Sheet

1. Creá un spreadsheet nuevo (ej. `Copa Magisterial 2026`).
2. Copiá el **ID** de la URL:
   `https://docs.google.com/spreadsheets/d/`**`ESTE_ID`**`/edit`
3. Compartir → **Cualquiera con el enlace** → Lector  
   (necesario para la API Key de solo lectura).

---

## 2. API Key (lectura)

1. [Google Cloud Console](https://console.cloud.google.com/) → crear proyecto.
2. APIs y servicios → Biblioteca → habilitar **Google Sheets API**.
3. Credenciales → **Crear credenciales** → API Key.
4. (Recomendado) Restringir la key a Sheets API y a tu dominio de GitHub Pages.

Pegá en `js/config.js`:

```js
GOOGLE_SHEET_ID: 'tu_id_aqui',
GOOGLE_API_KEY: 'tu_api_key_aqui',
```

Con eso el dashboard público ya puede leer datos (cuando haya filas en el Sheet).

---

## 3. Apps Script (escritura / sync)

1. En el Sheet: **Extensiones → Apps Script**.
2. Borrá el código default y pegá todo `apps-script/Codigo.gs`.
3. En el script, el `TOKEN` debe ser **igual** a `APPS_SCRIPT_TOKEN` de `config.js`  
   (por defecto: `iespasco-sync-2026`).
4. Guardá el proyecto.
5. Seleccioná la función `setupSheets` → Ejecutar → autorizá con tu cuenta Google.
6. **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
7. Copiá la **URL de la aplicación web**.

En `js/config.js`:

```js
APPS_SCRIPT_URL: 'https://script.google.com/macros/s/XXXX/exec',
APPS_SCRIPT_TOKEN: 'iespasco-sync-2026',
```

---

## 4. Hojas que se crean

| Hoja | Uso |
|------|-----|
| Equipos | Planteles |
| Fixture | Partidos de fase de grupos |
| Resultados | Actas |
| Jugadores | Stats / honor |
| Llave | Eliminación directa |
| Config | `TORNEO_FINALIZADO`, `LLAVE_ACTIVA`, `LLAVE_TAMANO` |

También podés crearlas desde el panel: **Google Sheets → Preparar hojas**.

---

## 5. Flujo de operadores

1. Entrá a `admin.html`.
2. Pestaña **Google Sheets**.
3. **Probar Apps Script** → debe decir OK.
4. Cargá datos (o usá el ejemplo).
5. **↑ Subir a Sheets** → el público los ve (polling cada 5 s).
6. Si alguien editó el Sheet a mano: **↓ Bajar desde Sheets**.

---

## 6. Checklist

- [ ] Sheet compartido “Cualquiera con el enlace → Lector”
- [ ] Sheets API habilitada + API Key en `config.js`
- [ ] Apps Script desplegado como app web (Anyone)
- [ ] Token igual en script y `config.js`
- [ ] Ping OK desde el admin
- [ ] Subir datos de prueba y verlos en `index.html` (badge **Google Sheets**)

---

## Seguridad

- La API Key es pública (solo lectura): restringila por HTTP referrer.
- El token de Apps Script no es un login bancario: cambialo antes del evento.
- No subas DNI reales de menores si el Sheet es público; usá códigos internos.

---

## Problemas frecuentes

| Error | Qué revisar |
|-------|-------------|
| `API key not valid` | Key / Sheets API habilitada |
| `The caller does not have permission` | Sheet no está compartido como lector público |
| Ping Apps Script falla | URL mal copiada / redeploy / acceso “Anyone” |
| `Token inválido` | Token distinto entre `Codigo.gs` y `config.js` |
| CORS / failed to fetch POST | Usar la URL `/exec` (no `/dev`) y redeployar |

---

## Archivos del repo

- `apps-script/Codigo.gs` — backend
- `js/config.js` — credenciales
- `js/google-sheets.js` — cliente
- `admin.html` → pestaña Google Sheets
- `templates/` — encabezados CSV de referencia
