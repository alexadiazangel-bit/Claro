const COLUMNS = ["CLIENTE","FASE","Name EB","TIPO","REGIONAL","Dpto","ACPM","Versión","ESTADO","ICCD","MIN","Cantidad Camara(s)","IP Cámara #1","Marca Cámara #1","PIR","Sirena","FECHA INSTALACION","NOTAS"];
const TEXTAREA_COLUMNS = ["NOTAS"];

const STORAGE_KEY = "phantom_shield_inventory_v1";
const DATA_URL = "data.json";

let data = [];
let sortState = { col: null, dir: 1 };
let editingId = null;
let deletingId = null;
let statusChart = null;

const el = (id) => document.getElementById(id);

// ---------- Carga de datos ----------
async function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try {
      return JSON.parse(raw);
    } catch(e){ /* si falla, recargamos desde data.json */ }
  }
  const res = await fetch(DATA_URL);
  const seed = await res.json();
  const withIds = seed.map((row, i) => ({ _id: i + 1, ...row }));
  saveData(withIds);
  return withIds;
}
function saveData(rows){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function nextId(){
  return data.reduce((m, r) => Math.max(m, r._id || 0), 0) + 1;
}

function uniqueValues(col){
  return [...new Set(data.map(r => (r[col] ?? "").toString().trim()).filter(v => v !== ""))].sort();
}

// ---------- Filtros ----------
function populateFilters(){
  const map = { filterFase: "FASE", filterTipo: "TIPO", filterRegional: "REGIONAL", filterEstado: "ESTADO" };
  Object.entries(map).forEach(([selId, col]) => {
    const sel = el(selId);
    const current = sel.value;
    const labelDefault = sel.options[0].textContent;
    sel.innerHTML = `<option value="">${labelDefault}</option>`;
    uniqueValues(col).forEach(v => {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
    sel.value = current;
  });
}

// ---------- Encabezado tabla ----------
function buildHeader(){
  const headerRow = el("headerRow");
  headerRow.innerHTML = "";
  COLUMNS.forEach(col => {
    const th = document.createElement("th");
    th.innerHTML = `${col} <span class="arrow" data-col="${col}"></span>`;
    th.addEventListener("click", () => {
      if(sortState.col === col) sortState.dir *= -1;
      else { sortState.col = col; sortState.dir = 1; }
      render();
    });
    headerRow.appendChild(th);
  });
  const thActions = document.createElement("th");
  thActions.textContent = "Acciones";
  headerRow.appendChild(thActions);
}

function estadoPill(estado){
  const e = (estado || "").toUpperCase();
  let cls = "neutral";
  if(e.includes("ONLINE")) cls = "ok";
  else if(e.includes("OFFLINE") || e.includes("INACTIVO")) cls = "off";
  else if(e) cls = "warn";
  return `<span class="pill ${cls}">${estado ?? "N/A"}</span>`;
}

function estadoGroup(estado){
  const e = (estado || "").toUpperCase();
  if(e.includes("ONLINE")) return "Online";
  if(e.includes("OFFLINE") || e.includes("INACTIVO")) return "Offline";
  if(!e) return "Sin dato";
  return "Otro";
}

// ---------- Filtrado / orden ----------
function getFiltered(){
  const q = el("searchInput").value.trim().toLowerCase();
  const fFase = el("filterFase").value;
  const fTipo = el("filterTipo").value;
  const fReg = el("filterRegional").value;
  const fEstado = el("filterEstado").value;

  let rows = data.filter(r => {
    if(fFase && r["FASE"] !== fFase) return false;
    if(fTipo && r["TIPO"] !== fTipo) return false;
    if(fReg && r["REGIONAL"] !== fReg) return false;
    if(fEstado && r["ESTADO"] !== fEstado) return false;
    if(q){
      const hay = COLUMNS.some(c => (r[c] ?? "").toString().toLowerCase().includes(q));
      if(!hay) return false;
    }
    return true;
  });

  if(sortState.col){
    rows = [...rows].sort((a, b) => {
      let va = a[sortState.col], vb = b[sortState.col];
      va = va === undefined || va === null ? "" : va;
      vb = vb === undefined || vb === null ? "" : vb;
      const na = parseFloat(va), nb = parseFloat(vb);
      if(!isNaN(na) && !isNaN(nb) && va !== "" && vb !== ""){
        return (na - nb) * sortState.dir;
      }
      return va.toString().localeCompare(vb.toString()) * sortState.dir;
    });
  }
  return rows;
}

// ---------- Render tabla ----------
function render(){
  populateFilters();
  const rows = getFiltered();
  const tbody = el("tableBody");
  tbody.innerHTML = "";
  el("emptyState").style.display = rows.length ? "none" : "block";

  document.querySelectorAll(".arrow").forEach(a => {
    a.textContent = a.dataset.col === sortState.col ? (sortState.dir === 1 ? "▲" : "▼") : "";
  });

  rows.forEach(row => {
    const tr = document.createElement("tr");
    COLUMNS.forEach(col => {
      const td = document.createElement("td");
      if(col === "ESTADO"){
        td.innerHTML = estadoPill(row[col]);
      } else if(col === "NOTAS"){
        const val = (row[col] ?? "").toString().trim();
        td.className = "notes-cell" + (val ? "" : " empty");
        td.textContent = val || "+ Agregar nota";
        td.title = val || "Haz clic para agregar una nota";
        td.addEventListener("click", () => openEdit(row._id, "NOTAS"));
      } else {
        const val = row[col];
        td.textContent = (val === undefined || val === null || val === "") ? "N/A" : val;
      }
      tr.appendChild(td);
    });
    const tdActions = document.createElement("td");
    tdActions.className = "actions-cell";
    tdActions.innerHTML = `
      <button class="btn-icon edit" title="Editar" data-id="${row._id}">✎</button>
      <button class="btn-icon del" title="Eliminar" data-id="${row._id}">🗑</button>
    `;
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".edit").forEach(btn => btn.addEventListener("click", () => openEdit(parseInt(btn.dataset.id))));
  tbody.querySelectorAll(".del").forEach(btn => btn.addEventListener("click", () => openDelete(parseInt(btn.dataset.id))));

  renderStats();
  try {
    renderChart();
  } catch(err){
    console.error("Error al renderizar la gráfica:", err);
  }
}

function renderStats(){
  const total = data.length;
  const online = data.filter(r => estadoGroup(r.ESTADO) === "Online").length;
  const offline = data.filter(r => estadoGroup(r.ESTADO) === "Offline").length;
  const withCams = data.filter(r => {
    const c = parseFloat(r["Cantidad Camara(s)"]);
    return !isNaN(c) && c > 0;
  }).length;

  el("stats").innerHTML = `
    <div class="stat"><b>${total}</b><span>Sitios</span></div>
    <div class="stat"><b>${online}</b><span>Online</span></div>
    <div class="stat"><b>${offline}</b><span>Offline</span></div>
    <div class="stat"><b>${withCams}</b><span>Con cámaras</span></div>
  `;
}

// ---------- Gráfica: estado por departamento ----------
const CHART_COLORS = {
  "Online": "#1E8E5A",
  "Offline": "#B0201F",
  "Otro": "#B15E00",
  "Sin dato": "#9AA1A8"
};

function renderChart(){
  const canvas = el("statusByDeptChart");

  if(typeof Chart === "undefined"){
    // La librería Chart.js no cargó (CDN caído, sin internet, bloqueador, etc.)
    const wrap = canvas.parentElement;
    wrap.innerHTML = `<div style="height:100%; display:flex; align-items:center; justify-content:center; color:#B0201F; font-size:13px; text-align:center; padding:0 20px;">
      No se pudo cargar la librería de gráficas (Chart.js). Verifica tu conexión a internet y recarga la página.
    </div>`;
    return;
  }

  // Se calcula sobre TODO el inventario (no solo lo filtrado) para que la
  // gráfica sea una foto general del estado por departamento.
  const depts = uniqueValues("Dpto");
  const groups = ["Online", "Offline", "Otro", "Sin dato"];

  const counts = {};
  depts.forEach(d => { counts[d] = { Online: 0, Offline: 0, Otro: 0, "Sin dato": 0 }; });

  data.forEach(r => {
    const dpto = (r["Dpto"] || "").toString().trim();
    if(!dpto || !counts[dpto]) return;
    const g = estadoGroup(r.ESTADO);
    counts[dpto][g] += 1;
  });

  // Ordena departamentos por total de sitios, de mayor a menor
  const sortedDepts = [...depts].sort((a, b) => {
    const totalA = groups.reduce((s, g) => s + counts[a][g], 0);
    const totalB = groups.reduce((s, g) => s + counts[b][g], 0);
    return totalB - totalA;
  });

  const datasets = groups.map(g => ({
    label: g,
    data: sortedDepts.map(d => counts[d][g]),
    backgroundColor: CHART_COLORS[g],
    borderRadius: 4,
    maxBarThickness: 34
  }));

  const ctx = el("statusByDeptChart").getContext("2d");

  if(statusChart){
    statusChart.data.labels = sortedDepts;
    statusChart.data.datasets = datasets;
    statusChart.update();
  } else {
    statusChart = new Chart(ctx, {
      type: "bar",
      data: { labels: sortedDepts, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              footer: (items) => {
                const total = items.reduce((s, it) => s + it.parsed.y, 0);
                return `Total: ${total} sitio(s)`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  el("chartLegendNote").innerHTML = groups.map(g => `
    <span><span class="legend-dot" style="background:${CHART_COLORS[g]}"></span>${g}</span>
  `).join("");
}

// ---------- Modal edición / creación ----------
function openEdit(id, focusCol){
  editingId = id;
  const row = id ? data.find(r => r._id === id) : null;
  el("modalTitle").textContent = id ? `Editar: ${row["Name EB"] || ""}` : "Agregar nuevo sitio";
  const grid = el("formGrid");
  grid.innerHTML = "";
  COLUMNS.forEach(col => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const isFull = col === "Name EB" || col === "ICCD" || TEXTAREA_COLUMNS.includes(col);
    if(isFull) wrap.classList.add("full");
    const value = row ? (row[col] ?? "") : "";
    if(TEXTAREA_COLUMNS.includes(col)){
      const safe = String(value).replace(/</g, "&lt;");
      wrap.innerHTML = `<label>${col}</label><textarea data-col="${col}" placeholder="Observaciones, incidentes, pendientes...">${safe}</textarea>`;
    } else {
      wrap.innerHTML = `<label>${col}</label><input type="text" data-col="${col}" value="${String(value).replace(/"/g, '&quot;')}">`;
    }
    grid.appendChild(wrap);
  });
  el("editOverlay").classList.add("show");

  if(focusCol){
    const target = grid.querySelector(`[data-col="${focusCol}"]`);
    if(target){
      setTimeout(() => { target.focus(); target.select?.(); }, 50);
    }
  }
}

function closeEdit(){
  el("editOverlay").classList.remove("show");
  editingId = null;
}

function saveEdit(){
  const inputs = el("formGrid").querySelectorAll("input, textarea");
  const newRow = {};
  inputs.forEach(inp => newRow[inp.dataset.col] = inp.value.trim());

  if(!newRow["Name EB"]){
    showToast("El campo 'Name EB' es obligatorio");
    return;
  }

  if(editingId){
    const idx = data.findIndex(r => r._id === editingId);
    data[idx] = { _id: editingId, ...newRow };
    showToast("Sitio actualizado correctamente");
  } else {
    data.push({ _id: nextId(), ...newRow });
    showToast("Sitio agregado correctamente");
  }
  saveData(data);
  closeEdit();
  render();
}

// ---------- Eliminar ----------
function openDelete(id){
  deletingId = id;
  const row = data.find(r => r._id === id);
  el("deleteText").textContent = `Se eliminará "${row["Name EB"] || "este registro"}" del inventario. Esta acción no se puede deshacer.`;
  el("deleteOverlay").classList.add("show");
}
function closeDelete(){
  el("deleteOverlay").classList.remove("show");
  deletingId = null;
}
function confirmDelete(){
  data = data.filter(r => r._id !== deletingId);
  saveData(data);
  showToast("Sitio eliminado");
  closeDelete();
  render();
}

// ---------- Toast ----------
let toastTimer;
function showToast(msg){
  const t = el("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

// ---------- Export CSV ----------
function exportCSV(){
  const rows = getFiltered();
  const header = COLUMNS.join(",");
  const lines = rows.map(r => COLUMNS.map(c => {
    let v = r[c] ?? "";
    v = String(v).replace(/"/g, '""');
    if(v.includes(",") || v.includes('"') || v.includes("\n")) v = `"${v}"`;
    return v;
  }).join(","));
  const csv = [header, ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventario_phantom_shield.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Reporte ejecutivo (PDF) ----------
function buildDeptBreakdown(){
  const depts = uniqueValues("Dpto");
  const groups = ["Online", "Offline", "Otro", "Sin dato"];
  const counts = {};
  depts.forEach(d => { counts[d] = { Online: 0, Offline: 0, Otro: 0, "Sin dato": 0 }; });
  data.forEach(r => {
    const dpto = (r["Dpto"] || "").toString().trim();
    if(!dpto || !counts[dpto]) return;
    counts[dpto][estadoGroup(r.ESTADO)] += 1;
  });
  const sorted = [...depts].sort((a, b) => {
    const totalA = groups.reduce((s, g) => s + counts[a][g], 0);
    const totalB = groups.reduce((s, g) => s + counts[b][g], 0);
    return totalB - totalA;
  });
  return { sorted, counts, groups };
}

async function generateExecutiveReport(){
  const btn = el("reportBtn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando...";

  try{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    let y = 0;

    // ---- Encabezado ----
    doc.setFillColor(227, 6, 19);
    doc.rect(0, 0, pageWidth, 86, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Reporte Ejecutivo — Inventario Phantom Shield", marginX, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const fecha = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    doc.text(`Claro · Generado el ${fecha}`, marginX, 60);
    y = 116;

    // ---- KPIs ----
    const total = data.length;
    const online = data.filter(r => estadoGroup(r.ESTADO) === "Online").length;
    const offline = data.filter(r => estadoGroup(r.ESTADO) === "Offline").length;
    const otro = data.filter(r => estadoGroup(r.ESTADO) === "Otro").length;
    const withCams = data.filter(r => {
      const c = parseFloat(r["Cantidad Camara(s)"]);
      return !isNaN(c) && c > 0;
    }).length;
    const withNotes = data.filter(r => (r.NOTAS || "").toString().trim() !== "").length;

    doc.setTextColor(27, 31, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("Resumen general", marginX, y);
    y += 10;

    const kpis = [
      ["Total de sitios", total],
      ["Online", online],
      ["Offline", offline],
      ["Otro estado", otro],
      ["Con cámaras instaladas", withCams],
      ["Sitios con notas registradas", withNotes],
    ];
    doc.autoTable({
      startY: y + 6,
      head: [["Indicador", "Valor"]],
      body: kpis.map(([k, v]) => [k, String(v)]),
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [244, 245, 247], textColor: [27, 31, 35], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      margin: { left: marginX, right: marginX },
      tableWidth: pageWidth - marginX * 2,
    });
    y = doc.lastAutoTable.finalY + 24;

    // ---- Gráfica de estado por departamento ----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("Estado por departamento", marginX, y);
    y += 10;

    if(statusChart){
      const chartImg = statusChart.toBase64Image("image/png", 1);
      const imgWidth = pageWidth - marginX * 2;
      const imgHeight = imgWidth * (statusChart.height / statusChart.width);
      doc.addImage(chartImg, "PNG", marginX, y + 6, imgWidth, imgHeight);
      y += imgHeight + 26;
    }

    // ---- Tabla resumen por departamento ----
    const { sorted, counts, groups } = buildDeptBreakdown();
    if(y > 650){ doc.addPage(); y = 40; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("Detalle por departamento", marginX, y);
    doc.autoTable({
      startY: y + 10,
      head: [["Dpto", ...groups, "Total"]],
      body: sorted.map(d => {
        const row = groups.map(g => counts[d][g]);
        const totalDept = row.reduce((s, v) => s + v, 0);
        return [d, ...row.map(String), String(totalDept)];
      }),
      theme: "striped",
      styles: { fontSize: 9.5, cellPadding: 5 },
      headStyles: { fillColor: [27, 31, 35], textColor: [255, 255, 255] },
      margin: { left: marginX, right: marginX },
      tableWidth: pageWidth - marginX * 2,
    });
    y = doc.lastAutoTable.finalY + 24;

    // ---- Sitios con notas / observaciones ----
    const notesRows = data.filter(r => (r.NOTAS || "").toString().trim() !== "");
    if(notesRows.length){
      if(y > 650){ doc.addPage(); y = 40; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.text("Sitios con observaciones registradas", marginX, y);
      doc.autoTable({
        startY: y + 10,
        head: [["Sitio", "Dpto", "Estado", "Nota"]],
        body: notesRows.map(r => [
          r["Name EB"] || "N/A",
          r["Dpto"] || "N/A",
          r["ESTADO"] || "N/A",
          r["NOTAS"] || ""
        ]),
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [27, 31, 35], textColor: [255, 255, 255] },
        columnStyles: { 3: { cellWidth: pageWidth - marginX * 2 - 260 } },
        margin: { left: marginX, right: marginX },
        tableWidth: pageWidth - marginX * 2,
      });
    }

    // ---- Pie de página ----
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++){
      doc.setPage(i);
      doc.setFontSize(8.5);
      doc.setTextColor(150, 155, 160);
      doc.text(
        `Reporte generado automáticamente desde el dashboard de inventario · Página ${i} de ${pageCount}`,
        marginX,
        doc.internal.pageSize.getHeight() - 20
      );
    }

    const filename = `reporte_ejecutivo_phantom_shield_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    showToast("Reporte ejecutivo descargado");
  } catch(err){
    console.error(err);
    showToast("No se pudo generar el reporte. Intenta de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ---------- Wire up ----------
function wireEvents(){
  el("searchInput").addEventListener("input", render);
  ["filterFase", "filterTipo", "filterRegional", "filterEstado"].forEach(id => el(id).addEventListener("change", render));
  el("resetFilters").addEventListener("click", () => {
    el("searchInput").value = "";
    el("filterFase").value = "";
    el("filterTipo").value = "";
    el("filterRegional").value = "";
    el("filterEstado").value = "";
    render();
  });
  el("addBtn").addEventListener("click", () => openEdit(null));
  el("closeModal").addEventListener("click", closeEdit);
  el("cancelEdit").addEventListener("click", closeEdit);
  el("saveEdit").addEventListener("click", saveEdit);
  el("cancelDelete").addEventListener("click", closeDelete);
  el("confirmDelete").addEventListener("click", confirmDelete);
  el("exportBtn").addEventListener("click", exportCSV);
  el("reportBtn").addEventListener("click", generateExecutiveReport);
  el("editOverlay").addEventListener("click", (e) => { if(e.target.id === "editOverlay") closeEdit(); });
  el("deleteOverlay").addEventListener("click", (e) => { if(e.target.id === "deleteOverlay") closeDelete(); });
}

// ---------- Init ----------
(async function init(){
  data = await loadData();
  buildHeader();
  wireEvents();
  render();
})();
