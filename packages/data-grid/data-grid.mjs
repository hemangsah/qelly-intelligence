import { dataStateIndicator, escapeHtml } from '../ui-primitives/primitives.mjs';

export class QellyDataGrid {
  constructor(container, { columns, rows, caption = 'Data grid', rowKey = 'id', density = 'comfortable', selectable = true, onSelectionChange = () => {} }) {
    this.container = container;
    this.columns = columns;
    this.rows = rows;
    this.caption = caption;
    this.rowKey = rowKey;
    this.density = density;
    this.selectable = selectable;
    this.onSelectionChange = onSelectionChange;
    this.sorts = [];
    this.selection = new Set();
    this.render();
  }

  setRows(rows) { this.rows = rows; this.render(); }
  setDensity(density) { this.density = density; this.render(); }

  sortedRows() {
    if (!this.sorts.length) return [...this.rows];
    return [...this.rows].sort((a, b) => {
      for (const sort of this.sorts) {
        const av = a[sort.key]; const bv = b[sort.key];
        const compared = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
        if (compared) return sort.direction === 'asc' ? compared : -compared;
      }
      return 0;
    });
  }

  toggleSort(key, multi = false) {
    const current = this.sorts.find((item) => item.key === key);
    if (!multi) this.sorts = current ? [current] : [];
    if (!current) this.sorts.push({ key, direction: 'asc' });
    else if (current.direction === 'asc') current.direction = 'desc';
    else this.sorts = this.sorts.filter((item) => item.key !== key);
    this.render();
  }

  render() {
    const rows = this.sortedRows();
    this.container.className = `q-data-grid q-data-grid--${this.density}`;
    this.container.innerHTML = `<div class="q-grid-scroll" tabindex="0" aria-label="Scrollable ${escapeHtml(this.caption)}"><table><caption>${escapeHtml(this.caption)}</caption><thead><tr>${this.selectable ? '<th class="q-grid-select"><span class="sr-only">Select</span></th>' : ''}${this.columns.map((column, index) => {
      const sort = this.sorts.find((item) => item.key === column.key);
      return `<th scope="col" class="${index === 0 ? 'is-pinned' : ''}" style="--col-width:${column.width ?? 140}px"><button class="q-grid-sort" data-key="${column.key}" aria-sort="${sort ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}"><span>${escapeHtml(column.label)}</span><span aria-hidden="true">${sort ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button><span class="q-grid-resizer" role="separator" aria-orientation="vertical" tabindex="0" data-resize="${column.key}" aria-label="Resize ${escapeHtml(column.label)} column"></span></th>`;
    }).join('')}<th scope="col" class="q-grid-actions">Actions</th></tr></thead><tbody>${rows.map((row) => `<tr data-row-key="${escapeHtml(row[this.rowKey])}" aria-selected="${this.selection.has(row[this.rowKey])}">${this.selectable ? `<td class="q-grid-select"><label class="q-grid-checkbox-target"><input type="checkbox" aria-label="Select ${escapeHtml(row.name ?? row.symbol ?? row[this.rowKey])}" ${this.selection.has(row[this.rowKey]) ? 'checked' : ''}></label></td>` : ''}${this.columns.map((column, index) => `<td class="${index === 0 ? 'is-pinned' : ''} ${column.numeric ? 'is-numeric' : ''}">${formatCell(row, column)}</td>`).join('')}<td class="q-grid-actions"><div class="q-row-actions"><button aria-label="Open ${escapeHtml(row.name ?? row.symbol)}">Open</button><button aria-label="Add ${escapeHtml(row.name ?? row.symbol)} to watchlist">Watch</button></div></td></tr>`).join('')}</tbody></table></div><div class="q-grid-footer"><span>${rows.length} rows</span><span>${this.sorts.length ? `Sorted by ${this.sorts.map((item) => `${item.key} ${item.direction}`).join(', ')}` : 'Unsorted'}</span><span>${this.selection.size} selected</span></div>`;
    this.bind();
  }

  bind() {
    this.container.querySelectorAll('[data-key]').forEach((button) => button.addEventListener('click', (event) => this.toggleSort(button.dataset.key, event.shiftKey)));
    this.container.querySelectorAll('tbody input[type="checkbox"]').forEach((input) => input.addEventListener('change', () => {
      const key = input.closest('tr').dataset.rowKey;
      input.checked ? this.selection.add(key) : this.selection.delete(key);
      this.onSelectionChange([...this.selection]);
      this.render();
    }));
    this.container.querySelectorAll('[data-resize]').forEach((handle) => {
      handle.addEventListener('keydown', (event) => {
        if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const column = this.columns.find((item) => item.key === handle.dataset.resize);
        column.width = Math.max(90, Math.min(360, (column.width ?? 140) + (event.key === 'ArrowRight' ? 10 : -10)));
        this.render();
      });
      handle.addEventListener('pointerdown', (event) => {
        const column = this.columns.find((item) => item.key === handle.dataset.resize);
        const startX = event.clientX; const startWidth = column.width ?? 140;
        handle.setPointerCapture(event.pointerId);
        const move = (moveEvent) => { column.width = Math.max(90, Math.min(360, startWidth + moveEvent.clientX - startX)); this.render(); };
        handle.addEventListener('pointermove', move, { once: true });
      });
    });
  }
}

function formatCell(row, column) {
  const value = row[column.key];
  if (column.format === 'status') {
    const state = row[column.stateKey ?? 'freshnessClass'] ?? 'cached';
    const label=['simulated','demo','fallback'].includes(state)?'':value;
    return dataStateIndicator({state,label});
  }
  if (column.format === 'change') {
    const number = Number(value);
    return `<span class="q-number ${number > 0 ? 'is-positive' : number < 0 ? 'is-negative' : ''}">${number > 0 ? '+' : ''}${number.toFixed(2)}%</span>`;
  }
  if (column.format === 'currency') return `<span class="q-number">${value == null ? 'N/A' : new Intl.NumberFormat('en-US',{style:'currency',currency:row.currency ?? 'USD',maximumFractionDigits:2}).format(value)}</span>`;
  if (column.format === 'source') return `<span class="q-source-cell"><strong>${escapeHtml(value)}</strong><small>${escapeHtml(row.observedLabel ?? '')}</small></span>`;
  if (column.render) return column.render(row);
  return value == null || value === '' ? '<span class="q-unavailable">N/A</span>' : escapeHtml(value);
}
