# Guía para operadores — Copa Magisterial 2026

Esta guía es para el equipo que **carga y actualiza** los datos del torneo (fixture, resultados, jugadores). El público usa el dashboard; ustedes usan el panel de operadores.

---

## Accesos

| Quién | URL | Clave |
|-------|-----|-------|
| Público (comunidad) | `index.html` | No requiere login |
| Operadores (carga de datos) | `admin.html` | Contraseña en `js/config.js` → `ADMIN_PASSWORD` |

**Clave inicial:** `iespasco2026`  

Cambiala antes del evento editando `js/config.js`:

```js
ADMIN_PASSWORD: 'tu_clave_segura',
```

---

## Flujo recomendado (sin Google Sheets todavía)

1. Abrí **admin.html** e iniciá sesión.
2. En **Torneo** podés cargar el **ejemplo** para practicar, o empezar vacío.
3. Cargá en este orden:
   - **Equipos**
   - **Jugadores** (por equipo)
   - **Fixture** (partidos)
   - **Resultados** (cuando haya marcador) → marcá el partido como **Finalizado**
4. En **Exportar** → **Descargar torneo.json**
5. Reemplazá el archivo del proyecto: `data/torneo.json`
6. Publicá / subí el sitio (GitHub Pages o el hosting que usen)
7. La comunidad verá los datos en el dashboard público

> Mientras cargás en tu PC, el dashboard **en ese mismo navegador** ya muestra “Datos locales”.  
> Para que lo vean todos, hace falta publicar `data/torneo.json`.

---

## Qué carga cada rol

### Equipos
- ID único, nombre, colegio, grupo, color, logo (URL opcional)

### Fixture
- Fecha, hora, equipo A/B, cancha, estado: `Próximo` | `En Juego` | `Finalizado`

### Llave eliminatoria
- Generar estructura de **8** o **16** equipos
- Colocar clasificados en la primera ronda
- Cargar marcadores → los ganadores avanzan solos
- Visible en el dashboard público (pestaña **Llave**)

### Resultados / actas
- Goles, goleadores, tarjetas, aprobado SI/NO  
- Tip: desde Fixture usá el botón **Acta**

### Jugadores
- Equipo, nombre, apellido, posición, número, goles, tarjetas  
- Útil para cuadro de honor y detalle de partidos

### Torneo
- Marcar **Torneo finalizado** para habilitar el Cuadro de Honor público

---

## Exportar para Google Sheets (después)

En **Exportar** → **Descargar CSV (4 hojas)**  
Obtendrás archivos listos para importar/pegar en:

- Equipos  
- Fixture  
- Resultados  
- Jugadores  

Cuando se configure Sheets (`GOOGLE_SHEET_ID` + `GOOGLE_API_KEY`), el dashboard priorizará esa fuente automáticamente.

---

## Respaldo

- Exportá JSON con frecuencia (fin de cada jornada).
- Guardá copias en Drive del IES Pasco.
- Podés **Importar JSON** en otro PC de operadores para continuar.

---

## Problemas frecuentes

| Problema | Solución |
|----------|----------|
| El público sigue viendo “Modo demo” | Publicar `data/torneo.json` actualizado |
| La tabla no suma un partido | Estado = Finalizado + Resultado Aprobado = SI |
| Olvidé la contraseña | Revisar `ADMIN_PASSWORD` en `js/config.js` |
| Dos operadores en PCs distintas | Usar export/import JSON o publicar el JSON en el repo |

---

## Contacto técnico

Documentación general: `README.md`  
Panel: `admin.html`  
Dashboard: `index.html`
