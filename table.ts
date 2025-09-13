type Primitive = string | number | boolean | null | undefined | Date;

interface DataColumn { name: string; values: Primitive[]; }
interface DataTable { title?: string; columns: DataColumn[]; meta?: Record<string, unknown>; }
interface PlotlyTrace { type?: string; name?: string; x?: any; y?: any; z?: any; labels?: any; values?: any; locations?: any; coloraxis?: string; colorbar?: { title?: { text?: string } }; [k: string]: any; }
interface PlotlyFigureLike { data?: PlotlyTrace[]; layout?: Record<string, any>; frames?: any[]; }

interface ExtractOptions {
  mergeCartesian?: boolean;
  unnamedYPrefix?: string;
  coerceDates?: boolean;
  xColumnName?: string;
}

/* ---------------- ndarray helpers ---------------- */

function isNdarrayLike(obj: any): obj is { dtype: string; bdata: string; shape?: any } {
  return obj && typeof obj === "object" && typeof obj.dtype === "string" && typeof obj.bdata === "string";
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const buf = (globalThis as any).Buffer?.from?.(b64, "base64");
  if (buf) return new Uint8Array(buf);
  throw new Error("No base64 decoder available");
}

function decodeNdarray(obj: { dtype: string; bdata: string }): Primitive[] {
  const bytes = base64ToBytes(obj.bdata);
  switch (obj.dtype) {
    case "i1": return Array.from(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    case "u1": return Array.from(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    case "i2": return Array.from(new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2)));
    case "u2": return Array.from(new Uint16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2)));
    case "i4": return Array.from(new Int32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4)));
    case "u4": return Array.from(new Uint32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4)));
    case "f4": return Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4)));
    case "f8": return Array.from(new Float64Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 8)));
    default: throw new Error(`Unsupported ndarray dtype: ${obj.dtype}`);
  }
}

function parseShape(shape: any): number[] | null {
  if (!shape) return null;
  if (Array.isArray(shape) && shape.every(n => typeof n === "number")) return shape.slice();
  if (typeof shape === "string") {
    const parts = shape.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).map(Number);
    if (parts.every(n => Number.isFinite(n))) return parts;
  }
  return null;
}

function reshape2D<T>(flat: T[], rows: number, cols: number): T[][] {
  const out: T[][] = new Array(rows);
  for (let r = 0; r < rows; r++) out[r] = flat.slice(r * cols, (r + 1) * cols);
  return out;
}

function transpose<T>(m: T[][]): T[][] {
  if (!m.length) return [];
  const r = m.length, c = m[0].length;
  const out: T[][] = Array.from({ length: c }, () => new Array(r) as T[]);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j][i] = m[i][j];
  return out;
}

/* ---------------- tiny utils ---------------- */

function toArray(v: any): Primitive[] {
  if (v == null) return [];
  if (isNdarrayLike(v)) return decodeNdarray(v);
  if (Array.isArray(v)) return v.slice();
  if (typeof v === "object" && typeof (v as any).length === "number") {
    try { return Array.from(v as any); } catch {}
  }
  return [v as Primitive];
}

function getXAxisTitle(fig: PlotlyFigureLike): string | undefined {
  const t = (fig.layout as any)?.xaxis?.title;
  return typeof t === "string" ? t : t?.text;
}
function getYAxisTitle(fig: PlotlyFigureLike): string | undefined {
  const t = (fig.layout as any)?.yaxis?.title;
  return typeof t === "string" ? t : t?.text;
}
function colorTitleFromFig(fig: PlotlyFigureLike, t: PlotlyTrace): string | undefined {
  const perTrace = t?.colorbar?.title?.text;
  if (perTrace) return perTrace;
  const axisKey = t.coloraxis;
  return axisKey && (fig.layout as any)?.[axisKey]?.colorbar?.title?.text;
}

/* ---------------- tables + CSV ---------------- */

function padColumnsToSameLength(columns: DataColumn[]): DataColumn[] {
  const n = Math.max(0, ...columns.map(c => c.values.length));
  return columns.map(c => {
    if (c.values.length === n) return c;
    const padded = c.values.slice();
    while (padded.length < n) padded.push(null);
    return { ...c, values: padded };
  });
}

