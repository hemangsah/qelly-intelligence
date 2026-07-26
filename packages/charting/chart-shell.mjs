import { escapeHtml } from '../ui-primitives/primitives.mjs';

export class QellyChartShell {
  constructor(container, { title, series, metadata, currency = 'USD' }) {
    this.container = container;
    this.title = title;
    this.series = series;
    this.metadata = metadata;
    this.currency = currency;
    this.window = { start: 0, end: series.length };
    this.render();
  }

  visible() { return this.series.slice(this.window.start, this.window.end); }
  pan(direction) {
    const width = this.window.end - this.window.start;
    const step = Math.max(1, Math.floor(width * .1));
    const start = Math.max(0, Math.min(this.series.length - width, this.window.start + direction * step));
    this.window = { start, end: start + width }; this.render();
  }
  zoom(direction) {
    const width = this.window.end - this.window.start;
    const nextWidth = Math.max(8, Math.min(this.series.length, width + direction * Math.max(2, Math.floor(width * .2))));
    const center = Math.floor((this.window.start + this.window.end) / 2);
    const start = Math.max(0, Math.min(this.series.length - nextWidth, center - Math.floor(nextWidth / 2)));
    this.window = { start, end: start + nextWidth }; this.render();
  }

  render() {
    const visible = this.visible();
    const values = visible.map((point) => point.value);
    const min = Math.min(...values); const max = Math.max(...values); const span = Math.max(1e-9, max - min);
    const width = 900; const height = 280; const pad = 28;
    const points = visible.map((point, index) => {
      const x = pad + (index / Math.max(1, visible.length - 1)) * (width - pad * 2);
      const y = height - pad - ((point.value - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const latest = visible.at(-1);
    this.container.className = 'q-chart-shell';
    this.container.innerHTML = `<div class="q-chart-header"><div><p class="q-eyebrow">Chart shell · adapter contract</p><h2>${escapeHtml(this.title)}</h2></div><div class="q-chart-value"><strong>${new Intl.NumberFormat('en-US',{style:'currency',currency:this.currency,maximumFractionDigits:2}).format(latest.value)}</strong><span class="q-status q-status--${escapeHtml(this.metadata.freshnessClass)}">${escapeHtml(this.metadata.freshnessClass)}</span></div></div><div class="q-chart-toolbar" role="toolbar" aria-label="Chart controls"><button data-chart="pan-left">← Pan</button><button data-chart="pan-right">Pan →</button><button data-chart="zoom-in">＋ Zoom</button><button data-chart="zoom-out">− Zoom</button><button data-chart="table" aria-expanded="false">Data table</button></div><div class="q-chart-visual"><svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">${escapeHtml(this.title)}</title><desc id="chart-desc">Line chart from ${escapeHtml(visible[0].label)} to ${escapeHtml(latest.label)}. Minimum ${min.toFixed(2)}, maximum ${max.toFixed(2)}, latest ${latest.value.toFixed(2)}.</desc><defs><linearGradient id="qelly-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--q-accent)" stop-opacity=".32"/><stop offset="1" stop-color="var(--q-accent)" stop-opacity="0"/></linearGradient></defs><line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" class="q-chart-axis"/><polygon points="${pad},${height-pad} ${points} ${width-pad},${height-pad}" fill="url(#qelly-chart-fill)"/><polyline points="${points}" class="q-chart-line"/><circle cx="${points.split(' ').at(-1).split(',')[0]}" cy="${points.split(' ').at(-1).split(',')[1]}" r="5" class="q-chart-point"/></svg></div><div class="q-chart-table" hidden><table><caption>${escapeHtml(this.title)} data table</caption><thead><tr><th>Date</th><th>Value</th></tr></thead><tbody>${visible.map((point) => `<tr><td>${escapeHtml(point.label)}</td><td>${point.value.toFixed(2)}</td></tr>`).join('')}</tbody></table></div><footer class="q-source-line"><span>Source: <strong>${escapeHtml(this.metadata.source)}</strong></span><span>Observed: ${escapeHtml(this.metadata.observedAt)}</span><span>Received: ${escapeHtml(this.metadata.receivedAt)}</span><span>Confidence: ${(this.metadata.confidence * 100).toFixed(0)}%</span></footer>`;
    this.bind();
  }

  bind() {
    this.container.querySelector('[data-chart="pan-left"]').addEventListener('click', () => this.pan(-1));
    this.container.querySelector('[data-chart="pan-right"]').addEventListener('click', () => this.pan(1));
    this.container.querySelector('[data-chart="zoom-in"]').addEventListener('click', () => this.zoom(-1));
    this.container.querySelector('[data-chart="zoom-out"]').addEventListener('click', () => this.zoom(1));
    const tableButton = this.container.querySelector('[data-chart="table"]');
    const table = this.container.querySelector('.q-chart-table');
    tableButton.addEventListener('click', () => {
      table.hidden = !table.hidden;
      tableButton.setAttribute('aria-expanded', String(!table.hidden));
    });
  }
}
