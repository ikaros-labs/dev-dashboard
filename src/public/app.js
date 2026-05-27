(function () {
  "use strict";

  let currentMinutes = 60;
  let metricsData = [];

  const ICONS = {
    code: '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    terminal:
      '<svg viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    bot: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>',
    dashboard:
      '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  };

  function drawChart(canvasId, data, maxVal, unit, color) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 10, right: 10, bottom: 25, left: 45 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "#21262d";
    ctx.lineWidth = 1;
    ctx.font = "11px monospace";
    ctx.fillStyle = "#484f58";
    ctx.textAlign = "right";

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      const val = maxVal - (maxVal / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillText(Math.round(val) + unit, pad.left - 5, y + 4);
    }

    if (data.length < 2) {
      ctx.fillStyle = "#484f58";
      ctx.textAlign = "center";
      ctx.font = "13px monospace";
      ctx.fillText("Collecting data...", w / 2, h / 2);
      return;
    }

    // Time labels
    ctx.textAlign = "center";
    ctx.fillStyle = "#484f58";
    const tsMin = data[0].ts;
    const tsMax = data[data.length - 1].ts;
    const tRange = tsMax - tsMin || 1;
    const labelCount = Math.min(5, data.length);
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.floor((i / (labelCount - 1)) * (data.length - 1));
      const x = pad.left + (plotW * (data[idx].ts - tsMin)) / tRange;
      const d = new Date(data[idx].ts * 1000);
      const label = d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
      ctx.fillText(label, x, h - 5);
    }

    // Area fill
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + plotH);
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + (plotW * (data[i].ts - tsMin)) / tRange;
      const y = pad.top + plotH - (plotH * data[i].val) / maxVal;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(pad.left + (plotW * (data[data.length - 1].ts - tsMin)) / tRange, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = color + "18";
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + (plotW * (data[i].ts - tsMin)) / tRange;
      const y = pad.top + plotH - (plotH * data[i].val) / maxVal;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function renderCharts() {
    const cpuData = metricsData.map((r) => ({ ts: r.ts, val: r.cpu_pct }));
    const memTotalMb = metricsData.length > 0 ? metricsData[0].mem_total_mb : 4096;
    const memData = metricsData.map((r) => ({ ts: r.ts, val: r.mem_used_mb }));

    drawChart("cpu-chart", cpuData, 100, "%", "#58a6ff");
    drawChart("mem-chart", memData, memTotalMb, "M", "#3fb950");
  }

  function renderServices(services) {
    const grid = document.getElementById("services-grid");
    grid.innerHTML = services
      .map(
        (s) =>
          `<a href="${s.url}" target="_blank" rel="noopener" class="service-card">
        <div class="icon">${ICONS[s.icon] || ICONS.dashboard}</div>
        <div class="label">${s.name}</div>
      </a>`
      )
      .join("");
  }

  function renderDemos(demos) {
    const list = document.getElementById("demos-list");
    if (demos.length === 0) {
      list.innerHTML = '<div class="empty-state">No active demos</div>';
      return;
    }
    list.innerHTML = demos
      .map(
        (d) =>
          `<div class="demo-item">
        <span class="demo-name">${d.name}</span>
        <a href="${d.url}" target="_blank" rel="noopener" class="demo-url">${d.url}</a>
        <span class="demo-port">:${d.port}</span>
      </div>`
      )
      .join("");
  }

  async function fetchMetrics() {
    try {
      const res = await fetch("/api/metrics?minutes=" + currentMinutes);
      metricsData = await res.json();
      renderCharts();
    } catch {
      /* retry next poll */
    }
  }

  async function fetchSystem() {
    try {
      const res = await fetch("/api/system");
      const data = await res.json();
      document.getElementById("cpu-current").textContent = "CPU: " + data.cpuPct + "%";
      document.getElementById("mem-current").textContent =
        "RAM: " + (data.memUsedMb / 1024).toFixed(1) + " / " + (data.memTotalMb / 1024).toFixed(1) + " GB";
    } catch {
      /* retry next poll */
    }
  }

  async function fetchDemos() {
    try {
      const res = await fetch("/api/demos");
      renderDemos(await res.json());
    } catch {
      /* retry next poll */
    }
  }

  async function fetchServices() {
    try {
      const res = await fetch("/api/services");
      renderServices(await res.json());
    } catch {
      /* retry next poll */
    }
  }

  // Time range buttons
  document.querySelector(".time-range").addEventListener("click", (e) => {
    if (e.target.tagName !== "BUTTON") return;
    document.querySelectorAll(".time-range button").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    currentMinutes = parseInt(e.target.dataset.minutes, 10);
    fetchMetrics();
  });

  // Resize handler
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCharts, 150);
  });

  // Initial load
  fetchServices();
  fetchMetrics();
  fetchSystem();
  fetchDemos();

  // Polling
  setInterval(fetchMetrics, 5000);
  setInterval(fetchSystem, 5000);
  setInterval(fetchDemos, 5000);
})();