function makeTable(title: string | undefined, columns: DataColumn[], meta?: Record<string, unknown>): DataTable {
  return { title, columns: padColumnsToSameLength(columns), meta };
}

function tableToArrays(table: DataTable): Primitive[][] {
  const header = table.columns.map(c => c.name);
  const n = Math.max(0, ...table.columns.map(c => c.values.length));
  const rows: Primitive[][] = [header];
  for (let r = 0; r < n; r++) rows.push(table.columns.map(c => c.values[r] ?? null));
  return rows;
}

/* ---------------- trace converters ---------------- */

function fromTableTrace(t: PlotlyTrace): DataTable {
  const headers: Primitive[] = (t.header?.values && Array.isArray(t.header.values) && t.header.values.length > 0)
    ? toArray(t.header.values[0]) : [];
  const cellsCols: Primitive[][] = (t.cells?.values && Array.isArray(t.cells.values))
    ? t.cells.values.map((col: any) => toArray(col)) : [];
  const columns: DataColumn[] = cellsCols.length
    ? cellsCols.map((col, i) => ({ name: String(headers[i] ?? `col_${i + 1}`), values: col }))
    : (headers.length ? headers.map((h, i) => ({ name: String(h ?? `col_${i + 1}`), values: [] })) : [{ name: "col_1", values: [] }]);
  return makeTable(t.name || "table", columns, { traceType: "table" });
}

/** Robust heatmap/contour/image reader that understands ndarray `shape` and fixes orientation. */
function fromHeatmapLike(fig: PlotlyFigureLike, t: PlotlyTrace): DataTable {
  const xVals = toArray(t.x);
  const yVals = toArray(t.y);

  // Build Z as matrix
  let Z: Primitive[][] = [];
  if (isNdarrayLike(t.z)) {
    const flat = decodeNdarray(t.z);
    let shp = parseShape((t.z as any).shape);
    if (!shp && xVals.length && yVals.length) shp = [yVals.length, xVals.length];
    if (!shp && Number.isInteger(Math.sqrt(flat.length))) {
      const n = Math.round(Math.sqrt(flat.length));
      shp = [n, n];
    }
    if (shp && shp.length >= 2) {
      const [s0, s1] = shp;
      Z = reshape2D(flat, s0, s1);
      // If shape doesn't match provided x/y sizes, try transpose
      if (xVals.length && yVals.length && (s0 !== yVals.length || s1 !== xVals.length)) {
        if (s1 === yVals.length && s0 === xVals.length) {
          Z = transpose(Z);
        }
      }
    } else {
      // Fallback: single row
      Z = [flat];
    }
  } else if (Array.isArray(t.z)) {
    // Already nested?
    if (Array.isArray(t.z[0])) {
      Z = (t.z as any[]).map(row => toArray(row));
    } else {
      const vec = toArray(t.z);
      if (xVals.length && yVals.length && vec.length === xVals.length * yVals.length) {
        const rows = yVals.length, cols = xVals.length;
        Z = reshape2D(vec, rows, cols);
      } else {
        Z = [vec];
      }
    }
  } else {
    Z = [toArray(t.z)];
  }

  // Ensure dimensions line up with labels (trim/pad as needed)
  const rows = yVals.length || Z.length;
  const cols = xVals.length || (Z[0]?.length ?? 0);
  Z = Z.slice(0, rows).map(r => r.slice(0, cols));
  while (Z.length < rows) Z.push(new Array(cols).fill(null));
  Z = Z.map(r => (r.length < cols ? r.concat(new Array(cols - r.length).fill(null)) : r));

  const yTitle = getYAxisTitle(fig) || "y";
  const columns: DataColumn[] = [{ name: yTitle, values: yVals.length ? yVals : Array.from({ length: rows }, (_, i) => i) }];
  for (let c = 0; c < cols; c++) {
    const name = String(xVals[c] ?? `col_${c}`);
    columns.push({ name, values: Z.map(row => row[c] ?? null) });
  }

  const valueTitle = colorTitleFromFig(fig, t) || "z";
  return makeTable(t.name || (t.type ?? "heatmap"), columns, { traceType: t.type ?? "heatmap", valueTitle });
}

