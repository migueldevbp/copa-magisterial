# Portal de delegados — Copa Magisterial 2026

## Accesos

| Rol | URL | Cómo entra |
|-----|-----|------------|
| Público | `index.html` | Sin login |
| Operadores | `admin.html` | Contraseña admin |
| **Delegados** | `delegado.html` | Equipo + clave |

## Qué ve cada delegado (solo su equipo)

- Resumen: pendientes, tarjetas, próximo partido  
- Plantel con **amarillas / rojas** y alertas  
- Partidos y actas de tarjetas  
- Pendientes / deudas / pagos  
- Reclamos (enviar y ver respuesta)  
- Torneo: goleadores y portero menos vencido (global)

## Cómo dar accesos

1. Admin → **Delegados** → crear acceso (equipo + clave)  
2. **Google Sheets → Preparar hojas** (crea hoja `Delegados`, `Reclamos`, `Pendientes`)  
3. **↑ Subir a Sheets**  
4. Entregar al delegado: link `delegado.html` + clave  

Ejemplo demo: claves `equipo1`, `equipo2`, …

## Seguridad

- Las claves están en la hoja **Delegados** (no se publican en el dashboard).  
- El login valida contra Apps Script.  
- Tras actualizar `Codigo.gs`, redesplegar una **nueva versión**.

## Actualizar Apps Script

1. Pegar el `apps-script/Codigo.gs` nuevo  
2. Implementar → Nueva versión  
3. En admin: Preparar hojas → Subir  
