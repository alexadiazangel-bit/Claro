# Inventario Phantom Shield — Dashboard

Dashboard estático (HTML/CSS/JS puro) para hacer seguimiento del inventario
Phantom Shield: tabla editable, filtros, y una gráfica de estado por
departamento. No requiere backend ni build step — funciona directo en
GitHub Pages.

## Archivos

- `index.html` — página principal.
- `style.css` — estilos.
- `script.js` — lógica: carga de datos, tabla, filtros, edición/eliminación, gráfica.
- `data.json` — datos iniciales del inventario (135 sitios).

## Cómo subirlo a GitHub

1. Crea un repositorio nuevo en GitHub (puede ser público o privado), por
   ejemplo `inventario-phantom-shield`.
2. En tu computador, dentro de la carpeta con estos 4 archivos:

   ```bash
   git init
   git add .
   git commit -m "Dashboard inicial de inventario Phantom Shield"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/inventario-phantom-shield.git
   git push -u origin main
   ```

3. Ve a **Settings → Pages** en el repositorio.
4. En "Build and deployment", selecciona **Deploy from a branch**, elige la
   rama `main` y la carpeta `/ (root)`.
5. Guarda. GitHub te dará una URL tipo:

   ```
   https://TU_USUARIO.github.io/inventario-phantom-shield/
   ```

   Puede tardar 1–2 minutos en publicarse.

## Cómo funciona el guardado de cambios

- Al abrir la página por primera vez, se carga `data.json` y se guarda una
  copia en el `localStorage` del navegador.
- Cada vez que editas, agregas o eliminas un sitio, el cambio se guarda en
  ese `localStorage` — es decir, **los cambios quedan solo en tu navegador**,
  no se escriben de vuelta al archivo `data.json` del repositorio.
- Usa el botón **"Exportar CSV"** para descargar el estado actual del
  inventario y respaldarlo, o para reemplazar manualmente `data.json` y
  subir esa versión actualizada a GitHub si quieres que sea la nueva base
  para todos los que visiten el enlace.

> Si más adelante quieres que los cambios se guarden de forma centralizada
> (para que todo tu equipo vea las mismas ediciones en tiempo real), lo más
> sencillo es conectar el dashboard a una hoja de Google Sheets, Airtable, o
> una base de datos simple (por ejemplo Supabase) en lugar de `data.json` +
> `localStorage`. Avísame si quieres que lo dejemos configurado así.

## Actualizar los datos base

Para reemplazar los datos de partida (los que ve alguien que entra por
primera vez, sin ediciones locales todavía), simplemente edita o reemplaza
`data.json` manteniendo el mismo formato: una lista de objetos con estas
columnas:

```
CLIENTE, FASE, Name EB, TIPO, REGIONAL, Dpto, ACPM, Versión, ESTADO, ICCD,
MIN, Cantidad Camara(s), IP Cámara #1, Marca Cámara #1, PIR, Sirena,
FECHA INSTALACION
```

Luego haz commit y push de ese archivo.

## Gráfica de estado por departamento

La gráfica de barras apiladas en la parte superior del dashboard agrupa
todos los sitios por `Dpto` y muestra cuántos están **Online**, **Offline**,
**Otro** (cualquier otro estado) o **Sin dato**. Se recalcula automáticamente
cada vez que agregas, editas o eliminas un sitio, y siempre refleja el
inventario completo (no se filtra junto con la tabla).