function fromPieLike(t: PlotlyTrace): DataTable {
  const labels = toArray(t.labels);
  const values = toArray(t.values);
  const parents = toArray(t.parents);
  const cols: DataColumn[] = [{ name: "label", values: labels }, { name: "value", values }];
  if (parents.length) cols.push({ name: "parent", values: parents });
  return makeTable(t.name || (t.type ?? "pie"), cols, { traceType: t.type ?? "pie" });
}

function fromOhlcLike(t: PlotlyTrace): DataTable {
  return makeTable(t.name || (t.type ?? "ohlc"), [
    { name: "x", values: toArray(t.x) },
    { name: "open", values: toArray(t.open) },
    { name: "high", values: toArray(t.high) },
    { name: "low", values: toArray(t.low) },
    { name: "close", values: toArray(t.close) },
  ], { traceType: t.type ?? "ohlc" });
}

function fromWaterfall(t: PlotlyTrace): DataTable {
  const cols: DataColumn[] = [
    { name: "x", values: toArray(t.x) },
    { name: "y", values: toArray(t.y) },
  ];
  const measure = toArray(t.measure);
  if (measure.length) cols.push({ name: "measure", values: measure });
  return makeTable(t.name || "waterfall", cols, { traceType: "waterfall" });
}

function fromChoropleth(fig: PlotlyFigureLike, t: PlotlyTrace): DataTable {
  const valueCol = colorTitleFromFig(fig, t) || "value";
  return makeTable(t.name || "choropleth", [
    { name: "location", values: toArray(t.locations) },
    { name: valueCol, values: toArray(t.z) },
  ], { traceType: "choropleth", locationmode: t.locationmode, geo: t.geo });
}

function fromBoxOrViolin(fig: PlotlyFigureLike, t: PlotlyTrace): DataTable {
  const xs = toArray(t.x);
  const ys = toArray(t.y);
  const xVals = xs.length ? xs : new Array(ys.length).fill(t.name ?? "group");
  const xTitle = getXAxisTitle(fig) || "x";
  const yTitle = getYAxisTitle(fig) || "y";
  return makeTable(t.name || (t.type ?? "box"), [
    { name: xTitle, values: xVals },
    { name: yTitle, values: ys },
  ], { traceType: t.type ?? "box", longForm: true });
}

function isCartesianTrace(t: PlotlyTrace): boolean {
  const cartesianTypes = new Set([undefined, "scatter", "scattergl", "bar", "histogram", "area", "line", "lines"]);
  return (t.x != null || t.y != null) && (t.type == null || cartesianTypes.has(t.type));
}

function fromCartesian(
  fig: PlotlyFigureLike,
  t: PlotlyTrace,
  yNameFallback: string,
  opts: ExtractOptions = {}
): DataTable {
  const x = toArray(t.x);
  const y = toArray(t.y);

  // Prefer an explicit override, then axis titles, then fallbacks
  const xName = opts.xColumnName || getXAxisTitle(fig) || "x";
  const yName = t.name || getYAxisTitle(fig) || yNameFallback;

  const isArrayOfArrays = y.length > 0 && Array.isArray(y[0]);
  if (isArrayOfArrays) {
    const rowsX: Primitive[] = [];
    const rowsY: Primitive[] = [];
    (y as any[]).forEach((sub, i) => {
      const gx = x[i] ?? i;
      toArray(sub).forEach((yy) => { rowsX.push(gx); rowsY.push(yy); });
    });
    return makeTable(t.name || (t.type ?? "cartesian-long"), [
      { name: xName, values: rowsX },
      { name: yName, values: rowsY },
    ], { traceType: t.type ?? "cartesian", longForm: true });
  }

  return makeTable(t.name || (t.type ?? "cartesian"), [
    { name: xName, values: x },
    { name: yName, values: y },
  ], { traceType: t.type ?? "cartesian" });
}


/* ---------------- main extract ---------------- */

export function extractTables(fig: PlotlyFigureLike, options: ExtractOptions = {}): DataTable[] {
  const { mergeCartesian = false, unnamedYPrefix = "y", coerceDates = false, xColumnName } = options;
  const traces = fig.data ?? [];
  const perTrace: DataTable[] = [];
  let unnamedCounter = 1;

  for (const t of traces) {
    const typ = (t.type ?? "").toLowerCase();
    const fallbackY = `${unnamedYPrefix}_${unnamedCounter++}`;

    if (typ === "table")                    { perTrace.push(fromTableTrace(t)); continue; }
    if (typ === "heatmap" || typ === "image" || typ === "contour") {
      perTrace.push(fromHeatmapLike(fig, t)); continue;
    }
    if (typ === "pie" || typ === "sunburst" || typ === "treemap" || typ === "funnelarea") {
      perTrace.push(fromPieLike(t)); continue;
    }
    if (typ === "ohlc" || typ === "candlestick") { perTrace.push(fromOhlcLike(t)); continue; }
    if (typ === "waterfall")               { perTrace.push(fromWaterfall(t)); continue; }
    if (typ === "choropleth")              { perTrace.push(fromChoropleth(fig, t)); continue; }
    if (typ === "box" || typ === "violin") { perTrace.push(fromBoxOrViolin(fig, t)); continue; }
    if (isCartesianTrace(t)) {
      perTrace.push(fromCartesian(fig, t, fallbackY, options));
      continue;
    }


    // Fallback: dump whatever arrays we see
    const cols: DataColumn[] = [];
    (["x","y","z","labels","values","locations","open","high","low","close"] as const).forEach((key) => {
      const v = (t as any)[key];
      if (v != null) cols.push({ name: key, values: toArray(v) });
    });
    if (cols.length) perTrace.push(makeTable(t.name || typ || "trace", cols, { traceType: typ || "unknown" }));
  }

  if (coerceDates) {
    const xName = options.xColumnName || getXAxisTitle(fig) || "x";
    const maybeDate = (v: Primitive): Primitive => {
      if (v == null || v instanceof Date) return v;
      if (typeof v === "number") {
        if (v > 10_000_000 && v < 17_000_000_000) return new Date(v);
        return v;
      }
      if (typeof v === "string") {
        const d = new Date(v);
        if (!isNaN(d.getTime())) return d;
      }
      return v;
    };
    perTrace.forEach(tab => {
      tab.columns.forEach(col => {
        if (col.name === xName || col.name.toLowerCase() === "x") {
          col.values = col.values.map(maybeDate);
        }
      });
    });
  }

  // Optional: merge cartesian by X into one table
  if (!mergeCartesian) return perTrace;
  const xName = xColumnName || getXAxisTitle(fig) || "x";
  const cart = perTrace.filter(t =>
    t.columns.some(c => c.name === xName || c.name === "x") && t.columns.length >= 2
  );
  const other = perTrace.filter(t => !cart.includes(t));
  if (!cart.length) return perTrace;

  const merged = [mergeCartesianTables(cart, xName)];
  return [...merged, ...other];
}

export function mergeCartesianTables(tables: DataTable[], xName = "x"): DataTable {
  const key = (v: Primitive) => (v instanceof Date ? v.toISOString() : String(v));
  const xValues: Primitive[] = [];
  const seen = new Set<string>();
  tables.forEach((tab) => {
    const xCol = tab.columns.find(c => c.name === xName || c.name === "x");
    if (!xCol) return;
    xCol.values.forEach(v => { const k = key(v); if (!seen.has(k)) { seen.add(k); xValues.push(v); } });
  });

  const merged: Record<string, DataColumn> = { [xName]: { name: xName, values: xValues.slice() } };
  tables.forEach((tab) => {
    const xCol = tab.columns.find(c => c.name === xName || c.name === "x");
    const yCol = tab.columns.find(c => c.name !== (xCol?.name ?? xName));
    if (!xCol || !yCol) return;
    const seriesName = yCol.name;
    const out = new Array<Primitive | null>(xValues.length).fill(null);
    const idx = new Map<string, number>();
    xCol.values.forEach((v, i) => idx.set(key(v), i));
    xValues.forEach((vx, gi) => { const li = idx.get(key(vx)); if (li != null) out[gi] = yCol.values[li] ?? null; });
    merged[seriesName] = { name: seriesName, values: out };
  });

  return makeTable("merged_cartesian", Object.values(merged), { merged: true });
}

/* ---------------- convenience: figure → 2D arrays ---------------- */

export function figureTo2DArrays(fig: PlotlyFigureLike, opts: ExtractOptions = {}): Primitive[][][] {
  return extractTables(fig, opts).map(tableToArrays);
}

/* ===================== DEMO (uses your `fig` variable) =====================

- Put this file next to your code.
- Ensure your `const fig: PlotlyFigureLike = { ... }` (the heatmap JSON you pasted)
  is in scope, then run this snippet to see the 2-D array for the heatmap.
---------------------------------------------------------------------------- */

const fig: PlotlyFigureLike =  {
  "data": [
    {
      "marker": {
        "color": "indigo"
      },
      "orientation": "h",
      "text": {
        "dtype": "f8",
        "bdata": "AAAAAAACoEDD9Shcj6uWQArXo3A9jpJAj8L1KFxfkkCkcD0K13+JQFyPwvUorodAZmZmZmaihUCuR+F6FIqCQDMzMzMzg4JASOF6FK7PfkA="
      },
      "textposition": "outside",
      "x": {
        "dtype": "f8",
        "bdata": "AAAAAAACoEDD9Shcj6uWQArXo3A9jpJAj8L1KFxfkkCkcD0K13+JQFyPwvUorodAZmZmZmaihUCuR+F6FIqCQDMzMzMzg4JASOF6FK7PfkA="
      },
      "y": [
        "PCLN",
        "AMZN",
        "GOOGL",
        "GOOG",
        "AZO",
        "CMG",
        "MTD",
        "BLK",
        "REGN",
        "EQIX"
      ],
      "type": "bar"
    }
  ],
  "layout": {
    "template": {
      "data": {
        "barpolar": [
          {
            "marker": {
              "line": {
                "color": "white",
                "width": 0.5
              },
              "pattern": {
                "fillmode": "overlay",
                "size": 10,
                "solidity": 0.2
              }
            },
            "type": "barpolar"
          }
        ],
        "bar": [
          {
            "error_x": {
              "color": "#2a3f5f"
            },
            "error_y": {
              "color": "#2a3f5f"
            },
            "marker": {
              "line": {
                "color": "white",
                "width": 0.5
              },
              "pattern": {
                "fillmode": "overlay",
                "size": 10,
                "solidity": 0.2
              }
            },
            "type": "bar"
          }
        ],
        "carpet": [
          {
            "aaxis": {
              "endlinecolor": "#2a3f5f",
              "gridcolor": "#C8D4E3",
              "linecolor": "#C8D4E3",
              "minorgridcolor": "#C8D4E3",
              "startlinecolor": "#2a3f5f"
            },
            "baxis": {
              "endlinecolor": "#2a3f5f",
              "gridcolor": "#C8D4E3",
              "linecolor": "#C8D4E3",
              "minorgridcolor": "#C8D4E3",
              "startlinecolor": "#2a3f5f"
            },
            "type": "carpet"
          }
        ],
        "choropleth": [
          {
            "colorbar": {
              "outlinewidth": 0,
              "ticks": ""
            },
            "type": "choropleth"
          }
        ],
        "contourcarpet": [
          {
            "colorbar": {
              "outlinewidth": 0,
              "ticks": ""
            },
            "type": "contourcarpet"
          }
        ],
        "contour": [
          {
            "colorbar": {
              "outlinewidth": 0,
              "ticks": ""
            },
            "colorscale": [
              [
                0.0,
                "#0d0887"
              ],
              [
                0.1111111111111111,
                "#46039f"
              ],
              [
                0.2222222222222222,
                "#7201a8"
              ],
              [
                0.3333333333333333,
                "#9c179e"
              ],
              [
                0.4444444444444444,
                "#bd3786"
              ],
              [
                0.5555555555555556,
                "#d8576b"
              ],
              [
                0.6666666666666666,
                "#ed7953"
              ],
              [
                0.7777777777777778,
                "#fb9f3a"
              ],
              [
                0.8888888888888888,
                "#fdca26"
              ],
              [
                1.0,
                "#f0f921"
              ]
            ],
            "type": "contour"
          }
        ],
        "heatmap": [
          {
            "colorbar": {
              "outlinewidth": 0,
              "ticks": ""
            },
            "colorscale": [
              [
                0.0,
                "#0d0887"
              ],
              [
                0.1111111111111111,
                "#46039f"
              ],
              [
                0.2222222222222222,
                "#7201a8"
              ],
              [
                0.3333333333333333,
                "#9c179e"
              ],
              [
                0.4444444444444444,
                "#bd3786"
              ],
              [
                0.5555555555555556,
                "#d8576b"
              ],
              [
                0.6666666666666666,
                "#ed7953"
              ],
              [
                0.7777777777777778,
                "#fb9f3a"
              ],
              [
                0.8888888888888888,
                "#fdca26"
              ],
              [
                1.0,
                "#f0f921"
              ]
            ],
            "type": "heatmap"
          }
        ],
        "histogram2dcontour": [
          {
            "colorbar": {
              "outlinewidth": 0,
              "ticks": ""
            },
            "colorscale": [
              [
                0.0,
                "#0d0887"
              ],
              [
                0.1111111111111111,
                "#46039f"
              ],
              [
                0.2222222222222222,
                "#7201a8"
              ],
              [
                0.3333333333333333,
                "#9c179e"
              ],
              [
                0.4444444444444444,
                "#bd3786"
              ],
              [
                0.5555555555555556,
                "#d8576b"
              ],
              [
                0.6666666666666666,
                "#ed7953"
              ],
              [
                0.7777777777777778,
                "#fb9f3a"
              ],
              [
                0.8888888888888888,
                "#fdca26"
              ],
              [
                1.0,
                "#f0f921"
              ]
            ],
            "type": "histogram2dcontour"
          }
        ],
        "histogram2d": [
          {
            "colorbar": {
              "outlinewidth": 0,
              "ticks": ""
            },
            "colorscale": [
              [
                0.0,
                "#0d0887"
              ],
              [
                0.1111111111111111,
                "#46039f"
              ],
              [
                0.2222222222222222,
                "#7201a8"
              ],
              [
                0.3333333333333333,
                "#9c179e"
              ],
              [
                0.4444444444444444,
                "#bd3786"
              ],
              [
                0.5555555555555556,
                "#d8576b"
              ],
              [
                0.6666666666666666,
                "#ed7953"
              ],
              [
                0.7777777777777778,
                "#fb9f3a"
              ],
              [
                0.8888888888888888,
                "#fdca26"
              ],
              [
                1.0,
                "#f0f921"
              ]
            ],
            "type": "histogram2d"
          }
        ],
        "histogram": [
          {
            "marker": {
              "pattern": {
                "fillmode": "overlay",
                "size": 10,
                "solidity": 0.2
              }
            },
            "type": "histogram"
          }
        ],
        "mesh3d": [
          {
            "colorbar": {
              "outlinewidth": 0,
              "ticks": ""
            },
            "type": "mesh3d"
          }
        ],
        "parcoords": [
          {
            "line": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "type": "parcoords"
          }
        ],
        "pie": [
          {
            "automargin": true,
            "type": "pie"
          }
        ],
        "scatter3d": [
          {
            "line": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "marker": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "type": "scatter3d"
          }
        ],
        "scattercarpet": [
          {
            "marker": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "type": "scattercarpet"
          }
        ],
        "scattergeo": [
          {
            "marker": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "type": "scattergeo"
          }
        ],
        "scattergl": [
          {
            "marker": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "type": "scattergl"
          }
        ],
        "scattermapbox": [
          {
            "marker": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "type": "scattermapbox"
          }
        ],
        "scattermap": [
          {
            "marker": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "type": "scattermap"
          }
        ],
        "scatterpolargl": [
          {
            "marker": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "type": "scatterpolargl"
          }
        ],
        "scatterpolar": [
          {
            "marker": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "type": "scatterpolar"
          }
        ],
        "scatter": [
          {
            "fillpattern": {
              "fillmode": "overlay",
              "size": 10,
              "solidity": 0.2
            },
            "type": "scatter"
          }
        ],
        "scatterternary": [
          {
            "marker": {
              "colorbar": {
                "outlinewidth": 0,
                "ticks": ""
              }
            },
            "type": "scatterternary"
          }
        ],
        "surface": [
          {
            "colorbar": {
              "outlinewidth": 0,
              "ticks": ""
            },
            "colorscale": [
              [
                0.0,
                "#0d0887"
              ],
              [
                0.1111111111111111,
                "#46039f"
              ],
              [
                0.2222222222222222,
                "#7201a8"
              ],
              [
                0.3333333333333333,
                "#9c179e"
              ],
              [
                0.4444444444444444,
                "#bd3786"
              ],
              [
                0.5555555555555556,
                "#d8576b"
              ],
              [
                0.6666666666666666,
                "#ed7953"
              ],
              [
                0.7777777777777778,
                "#fb9f3a"
              ],
              [
                0.8888888888888888,
                "#fdca26"
              ],
              [
                1.0,
                "#f0f921"
              ]
            ],
            "type": "surface"
          }
        ],
        "table": [
          {
            "cells": {
              "fill": {
                "color": "#EBF0F8"
              },
              "line": {
                "color": "white"
              }
            },
            "header": {
              "fill": {
                "color": "#C8D4E3"
              },
              "line": {
                "color": "white"
              }
            },
            "type": "table"
          }
        ]
      },
      "layout": {
        "annotationdefaults": {
          "arrowcolor": "#2a3f5f",
          "arrowhead": 0,
          "arrowwidth": 1
        },
        "autotypenumbers": "strict",
        "coloraxis": {
          "colorbar": {
            "outlinewidth": 0,
            "ticks": ""
          }
        },
        "colorscale": {
          "diverging": [
            [
              0,
              "#8e0152"
            ],
            [
              0.1,
              "#c51b7d"
            ],
            [
              0.2,
              "#de77ae"
            ],
            [
              0.3,
              "#f1b6da"
            ],
            [
              0.4,
              "#fde0ef"
            ],
            [
              0.5,
              "#f7f7f7"
            ],
            [
              0.6,
              "#e6f5d0"
            ],
            [
              0.7,
              "#b8e186"
            ],
            [
              0.8,
              "#7fbc41"
            ],
            [
              0.9,
              "#4d9221"
            ],
            [
              1,
              "#276419"
            ]
          ],
          "sequential": [
            [
              0.0,
              "#0d0887"
            ],
            [
              0.1111111111111111,
              "#46039f"
            ],
            [
              0.2222222222222222,
              "#7201a8"
            ],
            [
              0.3333333333333333,
              "#9c179e"
            ],
            [
              0.4444444444444444,
              "#bd3786"
            ],
            [
              0.5555555555555556,
              "#d8576b"
            ],
            [
              0.6666666666666666,
              "#ed7953"
            ],
            [
              0.7777777777777778,
              "#fb9f3a"
            ],
            [
              0.8888888888888888,
              "#fdca26"
            ],
            [
              1.0,
              "#f0f921"
            ]
          ],
          "sequentialminus": [
            [
              0.0,
              "#0d0887"
            ],
            [
              0.1111111111111111,
              "#46039f"
            ],
            [
              0.2222222222222222,
              "#7201a8"
            ],
            [
              0.3333333333333333,
              "#9c179e"
            ],
            [
              0.4444444444444444,
              "#bd3786"
            ],
            [
              0.5555555555555556,
              "#d8576b"
            ],
            [
              0.6666666666666666,
              "#ed7953"
            ],
            [
              0.7777777777777778,
              "#fb9f3a"
            ],
            [
              0.8888888888888888,
              "#fdca26"
            ],
            [
              1.0,
              "#f0f921"
            ]
          ]
        },
        "colorway": [
          "#636efa",
          "#EF553B",
          "#00cc96",
          "#ab63fa",
          "#FFA15A",
          "#19d3f3",
          "#FF6692",
          "#B6E880",
          "#FF97FF",
          "#FECB52"
        ],
        "font": {
          "color": "#2a3f5f"
        },
        "geo": {
          "bgcolor": "white",
          "lakecolor": "white",
          "landcolor": "white",
          "showlakes": true,
          "showland": true,
          "subunitcolor": "#C8D4E3"
        },
        "hoverlabel": {
          "align": "left"
        },
        "hovermode": "closest",
        "mapbox": {
          "style": "light"
        },
        "paper_bgcolor": "white",
        "plot_bgcolor": "white",
        "polar": {
          "angularaxis": {
            "gridcolor": "#EBF0F8",
            "linecolor": "#EBF0F8",
            "ticks": ""
          },
          "bgcolor": "white",
          "radialaxis": {
            "gridcolor": "#EBF0F8",
            "linecolor": "#EBF0F8",
            "ticks": ""
          }
        },
        "scene": {
          "xaxis": {
            "backgroundcolor": "white",
            "gridcolor": "#DFE8F3",
            "gridwidth": 2,
            "linecolor": "#EBF0F8",
            "showbackground": true,
            "ticks": "",
            "zerolinecolor": "#EBF0F8"
          },
          "yaxis": {
            "backgroundcolor": "white",
            "gridcolor": "#DFE8F3",
            "gridwidth": 2,
            "linecolor": "#EBF0F8",
            "showbackground": true,
            "ticks": "",
            "zerolinecolor": "#EBF0F8"
          },
          "zaxis": {
            "backgroundcolor": "white",
            "gridcolor": "#DFE8F3",
            "gridwidth": 2,
            "linecolor": "#EBF0F8",
            "showbackground": true,
            "ticks": "",
            "zerolinecolor": "#EBF0F8"
          }
        },
        "shapedefaults": {
          "line": {
            "color": "#2a3f5f"
          }
        },
        "ternary": {
          "aaxis": {
            "gridcolor": "#DFE8F3",
            "linecolor": "#A2B1C6",
            "ticks": ""
          },
          "baxis": {
            "gridcolor": "#DFE8F3",
            "linecolor": "#A2B1C6",
            "ticks": ""
          },
          "bgcolor": "white",
          "caxis": {
            "gridcolor": "#DFE8F3",
            "linecolor": "#A2B1C6",
            "ticks": ""
          }
        },
        "title": {
          "x": 0.05
        },
        "xaxis": {
          "automargin": true,
          "gridcolor": "#EBF0F8",
          "linecolor": "#EBF0F8",
          "ticks": "",
          "title": {
            "standoff": 15
          },
          "zerolinecolor": "#EBF0F8",
          "zerolinewidth": 2
        },
        "yaxis": {
          "automargin": true,
          "gridcolor": "#EBF0F8",
          "linecolor": "#EBF0F8",
          "ticks": "",
          "title": {
            "standoff": 15
          },
          "zerolinecolor": "#EBF0F8",
          "zerolinewidth": 2
        }
      }
    },
    "title": {
      "text": "Top 10 Stocks by Highest Close Price (Horizontal Bar Chart)"
    },
    "yaxis": {
      "title": {
        "text": "Stock Name"
      }
    },
    "xaxis": {
      "title": {
        "text": "Highest Close Price (USD)"
      }
    }
  }
}

// Example run:
if ((fig as any)?.data) {
  const startTime = Date.now();
  console.log("Extracting tables...");
  const arrays = figureTo2DArrays(fig, { mergeCartesian: true });

  console.log(JSON.stringify(arrays)); 

  console.log(`Done in ${Date.now() - startTime}ms; ${arrays.length} table(s) extracted.`);
} else {
  console.log("Define `fig` (your Plotly JSON) in scope, then run again.");
}
