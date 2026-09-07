// ─── style.css backstop (see _bundle_head) ───
;(function(){var want = ['public/intro-functional/style.css', 'public/intro-structural/style.css', 'public/ooo-heatmap/style.css', 'public/ooo-abcd/style.css', 'public/ooo-patch/style.css', 'public/feature-examples/style.css', 'public/feature-coverage/style.css', 'public/comp-lines/style.css', 'public/comp-strata/style.css', 'public/comp-tail-energy/style.css', 'public/mlp-gain/style.css', 'public/lens-similarity/style.css', 'public/transcoder-arith/style.css', 'public/transcoder-translation/style.css', 'public/attn-panel/style.css', 'public/jlens-circuit-graph/style.css', 'public/attn-broadcast-reselect/style.css', 'public/ablation-bars/style.css', 'public/ablation-examples/style.css', 'public/ablation-strength/style.css', 'public/blackmail-clamp/style.css', 'public/lensapp-panel/style.css', 'public/reflection-training/style.css', 'public/dn-tracecond/style.css', 'public/dn-exclusion/style.css', 'public/refl-training-examples/style.css', 'public/modulation-readout/style.css', 'public/modulation-lines/style.css', 'public/modulation-prompts/style.css', 'public/latent-patching/style.css', 'public/multihop-swap-success/style.css', 'public/repeat-switch/style.css', 'public/verbal-report/style.css', 'public/verbal-introspection/style.css', 'public/top-down-summoning/style.css', 'public/flex-gen-systematic/style.css', 'public/selectivity-linecount/style.css', 'public/selectivity-language/style.css', 'public/post-training/style.css', 'public/lens-inline/style.css', 'public/methods-qualitative/style.css', 'public/jlens-audit/style.css', 'public/jlens-rm-bias/style.css', 'public/jlens-rm-bias-examples/style.css', 'public/pref-violation-lens/style.css', 'public/layer-diagram/style.css', 'public/line-panels/style.css', 'public/capacity-fve-occupancy/style.css', 'public/broadcast-ablation/style.css', 'public/lens-callout/style.css', 'public/misalign-lens/style.css', 'public/roleplay-lens/style.css', 'public/reward-hack-readout/style.css', 'public/reward-hack-quant/style.css', 'public/modulation-probe/style.css', 'public/probe-swap/style.css', 'public/verbal-report-decomposition-merged/style.css', 'public/selfreport/style.css', 'public/slice-inline/style.css', 'public/slice-stack/style.css', 'public/metacog-alarm/style.css', 'public/ignition/style.css', 'public/eval-awareness-probe/style.css', 'public/dual-task-simple/style.css', 'public/capacity-final-band/style.css', 'public/flex-generalization-example/style.css', 'public/flex-generalization-systematic/style.css', 'public/capacity-band-vs-single/style.css', 'public/app-mt-examples/style.css', 'public/oracle-lens/style.css', 'public/app-mt-bytok/style.css', 'public/app-mt-paper/style.css']
  var have = new Set([...document.querySelectorAll('link[rel=stylesheet]')]
    .map(l => (l.getAttribute('href')||'').replace(/\?.*/,'')))
  want.forEach(function(h){ if (have.has(h)) return
    var l = document.createElement('link')
    l.rel = 'stylesheet'; l.href = h
    document.head.appendChild(l) })
})()
// ─── public/util.js ───
window.util = (function(){

  // ───── url params ─────
  // URL params become fetch bases and hrefs; keep them on this page's origin.
  // Rejects scheme injection (javascript:, data:, https://other-host) and
  // protocol-relative //host. Relative paths (incl. ../) and same-origin
  // /absolute paths pass through unchanged.
  function safeRelPath(p, fallback){
    return p && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(p) ? p : fallback
  }

  var params = {
    get: key => {
      var v = new URLSearchParams(location.search).get(key)
      return v && decodeURIComponent(v)
    },
    set: (key, value) => {
      var url = new URL(location)
      if (value == null) url.searchParams.delete(key)
      else url.searchParams.set(key, encodeURIComponent(value))
      history.replaceState(null, '', url)
    },
    getAll: () => {
      var rv = {}
      for (var [k, v] of new URLSearchParams(location.search)) rv[k] = decodeURIComponent(v)
      return rv
    },
  }

  // ───── render fan-out ─────
  function initRenderAll(labels){
    var rv = {}
    labels.forEach(label => {
      rv[label] = ev => Object.values(rv[label].fns).forEach(d => d(ev))
      rv[label].fns = []
    })
    return rv
  }

  function attachRenderAllHistory(renderAll, visState, skipKeys=['hoverId', 'hoverIdx']){
    Object.keys(renderAll).forEach(key => {
      renderAll[key].fns.push(() => {
        if (skipKeys.includes(key)) return
        var url = new URL(location)
        if (visState[key] == url.searchParams.get(key)) return
        url.searchParams.set(key, visState[key])
        history.pushState({...visState}, '', url)
      })
    })
    d3.select(window).on('popstate.updateState', ev => {
      if (!ev.state) return
      Object.keys(renderAll).forEach(key => {
        if (skipKeys.includes(key) || visState[key] == ev.state[key]) return
        visState[key] = ev.state[key]
        renderAll[key]()
      })
    })
  }

  // ───── data loading ─────
  // window-scoped cache survives hot-reload re-runs of init()
  window.__datacache = window.__datacache || {}

  async function loadParquet(url){
    var buffer = await fetch(url, {cache: 'default'}).then(r => r.arrayBuffer())
    var rows
    await hyparquet.parquetRead({file: buffer, rowFormat: 'object', onComplete: d => rows = d})
    rows.forEach(r => { for (var k in r) if (typeof r[k] === 'bigint') r[k] = Number(r[k]) })
    return rows
  }

  function cachedParquet(url){
    if (!__datacache[url]) __datacache[url] = loadParquet(url)
    return __datacache[url]
  }

  async function loadNpy(url){
    return npyjs.parse(await fetch(url, {cache: 'default'}).then(r => r.arrayBuffer()))
  }

  async function getFile(path){
    if (!__datacache[path]) __datacache[path] = (async () => {
      var res = await fetch(path, {cache: 'no-cache'})
      if (!res.ok) throw Error(res.status + ' ' + path)
      var type = path.split('?')[0].replaceAll('..', '').split('.').at(-1)
      if (type == 'csv')   return d3.csvParse(await res.text())
      if (type == 'npy')   return npyjs.parse(await res.arrayBuffer())
      if (type == 'json')  return res.json()
      if (type == 'jsonl') return (await res.text()).split(/\r?\n/).filter(d => d).map(JSON.parse)
      if (type == 'parquet') return loadParquet(path)
      return res.text()
    })()
    return __datacache[path]
  }

  // ───── chart styling ─────
  function addAxisLabel(c, xText, yText, title='', xOffset=0, yOffset=0, titleOffset=0){
    c.svg.select('.x').append('g').translate([c.width/2, xOffset + 27])
      .append('text.axis-label').text(xText).at({textAnchor: 'middle'})
    c.svg.select('.y').append('g').translate([yOffset - 30, c.height/2])
      .append('text.axis-label').text(yText).at({textAnchor: 'middle', transform: 'rotate(-90)'})
    if (title) c.svg.append('g.axis').translate([c.width/2, titleOffset - 10])
      .append('text.axis-label.axis-title').text(title).at({textAnchor: 'middle'})
  }

  function ggPlot(c){
    c.svg.append('rect.bg-rect').at({width: c.width, height: c.height, fill: c.isBlack ? '#000' : '#EAECED'}).lower()
    c.svg.selectAll('.domain').remove()
    ggPlotUpdate(c)
  }

  function ggPlotUpdate(c){
    // inline style, not attr — several per-figure sheets set `.axis path { stroke: var(--tick-line) }`
    // and CSS beats SVG presentation attrs, which turned the gridlines #ddd.
    var grid = c.isBlack ? '#444' : '#fff'
    c.svg.selectAll('.tick line').remove()
    c.svg.selectAll('.x text').at({y: 4})
    c.svg.selectAll('.x .tick').selectAppend('path').at({d: 'M 0 0 V -' + c.height, strokeWidth: 1}).st({stroke: grid})
    c.svg.selectAll('.y text').at({x: -3})
    c.svg.selectAll('.y .tick').selectAppend('path').at({d: 'M 0 0 H ' + c.width, strokeWidth: 1}).st({stroke: grid})
  }

  // workspace-layer band with consistent z-order: sits on top of bg-rect but
  // BELOW the white gridlines that ggPlot draws inside .x/.y .tick paths.
  // Bracket + label sit above the data in the same kraft tone as the band so
  // they read as part of the band, not as a chart annotation.
  function addWsBand(c, lo, hi, opts={}){
    var bg = c.svg.select('.bg-rect').node()
    var x0 = c.x(lo), x1 = c.x(hi), tk = 5
    var r = c.svg.insert('rect', bg ? () => bg.nextSibling : ':first-child')
      .at({class: 'ws-band', x: x0, width: x1 - x0, y: 0, height: c.height})
    if (opts.label !== false){
      var g = c.svg.append('g.ws-annot')
      g.append('path.ws-bracket').at({d: `M${x0},${tk} V0 H${x1} V${tk}`})
      g.append('text.ws-label').text(opts.label || 'Workspace layers')
        .at({x: (x0 + x1)/2, y: 7, textAnchor: 'middle'})
    }
    return r
  }

  // Canonical layer-axis ticks: pub indices that display as 0/25/50/75/100.
  // Filtered to [0, nLayers-1] so figures whose data starts late or stops
  // short of L24 just drop the out-of-range ticks.
  function layerTicks(nLayers, nTicks){
    var canon = [0, 6, 12, 18, 24]
    return canon.filter(t => t < nLayers)
  }

  // Display mapping for published layer indices: 0..24 → 0..100. Data and scale
  // domains stay 0..24; this only formats the visible number.
  var DISPLAY_LAYERS = [0,4,8,12,17,21,25,29,33,38,42,46,50,54,58,62,67,71,75,79,83,88,92,96,100]
  function layerLabel(i){ var d = DISPLAY_LAYERS[i]; return d == null ? i : d }

  // ───── colors ─────
  // Visual vocab. Source of truth for figure colors/spacing — `syncVars()`
  // writes these to CSS custom properties at load so shared-styles.css and
  // figure CSS read the same values. Don't hardcode hex in figure JS or CSS;
  // use util.gray/accent/series or var(--gray-*) etc.
  //
  // gray ramp = neutral, distill-derived (transformer-circuits.pub body).
  // series/accents = Paul Tol vibrant (CVD-safe).
  var gray = {
    100: '#fafafa',  // soft bg / card bg
    200: '#eee',     // rules, hairline borders
    300: '#ddd',     // grid lines, tick lines
    400: '#bbb',     // faint text, disabled
    500: '#888',     // light text, secondary labels
    600: '#555',     // tick labels
    700: '#333',     // body text
    900: '#111',     // emphasis
  }
  // Category10-ish, ordered for hue separation: blue, green, brown, purple,
  // orange, red. Orange is in the series AND is the activation/accent hue —
  // figures that cycle series and also use accent.main will show it twice.
  var series = ['#1f77b4', '#2ca02c', '#8c564b', '#9467bd', '#ee7733', '#d62728']
  // Named aliases into `series` so figure code can read `tol.blue`/`tol.teal`
  // and get the well-spaced palette. Names are approximate (teal→green,
  // magenta→purple, cyan→brown).
  var tol = {
    blue:    series[0],
    teal:    series[1],
    cyan:    series[2],
    magenta: series[3],
    orange:  series[4],
    red:     series[5],
  }
  var accent = {
    main:      tol.orange,
    secondary: tol.blue,
    pro:       tol.magenta,
    danger:    tol.red,
  }
  // Brand palette — for non-data accents: callout boxes, brand moments, soft
  // fills. Not for series.
  // manilla/kraft are the J-space marker colors (intro-functional thought
  // bubble, intro-structural sliver, .ws-band shading, layer-diagram, …);
  // values are lifted from the J-lens readout box in the J-lens schematic
  // figure so every "this is the workspace" fill in the paper matches.
  var brand = {
    clay:      '#d98058',
    bookCloth: '#cc7d5c',
    kraft:     '#dd9e57',
    manilla:   '#fdf4e3',
    lilypad:   '#7eba8f',
  }
  var pos = tol.blue, neg = tol.orange
  // Same model → same color, every figure that compares across models.
  var modelColors = { haiku: '#f7b380', sonnet: tol.orange, opus: '#a8460e' }
  // Ablation tier → orange shade (shared by ablation-bars/-strength/-examples).
  var ablationColors = { light: '#f8c08a', medium: tol.orange, heavy: '#b34d10', random: gray[400] }
  // Same lens type → same color, every figure that compares lens variants.
  // jacobian stays blue (paper's namesake); logit/tuned get purple/green for
  // separation — the old blue/cyan/teal triple was indistinguishable.
  var lensColors = { jacobian: series[0], logit: series[3], tuned: series[1] }
  var space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }
  // Solid tint instead of opacity — equivalent visual but bars stay opaque.
  // tint(color, 0.5) = halfway to white.
  function tint(c, t){ return d3.interpolateRgb(c, '#fff')(t) }
  // J-space decomposition conditions — shared by probe-swap (Fig 15) and
  // verbal-report-decomposition-merged (Fig 7) so a reader learns the
  // mapping once. Clamped variants are a 0.5 tint of their parent.
  var jspaceColors = {
    jlens: tol.blue, clean: gray[300], random: gray[300],
    aligned: tol.orange, probe_jpart2: tol.orange,
    residual: gray[500], probe_ortho2: gray[500],
    full: tol.teal,
    probe_jpart2_oclamp: tint(tol.orange, .5),
    probe_ortho2_jclamp: tint(gray[500], .5),
    residual_jclamp: tint(gray[500], .5),
  }
  // Inline style for shading a token by activation strength t ∈ [0,1].
  // t=0 → white, t=1 → tinted color at ~60%. Use for any "how much does this
  // token activate" shading so figures share one ramp.
  function activationBg(color, t){ return `background:${tint(color, 1 - t * 0.6)}` }

  // NYT-style direct line label: colored text with a halo so it reads over the
  // plot. x/y are pixel coords (caller converts via c.x/c.y); dx/dy nudge.
  // halo defaults to the ggPlot bg since every line chart in the paper uses it.
  // Pass leader:[lx,ly] (px) to draw a thin gray connector from label to line.
  function directLabel(svg, {x, y, text, color, dx=0, dy=0, anchor='start', halo='#EAECED', leader, key}){
    var g = svg.append('g.direct-label').translate([x, y])
    if (leader) g.append('path').at({
      d: `M${dx + (anchor == 'end' ? -2 : anchor == 'middle' ? 0 : 2)},${dy - 3} L${leader[0]-x},${leader[1]-y}`,
      stroke: gray[400], strokeWidth: 1, fill: 'none',
    })
    var t = g.append('text.dlabel').text(text).at({x: dx, y: dy, textAnchor: anchor, fill: color})
      .st({paintOrder: 'stroke', stroke: halo, strokeWidth: 1, strokeLinejoin: 'round',
           fontSize: 'var(--fs-label)', fontWeight: 600})
    if (key) t.at({'data-series': key})
    return g
  }

  // Cross-panel line+label hover: any element with data-series=<k> highlights
  // every [data-series=<k>] inside figSel on mouseover. Figures tag their line
  // paths with .line-series + data-series, pass key to directLabel, then call
  // this once on the figure root. Only binds when there are many series — for a
  // handful of labelled lines the highlight is just visual noise.
  function bindSeriesHover(figSel, {minSeries=9}={}){
    if (params.get('tune') === '1') return  // .raise() detaches d3.drag mid-gesture
    var keys = new Set(); figSel.selectAll('[data-series]').each(function(){ keys.add(this.dataset.series) })
    if (keys.size < minSeries) return
    figSel.on('mouseover.series', e => {
      var k = e.target.closest('[data-series]')?.dataset.series
      var all = figSel.selectAll('[data-series]').classed('on', false)
      if (k) all.filter(function(){ return this.dataset.series === k }).classed('on', true).raise()
    }).on('mouseleave.series', () => figSel.selectAll('[data-series]').classed('on', false))
  }

  // Expanded hit-area for small jitter circles: mousemove on svgSel picks the
  // nearest dataSel circle within `radius` px (Delaunay if loaded, else linear
  // scan). Picked el gets .hov; onHover(d, el) fires while one is picked,
  // onLeave() when none. Coords read from cx/cy — assumes circles share
  // svgSel's coordinate space.
  function nearestHover(svgSel, dataSel, {radius=40, onHover, onLeave}={}){
    var nodes = dataSel.nodes(), data = dataSel.data()
    var pts = nodes.map(n => [+n.getAttribute('cx'), +n.getAttribute('cy')])
    var del = d3.Delaunay && pts.length ? d3.Delaunay.from(pts) : null
    var find = del ? (x, y) => del.find(x, y) : (x, y) => {
      var bi = -1, bd = Infinity
      for (var i = 0; i < pts.length; i++){
        var dd = (pts[i][0]-x)**2 + (pts[i][1]-y)**2
        if (dd < bd){ bd = dd; bi = i }
      }
      return bi
    }
    var cur = -1
    svgSel.on('mousemove.nearestHover', e => {
      var [mx, my] = d3.pointer(e, svgSel.node())
      var i = pts.length ? find(mx, my) : -1
      if (i >= 0 && Math.hypot(pts[i][0]-mx, pts[i][1]-my) > radius) i = -1
      if (i !== cur){
        if (cur >= 0) nodes[cur].classList.remove('hov')
        if (i >= 0) nodes[i].classList.add('hov'); else onLeave?.()
        cur = i
      }
      if (i >= 0) onHover?.(data[i], nodes[i], e)
    }).on('mouseleave.nearestHover', () => {
      if (cur < 0) return
      nodes[cur].classList.remove('hov'); onLeave?.(); cur = -1
    })
  }

  // Stack a set of labels along a vertical edge without overlap: pass anchors
  // as [{text,color,y,...}] sorted by data-y; returns the same with y nudged so
  // adjacent labels are ≥ minGap apart, preserving order.
  function spreadLabels(specs, minGap=13){
    var s = specs.slice().sort((a,b) => a.y - b.y)
    for (var i = 1; i < s.length; i++) if (s[i].y - s[i-1].y < minGap) s[i].y = s[i-1].y + minGap
    for (var i = s.length - 2; i >= 0; i--) if (s[i+1].y - s[i].y < minGap) s[i].y = s[i+1].y - minGap
    return specs
  }

  // Error-bar whisker: vertical line from lo→hi (pixel coords) with top/bottom
  // caps. capW=0 for no caps; stroke defaults to gray[700].
  function barWhisker(svg, {x, lo, hi, capW=4, stroke=gray[700]}){
    var s = {stroke, strokeWidth: 1.2}
    svg.append('line').at({x1: x, x2: x, y1: lo, y2: hi, ...s})
    if (!capW) return
    svg.append('line').at({x1: x - capW, x2: x + capW, y1: lo, y2: lo, ...s})
    svg.append('line').at({x1: x - capW, x2: x + capW, y1: hi, y2: hi, ...s})
  }

  function syncVars(){
    var root = document.documentElement.style
    Object.entries(gray).forEach(([k,v]) => root.setProperty('--gray-'+k, v))
    Object.entries(tol).forEach(([k,v]) => root.setProperty('--tol-'+k, v))
    Object.entries(accent).forEach(([k,v]) => root.setProperty('--accent-'+k, v))
    Object.entries(brand).forEach(([k,v]) => root.setProperty('--brand-'+k, v))
    series.forEach((c,i) => root.setProperty('--series-'+i, c))
    Object.entries(modelColors).forEach(([k,v]) => root.setProperty('--model-'+k, v))
    Object.entries(lensColors).forEach(([k,v]) => root.setProperty('--lens-'+k, v))
    Object.entries(space).forEach(([k,v]) => root.setProperty('--space-'+k, v+'px'))
  }
  syncVars()

  function rankColorCapped(cap){
    return d3.scaleSequential(d3.interpolateViridis).domain([Math.log10(cap), 0])
  }
  var rankColor = rankColorCapped(10000)
  var lineColors = series  // legacy alias; new code should use util.series

  function drawColorbar(sel, {label='rank', w=300, h=10, cap=10000}={}){
    var n = 100
    var rc = rankColorCapped(cap)
    var ticks = cap <= 1000 ? [1, 10, 100, 1000] : [1, 10, 100, 1000, 10000]
    var svg = sel.append('svg.colorbar').at({width: w + 60, height: h + 20}).st({overflow: 'visible'})
    var g = svg.append('g').translate([30, 0])
    g.appendMany('rect', d3.range(n)).at({x: i => i*w/n, width: w/n+1, height: h, fill: i => rc(i/n * Math.log10(cap))})
    var x = d3.scaleLog().domain([1, cap]).range([0, w])
    g.appendMany('text', ticks).text(d => d >= cap ? (cap >= 1000 ? cap/1000+'k+' : cap+'+') : d >= 1000 ? d/1000+'k' : d).at({x: d => x(d), y: h+12, textAnchor: 'middle'})
    g.append('text.axis-label').text(label).at({x: -4, y: h-1, textAnchor: 'end'})
    return rc
  }

  // ───── drag-tune (?tune=1) ─────
  // On a figure's standalone page, ?tune=1 makes registered elements draggable.
  // Positions land in ?pos= and a fixed config panel — copy either back to
  // hardcode. items: [{sel, key, get:()=>({x,y}), set:({x,y})=>void}].
  // ns groups keys in the URL/panel so multiple dragTune calls coexist.
  var _dt
  function _dtInit(){
    if (_dt) return _dt
    var pos = {}
    ;(params.get('pos') || '').split(';').filter(Boolean).forEach(e => {
      var m = e.match(/^([^.]+)\.(.+):(-?\d+),(-?\d+)$/); if (!m) return
      ;(pos[m[1]] ||= {})[m[2]] = {x: +m[3], y: +m[4]}
    })
    var panel = d3.select('body').selectAppend('div.dragtune-panel')
      .st({position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', color: '#eee',
           font: '11px/1.4 monospace', padding: '8px 12px', zIndex: 9999, maxHeight: '30vh', overflow: 'auto'})
    panel.selectAppend('button').text('copy URL').st({float: 'right', cursor: 'pointer'})
      .on('click', () => navigator.clipboard.writeText(location.href))
    var pre = panel.selectAppend('pre').st({margin: 0, whiteSpace: 'pre-wrap'})
    function sync(){
      var enc = Object.entries(pos).flatMap(([n, ks]) =>
        Object.entries(ks).map(([k, p]) => `${n}.${k}:${p.x},${p.y}`)).join(';')
      var q = new URLSearchParams(location.search); q.delete('pos')
      history.replaceState(null, '', '?' + q + (enc ? '&pos=' + enc : ''))
      pre.text(Object.entries(pos).map(([n, ks]) =>
        `// ${n}\n` + Object.entries(ks).map(([k, p]) => `  ${k}: {x: ${p.x}, y: ${p.y}},`).join('\n')
      ).join('\n'))
    }
    return _dt = {pos, sync}
  }
  function dragTune(items, ns='fig'){
    if (params.get('tune') !== '1') return
    var {pos, sync} = _dtInit()
    items.forEach(it => {
      var sel = it.sel.call ? it.sel : d3.select(it.sel)
      var saved = pos[ns]?.[it.key], p = saved ? {...saved} : it.get()
      if (saved) it.set(p)
      ;(pos[ns] ||= {})[it.key] = {x: Math.round(p.x), y: Math.round(p.y)}
      sel.st({cursor: 'move'}).call(d3.drag()
        .on('drag', e => { p.x += e.dx; p.y += e.dy; it.set(p) })
        .on('end', () => { pos[ns][it.key] = {x: Math.round(p.x), y: Math.round(p.y)}; sync() }))
    })
    sync()
  }
  // Auto-register every text.dlabel under sel — key from data-series or text.
  function dragTuneLabels(sel, ns='dlabel'){
    if (params.get('tune') !== '1') return
    var items = []
    ;(sel || d3.select('body')).selectAll('text.dlabel').each(function(){
      var el = d3.select(this), key = (this.dataset.series || el.text()).replace(/\W+/g, '_').slice(0, 24)
      items.push({sel: el, key,
        get: () => ({x: +el.attr('x') || 0, y: +el.attr('y') || 0}),
        set: p => el.at({x: p.x, y: p.y})})
    })
    dragTune(items, ns)
  }

  // ───── misc ─────
  function throttle(fn, delay){
    var last = 0
    return (...a) => { if (Date.now() - last < delay) return; last = Date.now(); fn(...a) }
  }
  function debounce(fn, delay){
    var t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay) }
  }
  function throttleDebounce(fn, delay){
    var last = 0, t
    return function(...a){
      clearTimeout(t)
      var rem = delay - (Date.now() - last)
      if (rem <= 0){ last = Date.now(); fn.apply(this, a) }
      else t = setTimeout(() => { last = Date.now(); fn.apply(this, a) }, rem)
    }
  }
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)) }
  function cache(fn){
    var c = {}
    return function(...a){ var k = JSON.stringify(a); if (!(k in c)) c[k] = fn.apply(this, a); return c[k] }
  }
  // per-panel caption (.psub). First call per figure gets the "Figure N: " prefix.
  function panelCaption(sel, opts, text){
    var n = opts._pc = (opts._pc || 0) + 1
    var div = sel.append('div.psub')
    if (n == 1 && opts.figNum) div.append('span.fig-num').text(`Figure ${opts.figNum}: `)
    div.append('span').html(text)
    return div
  }
  // Wrap occurrences of each word in the figure's <figcaption> with a colored
  // span so caption text visually keys to series colors in the chart.
  // replacements: {word: '#hex' | 'var(--x)' | 'css-class' | {bg: '#hex', color?: '#hex'}}.
  // {bg:} sets a background highlight instead of foreground — use when the
  // series color is gray-ish and would vanish against the caption text color.
  // Case-insensitive whole-word; warns on miss.
  function colorCaption(figSel, replacements){
    var cap = (figSel.node?.() || figSel)?.closest('figure')?.querySelector('figcaption')
    if (!cap) return
    Object.entries(replacements).forEach(([word, val]) => {
      var re = new RegExp('(?<![\\w-])' + word + '(?![\\w-])', 'gi'), found = false
      var isObj = val && typeof val == 'object'
      var firstOnly = isObj && val.firstOnly
      var isColor = !isObj && /^(#|rgb|hsl|var\()/i.test(val)
      var style = s => isObj ? (s.style.cssText = `background:${val.bg};border-radius:2px;padding:0 2px` + (val.color ? `;color:${val.color}` : ''))
                     : isColor ? (s.style.color = val) : (s.className = val)
      var reFull = new RegExp('^' + word + '$', 'i')
      ;(function walk(n){
        for (var c of [...n.childNodes]){
          if (firstOnly && found) return
          if (c.nodeType == 1) {
            // if a wrapper span's entire text is the word, replace the wrapper
            // itself so the new class doesn't nest inside the chip styling.
            if (c.tagName == 'SPAN' && !c.children.length && reFull.test(c.textContent.trim())){
              found = true
              var s = document.createElement('span'); s.textContent = c.textContent
              style(s); c.replaceWith(s); continue
            }
            walk(c); continue
          }
          if (c.nodeType != 3) continue
          var txt = c.data, m, last = 0, out = []
          re.lastIndex = 0
          while ((m = re.exec(txt))){
            found = true
            if (m.index > last) out.push(txt.slice(last, m.index))
            var s = document.createElement('span'); s.textContent = m[0]
            style(s); out.push(s); last = re.lastIndex
            if (firstOnly) break
          }
          if (last) { if (last < txt.length) out.push(txt.slice(last)); c.replaceWith(...out) }
        }
      })(cap)
      if (!found) console.warn(`[colorCaption] no match for "${word}" in figcaption`)
    })
  }
  function resolveFigRefs(){
    document.querySelectorAll('a.fig-ref').forEach(a => {
      var ref = a.dataset.ref ?? a.hash.slice(5)
      var fignum = document.getElementById('fig-' + ref)?.dataset.fignum
      if (fignum != null) { a.textContent = fignum; return }
      var sec = window.__secNum?.[ref]
      if (sec != null) { a.textContent = '§' + sec; a.setAttribute('href', '#' + ref); return }
      a.textContent = '??'
    })
  }

  function ppToken(s, keepNl){
    if (s == null) return ''
    var out = String(s)
      .replaceAll(/\u25b2[\u00b7\u237d\u205f]*(\p{L})/gu, (_, c) => c.toUpperCase())
      .replaceAll(/\u2191[\u00b7\u237d\u205f]*(\p{L})/gu, (_, c) => c.toUpperCase())
      .replaceAll(/\u21ea[\u00b7\u237d\u205f]*(\p{L}+)/gu, (_, w) => w.toUpperCase())
      .replaceAll(/[\u25b2\u2191\u21ea]/gu, '')
      .replaceAll(/[\u237d\u2028\u205f\u00b7]/gu, ' ')
    return keepNl ? out : out.replaceAll('\n', '\u23ce')
  }

  // ranks above the cap are not informative
  function ppRank(r, cap=999){ return r >= cap ? cap + '+' : r }

  // ppToken for cell/chip display: spaces visible, never empty
  function ppCell(s){
    var t = ppToken(s)
    return t.trim() ? t : t.replaceAll(' ', '\u2423').replaceAll('\u23ce', '\u23ce') || '\u2205'
  }

  // ───── lens-slice shared (lens-slice + lens-inline) ─────
  // {slug}.json: {slug, title, ctxTokens:[str], n_layers, default_ctx}
  // {slug}.parquet: rows of {layer, ctx, rank, str, prob} \u2014 long format, rank 0 = argmax
  async function loadLensSlice(base, slug){
    var [d, rows] = await Promise.all([getFile(base + slug + '.json'), getFile(base + slug + '.parquet')])
    d.layers = d.layers || d3.range(d.n_layers)
    d.nCtx = d.ctxTokens.length
    var by = d3.group(rows, r => r.layer, r => r.ctx)
    d.cell = (ctx, layer) => by.get(layer)?.get(ctx) || []
    d.argmax = (ctx, layer) => d.cell(ctx, layer)[0]?.str
    d.probOf = (ctx, layer, str) => (d.cell(ctx, layer).find(e => e.str === str)?.prob) || 0
    var rankBy = {}
    d.rankOf = (ctx, layer, str) => {
      var m = rankBy[str]
      if (m) return (m.get(layer)?.get(ctx)?.[0]?.rank ?? -1) + 1 || null
      var e = d.cell(ctx, layer).find(e => e.str === str)
      return e ? e.rank + 1 : null
    }
    // Per-token rank trajectory; no-op when the slug ships without rankFiles
    // (lens-inline) so callers don't have to check.
    d.loadRanks = async (str) => {
      if (rankBy[str] || d.rankFiles?.[str] == null) return
      var rr = await getFile(base + slug + '_ranks/' + d.rankFiles[str] + '.parquet')
      rankBy[str] = d3.group(rr, r => r.layer, r => r.ctx)
    }
    return d
  }

  function pinnedStyle(color){
    if (!color) return ''
    return `background:${color}20;text-decoration:underline 2px ${color};text-underline-offset:2px`
  }

  // clickable prompt-token paragraph; returns the span selection
  function appendPromptPara(sel, ctxTokens, {keepNl=true}={}){
    return sel.appendMany('span.ptok', d3.range(ctxTokens.length))
      .each(function(i){
        var s = ppToken(ctxTokens[i], keepNl)
        d3.select(this).text(s).classed('empty', !s)
      })
  }

  // one row of lens top-k chips, fixed-k so hover never reflows
  function appendLensTopk(sel, items, k=10){
    return sel.appendMany('span.lenstk', d3.range(k))
      .each(function(i){
        var it = items[i]
        d3.select(this).text(it ? ppCell(it.str) : '\u00a0')
          .at({title: it ? ppCell(it.str) : null}).datum(it).classed('empty', !it)
      })
  }

  // Scale a figure mount down when its natural width overflows the <figure>
  // container. Works for SVG and div-based charts alike. Stacking via
  // .panel-row/.figgrid is the first defense; this catches fixed-width
  // d3.conventions output and any intermediate-width overflow (768\u20131100px).
  function fitMount(mount){
    var fig = mount.closest('figure')
    if (!fig) return
    // measure natural size with any prior scale/fit removed — fit-scaled's
    // explicit width changes what container queries inside the mount resolve to.
    // width:fit-content during the measure makes --mount-w track the rendered
    // content (so figcaption max-width matches it), not the column the block
    // mount happens to fill. Skip container-typed mounts: intrinsic sizing
    // collapses them to 0.
    var prev = mount.style.transform, prevW = mount.style.width
    var prevH = mount.style.height, prevM = mount.style.marginLeft
    var prevC = mount.classList.contains('fit-scaled')
    mount.style.transform = 'none'
    mount.classList.remove('fit-scaled')
    // height/margin-left are fit outputs too — measuring with a stale clamp
    // from the previous run makes consecutive measurements state-dependent.
    mount.style.height = ''
    mount.style.marginLeft = ''
    if (getComputedStyle(mount).containerType == 'normal') mount.style.width = 'fit-content'
    var natural = mount.scrollWidth
    var naturalH = mount.scrollHeight
    mount.style.width = prevW
    // available space is the figure's content box, not clientWidth — the
    // figure-render gallery card has 14px horizontal padding, and a scale
    // computed against clientWidth leaves ~28px of overflow that the card's
    // overflow-x:auto fallback turns into a scrollbar. (Paper figures have no
    // padding, so this is a no-op there.)
    var cs = getComputedStyle(fig)
    var avail = fig.clientWidth
      - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
    var restore = () => {
      mount.style.transform = prev
      mount.style.height = prevH
      mount.style.marginLeft = prevM
      if (prevC) mount.classList.add('fit-scaled')
    }
    if (!natural || !avail) { restore(); return }
    // Idempotence guard: this runs under a ResizeObserver watching the very
    // <figure> the writes below resize, so re-applying on ≤1px measurement
    // noise (integer scrollWidth vs fractional clientWidth) feeds back into
    // an endless remeasure loop at fit-boundary widths. If the inputs moved
    // ≤1px and the verdict is unchanged, keep the prior state untouched.
    var f0 = mount.__fit, fits = natural <= avail
    if (f0 && fits == f0.fits && Math.abs(natural - f0.natural) <= 1
        && Math.abs(avail - f0.avail) <= 1 && Math.abs(naturalH - f0.naturalH) <= 1){
      restore(); return
    }
    mount.__fit = {natural, naturalH, avail, fits}
    fig.style.setProperty('--mount-w', natural + 'px')
    if (natural <= avail){
      mount.style.transform = ''
      mount.style.height = ''
      mount.style.marginLeft = ''
      fig.style.overflowX = ''
      mount.classList.remove('fit-scaled')
      return
    }
    var min = +mount.dataset.minScale || 0
    var s = Math.max(avail / natural, min)
    mount.classList.add('fit-scaled')
    mount.style.transform = `scale(${s})`
    // collapse the dead vertical space the transform leaves behind
    mount.style.height = (naturalH * s) + 'px'
    // center the visual box — transform-origin is top-left and several figure
    // mounts set max-width:100% (overriding .fit-scaled's max-width:none), so
    // the layout box can resolve narrower than `natural`; scale then leaves a
    // gap on the right. Read the actual box width and offset so the scaled
    // visual sits mid-figure regardless of which width won.
    var ow = mount.offsetWidth
    mount.style.marginLeft = Math.max(0, (avail - ow * s) / 2) + 'px'
    // floored scale still overflows: let the <figure> h-scroll instead of clipping
    fig.style.overflowX = natural * s > avail + 1 ? 'auto' : ''
  }

  // Shared sliver schematic for intro-structural + layer-diagram: body box,
  // residual column, manilla J-space band (same width as the sliver), and the
  // right-side "J-space" label with a double-arrow spanning the full column.
  function drawJSliver(svg, {bx0, bx1, H, capH=26, pad=14, jFrac=[0.20, 0.74], arrowId}){
    var jEdge = d3.color(brand.kraft).darker(0.5).formatHex()
    var cx = (bx0 + bx1)/2, bw = bx1 - bx0, gap = 8
    var by0 = capH + gap, by1 = H - capH - gap
    var rTop = by0 + pad, rBot = by1 - pad
    var jTop = rTop + (rBot - rTop)*jFrac[0], jBot = rTop + (rBot - rTop)*jFrac[1]
    var rr = (x, y, w, h, r, a) => svg.append('rect').at({x, y, width: w, height: h, rx: r, ry: r, ...a})
    svg.append('defs').append('marker').at({id: arrowId, viewBox: '0 0 10 10', refX: 8, refY: 5,
      markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'})
      .append('path').at({d: 'M1,1 L8,5 L1,9', fill: 'none', stroke: gray[400],
        strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round'})
    rr(bx0, 0, bw, capH, 4, {fill: gray[100], stroke: gray[200], strokeWidth: 1})
    rr(bx0, H - capH, bw, capH, 4, {fill: gray[100], stroke: gray[200], strokeWidth: 1})
    svg.append('text.io').text('Output').translate([cx, capH/2]).at({textAnchor: 'middle', dy: '.35em'})
    svg.append('text.io').text('Input').translate([cx, H - capH/2]).at({textAnchor: 'middle', dy: '.35em'})
    rr(bx0, by0, bw, by1 - by0, 12, {fill: gray[100], stroke: gray[300], strokeWidth: 1})
    rr(cx - 7, rTop, 14, rBot - rTop, 7, {fill: gray[300], opacity: .65})
    rr(cx - 7, jTop, 14, jBot - jTop, 4, {fill: brand.manilla})
    rr(cx - 7, jTop, 14, jBot - jTop, 4, {fill: 'none', stroke: jEdge, strokeWidth: 1.1, strokeDasharray: '4 3'})
    var jx = cx + 18
    svg.append('line').at({x1: jx, y1: rTop + 2, x2: jx, y2: rBot - 2,
      stroke: gray[400], strokeWidth: 1, markerStart: `url(#${arrowId})`, markerEnd: `url(#${arrowId})`})
    svg.append('text.jspace').text('J-space')
      .at({transform: `translate(${jx + 11},${(rTop + rBot)/2}) rotate(-90)`, textAnchor: 'middle'})
    return {cx, bx0, bx1, by0, by1, rTop, rBot, jTop, jBot, sliverL: cx - 7}
  }

  var __fitRO
  function fitFigures(){
    var mounts = () => document.querySelectorAll('figure > div[class]')
    mounts().forEach(fitMount)
    if (!__fitRO) __fitRO = new ResizeObserver(
      throttleDebounce(() => mounts().forEach(fitMount), 100))
    mounts().forEach(m => { var f = m.closest('figure'); if (f) __fitRO.observe(f) })
  }

  return {
    params, safeRelPath, initRenderAll, attachRenderAllHistory,
    loadParquet, cachedParquet, loadNpy, getFile,
    addAxisLabel, ggPlot, ggPlotUpdate, addWsBand, layerTicks, layerLabel, DISPLAY_LAYERS, drawJSliver,
    gray, tol, accent, brand, series, pos, neg, modelColors, lensColors, ablationColors, jspaceColors, space, tint, activationBg, barWhisker,
    directLabel, spreadLabels, bindSeriesHover, nearestHover, dragTune, dragTuneLabels,
    rankColor, lineColors, drawColorbar,
    throttle, debounce, throttleDebounce, sleep, cache, resolveFigRefs, panelCaption, colorCaption,
    ppToken, ppCell, ppRank, loadLensSlice, appendPromptPara, appendLensTopk, pinnedStyle,
    rankColorCapped, fitMount, fitFigures,
  }
})()

window.init?.()

// ─── public/intro-functional/init-intro-functional.js ───
// Figure 1 — five functional properties of a global workspace.
// Pure illustration: hardcoded content, no data fetch.
window.initIntroFunctional = function(opts){
  var sel = d3.select(opts?.sel || '.intro-functional').html('')

  var arr = `<span class='if-arr'>→</span>`
  var cards = [
    {
      letter: 'A', title: 'Verbal report',
      q: '“What are you thinking about?”',
      op: 'swap',
      thought: {kind: 'swap', from: 'banana', to: 'elephant'},
      out: {kind: 'lines', from: '…about a banana.', to: '…about an elephant.'},
    },
    {
      letter: 'B', title: 'Directed modulation',
      q: 'Compute 3² − 2 while writing<br>“The old painting hung…”',
      op: null,
      thought: {kind: 'chain', steps: ['math', 'calc', 'nine', 'seven', 'equals']},
      out: {kind: 'plain', text: 'The old painting hung crookedly on the wall.'},
    },
    {
      letter: 'C', title: 'Internal reasoning',
      q: '“What color is the planet fourth from the sun?”',
      op: 'swap',
      thought: {kind: 'swap', from: 'Mars', to: 'Earth'},
      out: {kind: 'lines', from: 'red', to: 'blue'},
    },
    {
      letter: 'D', title: 'Flexible generalization',
      q: '“What is the capital of France?”',
      op: 'swap',
      thought: {kind: 'swap', from: 'France', to: 'China'},
      out: {kind: 'table', rows: [
        ['capital', 'Paris', 'Beijing'],
        ['language', 'French', 'Chinese'],
        ['continent', 'Europe', 'Asia'],
        ['currency', 'Euro', 'Yuan'],
      ]},
    },
    {
      letter: 'E', title: 'Selectivity',
      q: '<em>(a battery of tasks)</em>',
      op: 'ablate',
      thought: {kind: 'ablate', text: 'task plan step<br>reason answer'},
      out: {kind: 'check', title: 'Doable without workspace', rows: [
        ['parse inputs', true],
        ['recall facts', true],
        ['speak fluently', true],
        ['reason internally', false],
        ['make complex inferences', false],
      ]},
    },
  ]

  var rows = [sel.append('div.if-row.if-row-3'), sel.append('div.if-row.if-row-2')]
  cards.forEach((d, i) => {
    var cell = rows[i < 3 ? 0 : 1].append('div.if-cell')
    cell.append('div.if-hdr.fig-title').text(d.title)
    var card = cell.append('div.card.light.if-card')
    card.append('div.if-q.prompt-block').html(d.q)

    var tw = card.append('div.if-mid').append('div.if-thoughtwrap')
    if (d.op) tw.append('div.if-op.mlabel').text(d.op)
    var th = tw.append('div.if-thought').classed('if-thought-ablated', d.thought.kind == 'ablate')
    if (d.thought.kind == 'swap'){
      th.append('div.if-from').text(d.thought.from)
      th.append('div.if-to').text(d.thought.to)
    } else if (d.thought.kind == 'chain'){
      th.classed('if-thought-chain', true)
      // meandering chain: tokens at irregular y, curvy connectors with arrowheads
      var svg = th.append('svg.if-chain-svg')
      svg.append('defs').html(
        `<marker id='if-arrhead' viewBox='0 0 6 6' refX='5' refY='3' ` +
        `markerWidth='5' markerHeight='5' orient='auto'>` +
        `<path d='M0,0 L6,3 L0,6' fill='none' stroke='var(--text-faint)' stroke-width='1'/></marker>`)
      var xs = [14, 53, 94, 138, 186], ys = [30, 8, 38, 11, 33]
      var bend = [-8, 7, -9, 6]
      // half-word-width + 2px gap so arrow tail/head clear the text on both ends
      var hw = d.thought.steps.map(s => s.length * 3.3 + 2)
      var arrD = j => {
        var x0 = xs[j] + hw[j], y0 = ys[j] - 4, x1 = xs[j+1] - hw[j+1], y1 = ys[j+1] - 4
        var mx = (x0 + x1)/2, my = (y0 + y1)/2 + bend[j]
        return `M${x0},${y0} Q${mx},${my} ${x1},${y1}`
      }
      var toks = svg.appendMany('text.if-chain-tok', d.thought.steps)
        .at({x: (_, j) => xs[j], y: (_, j) => ys[j], textAnchor: 'middle'}).text(String)
      var arrs = svg.appendMany('path.if-chain-arr', d3.range(d.thought.steps.length - 1))
        .at({markerEnd: 'url(#if-arrhead)', d: arrD})
      util.dragTune(toks.nodes().map((n, j) => ({
        sel: n, key: d.thought.steps[j],
        get: () => ({x: xs[j], y: ys[j]}),
        set: p => { xs[j] = p.x; ys[j] = p.y; d3.select(n).at({x: p.x, y: p.y}); arrs.at({d: arrD}) },
      })), 'chain')
    } else if (d.thought.kind == 'ablate'){
      th.append('div.if-from').html(d.thought.text)
    }
    // Clawd left of the speech bubble; thought-bubble tail circles drop from
    // .if-thoughtwrap's bottom-left down to his head.
    var bot = card.append('div.if-bottom')
    bot.append('div.if-robot').html(
      `<svg width="32" height="25" viewBox="0 0 66 52" xmlns="http://www.w3.org/2000/svg">` +
      `<path fill="var(--brand-clay)" d="M60 13H66V26H60V52H54V39H48V52H42V39H24V52H18V39H12V52H6V26H0V13H6V0H60V13Z"/>` +
      `<rect x="12" y="13" width="6" height="6" fill="var(--gray-900)"/>` +
      `<rect x="48" y="13" width="6" height="6" fill="var(--gray-900)"/>` +
      `</svg>`)

    var out = bot.append('div.if-out')
    var role = `<span class='prompt-role'>Assistant:</span> `
    if (d.out.kind == 'lines'){
      out.html(`${role}<span class='if-out-from'>${d.out.from}</span> ` +
               `<span class='if-out-to'>${d.out.to}</span>`)
    } else if (d.out.kind == 'plain'){
      out.html(`${role}${d.out.text}`)
    } else if (d.out.kind == 'table'){
      out.append('div.if-ttable').appendMany('div.if-trow', d.out.rows).html(r =>
        `<span class='if-tk'>${r[0]}</span>${arr}` +
        `<span class='if-out-from'>${r[1]}</span>` +
        `<span class='if-out-to'>${r[2]}</span>`)
    } else if (d.out.kind == 'check'){
      if (d.out.title) out.append('div.if-ctitle').text(d.out.title)
      var cols = out.append('div.if-ccols')
      ;[true, false].forEach(ok => cols.append('div.if-ccol')
        .appendMany('div.if-crow', d.out.rows.filter(r => r[1] == ok)).html(r =>
          `<span class='if-cmark ${r[1] ? 'ok' : 'nope'}'>${r[1] ? '✓' : '✗'}</span>` +
          `<span class='if-ctxt'>${r[0]}</span>`))
    }
  })
}

window.init?.()

// ─── public/intro-structural/init-intro-structural.js ───
window.initIntroStructural = function(opts={}){
  var sel = d3.select('.intro-structural').html('')
  if (!sel.size()) return

  // Visual vocab: paper shared styles. Gray ramp for structure; brand-manilla
  // marks the J-space (same color as `.ws-band` on the line charts) so the
  // reader recognizes "this is the workspace" everywhere it appears.
  var gray     = util.gray
  var manilla  = util.brand.manilla
  var jBand    = manilla
  var jEdge    = d3.color(util.brand.kraft).darker(0.5).formatHex()
  var jDot     = d3.color(util.brand.kraft).darker(0.45).formatHex()
  var soft     = gray[100]            // var(--bg-soft)
  var softEdge = gray[300]

  function rrect(g, x, y, w, h, r, attrs){
    return g.append('rect').at({x, y, width: w, height: h, rx: r, ry: r, ...attrs})
  }
  function brace(g, x, y0, y1, bw){
    // `{` opening right — curl ends on the box edge, point sticks left toward text.
    var ym = (y0 + y1) / 2
    g.append('path.brace').at({fill: 'none', stroke: gray[400], d:
      `M ${x+bw},${y0} Q ${x},${y0} ${x},${y0+bw} V ${ym-bw}` +
      ` Q ${x},${ym} ${x-bw},${ym} Q ${x},${ym} ${x},${ym+bw}` +
      ` V ${y1-bw} Q ${x},${y1} ${x+bw},${y1}`
    })
  }

  var diag   = sel.append('div.is-diagram')
  var panels = sel.append('div.is-panels')

  // ───── left: vertical layer diagram ─────
  drawLayerDiagram(diag)
  function drawLayerDiagram(host){
    var W = 360, H = 580
    var svg = host.append('svg').at({width: W, height: H, viewBox: `0 0 ${W} ${H}`})

    var g = util.drawJSliver(svg, {bx0: 124, bx1: 252, H, capH: 28, pad: 16, arrowId: 'is-arrow'})
    var {cx, bx0, bx1, rTop, rBot, jTop, jBot, sliverL} = g

    // left annotations — motor/sensory outside, workspace inside w/ dashed leader
    var bwBrace = 8, tip = 3
    var bxBrace = bx0 - bwBrace - tip, txtX = bxBrace - bwBrace - 8
    function annoText(ym, lines){
      var ty0 = ym - (lines.length - 1) * 8
      var txt = svg.append('text').at({textAnchor: 'end', x: txtX})
      lines.forEach((t, i) => txt.append(i === 0 ? 'tspan.anno-key' : 'tspan.anno-sub')
        .text(t).at({x: txtX, y: ty0 + i*16, dy: '.35em'}))
    }
    ;[{y0: rTop, y1: jTop, key: 'Motor', sub: ['determining', 'the output']},
      {y0: jBot, y1: rBot, key: 'Sensory', sub: ['input parsing,', 'preprocessing']}]
      .forEach(a => {
        brace(svg, bxBrace, a.y0 + tip, a.y1 - tip, bwBrace)
        annoText((a.y0 + a.y1)/2, [a.key, ...a.sub])
      })
    var wym = (jTop + jBot) / 2, ibx = sliverL - bwBrace - tip
    brace(svg, ibx, jTop + tip, jBot - tip, bwBrace)
    svg.append('line').at({x1: ibx - bwBrace, y1: wym, x2: txtX + 4, y2: wym,
      stroke: gray[400], strokeWidth: 1, strokeDasharray: '3 3'})
    annoText(wym, ['Workspace', 'lives here'])

    // right: layer arcs (residual skip-connections, bottom → top)
    var nArc = 8, ax = bx1 + 4, span = (rBot - rTop) / nArc, bulge = span * 1.45, arcGap = 9
    d3.range(nArc).forEach(i => {
      var yb = rTop + (i + 1) * span - arcGap/2, yt = rTop + i * span + arcGap/2
      svg.append('path.layer-arc').at({
        d: `M ${ax},${yb} C ${ax + bulge},${yb} ${ax + bulge},${yt} ${ax + 1},${yt + 1}`,
        fill: 'none', stroke: gray[400], markerEnd: 'url(#is-arrow)',
      })
    })
    svg.append('text.layers-lbl').text('Layers')
      .at({x: ax + bulge*0.78 + 2, y: (rTop + rBot)/2, dy: '.35em'})
  }

  // ───── right: panels ─────
  function panel(title, desc){
    var c = panels.append('div.card')
    c.append('div.fig-title').text(title)
    c.append('div.desc').text(desc)
    return c
  }

  panel('Intermediate processing stage',
    'J-space carries workspace-like content only at intermediate depths')

  var pB = panel('Limited capacity',
    'Few concepts active at once; minority of activation variance; most features lie outside it')
  drawCapacityIllo(pB.append('div.illo'))

  var pC = panel('Broadcast format',
    'J-lens vectors compose with many upstream output weights and downstream input weights')
  drawBroadcastIllo(pC.append('div.illo'))

  // ───── B: J-space as a small dashed sub-box inside one shared container ─────
  function drawCapacityIllo(host){
    var W = 380, H = 102, bH = 72
    var svg = host.append('svg').at({viewBox: `0 0 ${W} ${H}`}).st({maxWidth: W + 'px'})
    var pad = 8, sw = 72

    function scatter(x0, y0, w, h, nx, ny, jit, seed){
      var rng = d3.randomLcg(seed), cw = w/nx, ch = h/ny, pts = []
      d3.range(nx*ny).forEach(k => {
        var i = k % nx, j = (k - i)/nx
        pts.push([x0 + (i + .5 + (rng() - .5)*jit)*cw,
                  y0 + (j + .5 + (rng() - .5)*jit)*ch])
      })
      return pts
    }

    // shared outer container
    rrect(svg, 0, 0, W, bH, 4, {fill: soft, stroke: softEdge, strokeWidth: 1})
    svg.appendMany('circle', scatter(pad + sw + 10, 8, W - pad - sw - 20, bH - 16, 17, 4, 1.1, 53))
      .at({cx: d => d[0], cy: d => d[1], r: 2.6, fill: gray[400]})
    // J-space dashed sub-box inset on the left
    rrect(svg, pad, pad, sw, bH - 2*pad, 4, {fill: jBand})
    svg.appendMany('circle', scatter(pad + 7, pad + 7, sw - 14, bH - 2*pad - 14, 5, 3, 1.1, 11))
      .at({cx: d => d[0], cy: d => d[1], r: 3, fill: jDot})
    rrect(svg, pad, pad, sw, bH - 2*pad, 4, {fill: 'none', stroke: jEdge, strokeWidth: 1.1, strokeDasharray: '4 3'})

    svg.append('text.illo-key').text('J-space').at({x: pad + sw/2, y: bH + 20, textAnchor: 'middle'})
    svg.append('text').text('Other representational features')
      .at({x: pad + sw + (W - pad - sw)/2, y: bH + 20, textAnchor: 'middle'})
  }

  // ───── C: fan-in / fan-out broadcast hub ─────
  function drawBroadcastIllo(host){
    var W = 420, H = 158
    var svg = host.append('svg').at({viewBox: `0 0 ${W} ${H}`}).st({maxWidth: W + 'px'})
    svg.append('defs').html(
      `<marker id='is-arrow-o' viewBox='0 0 10 10' refX='7' refY='5' markerWidth='5.5' markerHeight='5.5' orient='auto'>` +
      `<path d='M1,1 L8,5 L1,9' fill='none' stroke='${gray[500]}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></marker>`
    )

    var n = 5, bw = 76, bh = 20, vgap = 6
    var spanH = n * bh + (n - 1) * vgap, y0 = 4
    var hx = W/2 - 32, hw = 64, hh = 36, hy = y0 + spanH/2 - hh/2
    var rx = W - bw

    d3.range(n).forEach(i => {
      var by = y0 + i * (bh + vgap), cy = by + bh/2
      var ht = hy + 5 + (hh - 10) * i/(n - 1)
      rrect(svg, 0, by, bw, bh, 4, {fill: soft, stroke: softEdge, strokeWidth: 1})
      rrect(svg, rx, by, bw, bh, 4, {fill: soft, stroke: softEdge, strokeWidth: 1})
      svg.append('line').at({x1: bw + 2, y1: cy, x2: hx - 4, y2: ht,
        stroke: gray[500], strokeWidth: 1, markerEnd: 'url(#is-arrow-o)'})
      svg.append('line').at({x1: hx + hw + 2, y1: ht, x2: rx - 6, y2: cy,
        stroke: gray[500], strokeWidth: 1, markerEnd: 'url(#is-arrow-o)'})
    })
    rrect(svg, hx, hy, hw, hh, 4, {fill: jBand})
    rrect(svg, hx, hy, hw, hh, 4, {fill: 'none', stroke: jEdge, strokeWidth: 1.1, strokeDasharray: '4 3'})

    svg.append('text.illo-key').text('Upstream').at({x: bw/2, y: y0 + spanH + 16, textAnchor: 'middle'})
    svg.append('text.illo-key').text('circuits').at({x: bw/2, y: y0 + spanH + 30, textAnchor: 'middle'})
    svg.append('text.illo-key').text('Downstream').at({x: rx + bw/2, y: y0 + spanH + 16, textAnchor: 'middle'})
    svg.append('text.illo-key').text('circuits').at({x: rx + bw/2, y: y0 + spanH + 30, textAnchor: 'middle'})
  }
}

window.init?.()

// ─── public/ooo-heatmap/init-ooo-heatmap.js ───
// Canvas heatmap: number_tokens (x-axis) × layers (y-axis), colored by log10(rank).
// Wide-format rows: each row is one (x, layer) with token strings as columns.
window.initOooHeatmap = function({visState, renderAll, sel, cfg, byX}){
  var tokens = cfg.number_tokens
  var layers = cfg.layers || d3.range(cfg.n_layers)
  var nLayers = layers.length
  var rowOf = new Map(layers.map((l, i) => [l, i]))
  var cellW = tokens.length > 220 ? 2 : 3
  var w = tokens.length * cellW, h = 140
  var margin = {top: 14, right: 10, bottom: 24, left: 42}

  var c = d3.conventions({sel, width: w, height: h, margin, layers: 'scs'})
  var ctx = c.layers[1]
  var svg = c.layers[2]

  var cellH = c.height / nLayers

  c.x.domain([-0.5, tokens.length - 0.5])
  c.y.domain([-0.5, nLayers - 0.5])
  c.xAxis.ticks(8).tickFormat(i => `"${util.ppToken(tokens[Math.round(i)])}"`).tickSizeOuter(0).tickSizeInner(4)
  // y-axis ticks at evenly-spaced row indices so they line up with the cell rects.
  var tickRows = d3.ticks(0, nLayers - 1, 4).map(Math.round)
  c.yAxis.tickValues(tickRows).tickFormat(i => util.layerLabel(layers[i])).tickSizeOuter(0).tickSizeInner(4)
  c.drawAxis()
  util.addAxisLabel(c, 'Token →', 'Layer (reindexed) →')

  var nLabels = cfg.line_labels.length
  var markG = svg.append('g.value-marks')

  function drawMarks(){
    var xi = cfg.xs.indexOf(visState.x)
    var vals = cfg.line_vals_per_x?.[xi] || []
    var marks = cfg.line_labels.map((lbl, j) => {
      var ti = tokens.indexOf(String(vals[j]))
      return ti < 0 ? null : {ti, color: (cfg.colors || util.lineColors)[(nLabels-1-j) % (cfg.colors || util.lineColors).length]}
    }).filter(Boolean)
    var s = markG.selectAll('path').data(marks)
    s.enter().append('path').merge(s)
      .at({d: d => `M${d.ti*cellW + cellW/2},-2 l-4,-7 l8,0 z`, fill: d => d.color, stroke: '#fff', strokeWidth: 0.5})
    s.exit().remove()
  }
  renderAll.x.fns.push(drawMarks)

  var hoverRect = svg.append('rect').at({width: c.width, height: c.height, fill: 'transparent'})
  var dot = svg.append('circle').at({r: 3, fill: 'none', stroke: '#f0f', strokeWidth: 1, opacity: 0, pointerEvents: 'none'})
  var ttSel = d3.select('.tooltip')

  var currentRows = []  // [n_layers] rows for current x, indexed by layer

  hoverRect
    .on('mousemove', function(e){
      var [mx, my] = d3.pointer(e)
      var ti = Math.floor(mx / cellW)
      var ri = nLayers - 1 - Math.floor(my / cellH)
      var inBounds = ti >= 0 && ti < tokens.length && ri >= 0 && ri < nLayers
      if (!inBounds) return hide()
      dot.at({cx: ti * cellW + cellW/2, cy: (nLayers - 1 - ri) * cellH + cellH/2, opacity: 1})
      var r = currentRows[ri]?.[tokens[ti]]
      ttSel.html(`at L${util.layerLabel(layers[ri])} "${util.ppToken(tokens[ti])}" is rank ${r != null ? util.ppRank(r, cfg.rank_cap || 9999) : '?'}`)
        .classed('tooltip-hidden', 0)
        .st({left: e.clientX + 12, top: e.clientY + 12})
    })
    .on('mouseleave', hide)
  function hide(){ dot.at({opacity: 0}); ttSel.classed('tooltip-hidden', 1) }

  function draw(){
    var rows = byX.get(visState.x) || []
    currentRows = new Array(nLayers)
    ctx.clearRect(0, 0, c.width, c.height)
    for (var r of rows){
      var ri = rowOf.get(r.layer)
      if (ri == null) continue
      currentRows[ri] = r
      var y = (nLayers - 1 - ri) * cellH
      for (var ti = 0; ti < tokens.length; ti++){
        var rank = r[tokens[ti]]
        if (!rank) continue
        ctx.fillStyle = util.rankColor(Math.log10(rank))
        ctx.fillRect(ti * cellW, y, cellW + 0.5, cellH + 0.5)
      }
    }
  }
  renderAll.x.fns.push(draw)
}

window.init?.()

// ─── public/ooo-heatmap/init-ooo-lines.js ───
// Line chart: layer → rank (log, reversed). One line per line_label (wide-format column).
window.initOooLines = function({visState, renderAll, sel, cfg, byX}){
  var nLayers = cfg.n_layers
  var labels = [...cfg.line_labels].reverse()
  var w = 320, h = 140
  var margin = {top: 14, right: 10, bottom: 24, left: 44}

  var c = d3.conventions({sel, width: w, height: h, margin})
  c.x.domain([0, nLayers - 1]).rangeRound([0, c.width])
  c.y = d3.scaleLog().domain([10000, 1]).rangeRound([c.height, 0])
  c.xAxis.tickValues(util.layerTicks(nLayers)).tickFormat(util.layerLabel)
  c.yAxis = d3.axisLeft(c.y).ticks(4, '~s').tickFormat(d => d >= 9999 ? '10k+' : d3.format('~s')(d))
  c.drawAxis()
  util.ggPlot(c)
  util.addAxisLabel(c, 'Layer (reindexed) →', cfg.yLabel || 'J-Lens rank →')

  var colors = cfg.colors || util.lineColors
  var line = d3.line().x(d => c.x(d.layer)).y(d => c.y(Math.max(1, d.rank)))

  var pathSel = c.svg.appendMany('path.line', labels)
    .at({fill: 'none', strokeWidth: 1.5, stroke: (d, i) => colors[i % colors.length]})

  var dotSel = c.svg.appendMany('g.dots', labels)
    .at({fill: (d, i) => colors[i % colors.length]})

  function draw(){
    var rows = (byX.get(visState.x) || []).slice().sort((a, b) => a.layer - b.layer)
    var xi = cfg.xs.indexOf(visState.x)
    var valStrs = cfg.line_vals_per_x?.[xi] || []  // what value each label resolves to at this x

    labels.forEach((lbl, i) => {
      var col = cfg.colFor ? cfg.colFor(lbl, xi) : lbl
      var pts = rows.map(r => ({layer: r.layer, rank: r[col]})).filter(d => d.rank > 0)
      pathSel.filter(d => d === lbl).at({d: pts.length ? line(pts) : ''})

      var g = dotSel.filter(d => d === lbl)
      var dots = g.selectAll('circle').data(pts)
      dots.enter().append('circle').at({r: 2}).merge(dots)
        .at({cx: d => c.x(d.layer), cy: d => c.y(Math.max(1, d.rank))})
        .each(function(d){ d.label = lbl; d.value = valStrs[cfg.line_labels.indexOf(lbl)] })
        .call(d3.attachTooltip, null, [
          d => `${d.label} = ${d.value}`,
          d => `at L${util.layerLabel(d.layer)} is rank ${util.ppRank(d.rank, cfg.rank_cap || 9999)}`,
        ])
      dots.exit().remove()
    })
  }
  renderAll.x.fns.push(draw)
}

window.init?.()

// ─── public/ooo-abcd/init-ooo-abcd.js ───
window.abcdState = window.abcdState || {active: 'A', val: 4}
window.abcdRedrawFns = window.abcdRedrawFns || []

// shared meta + parquet loader (both figures use the same data)
async function abcdShared(base, layerFilter){
  var fkey = layerFilter ? [...layerFilter].sort((a, b) => a - b).join(',') : ''
  if (window.__abcd?.base == base && window.__abcd?.fkey == fkey) return window.__abcd
  var meta = await util.getFile(base + 'meta.json?' + Date.now())
  if (!layerFilter && meta.layers) layerFilter = new Set(meta.layers)
  if (layerFilter){
    var ls = [...layerFilter].sort((a, b) => a - b)
    // leave cfg.n_layers at the full extent so the line chart's x-axis stays
    // 0..24; only the heatmap reads cfg.layers (compact rows).
    meta = {...meta, layers: ls,
      cfgs: Object.fromEntries(Object.entries(meta.cfgs || {}).map(([k, v]) => [k, {...v, layers: ls}]))}
  }
  var pq = {}
  async function loadVar(v, probe){
    var k = v + '/' + probe
    if (!pq[k]) pq[k] = util.loadParquet(base + `${v}/${meta.slug}/${probe}.parquet`)
      .then(rows => d3.group(layerFilter ? rows.filter(d => layerFilter.has(d.layer)) : rows, d => d.x))
    return pq[k]
  }
  return window.__abcd = {base, fkey, meta, loadVar}
}

function abcdHeader(sel, titleText, meta, colors){
  var hdr = sel.append('div.abcd-title')
  hdr.append('span.fig-title').text(titleText)
  if (!meta.vars?.length) return
  var expr = hdr.append('span.expr')
  var scrubs = {}, stacks = {}, ops = []
  ;['calc: ( ', 'A', ' + ', 'B', ' ) * ', 'C', ' + ', 'D', ' ='].forEach(part => {
    if (!meta.vars.includes(part)) return ops.push(expr.append('span.op').text(part).node())
    var v = part, [lo, hi] = meta.ranges?.[v] || [1, 10], dft = meta.defaults[v]
    var cur = v == abcdState.active ? abcdState.val : dft
    var stack = expr.append('span.scrub-stack')
    stacks[v] = stack.node()
    var num = stack.append('span.scrub').at({tabindex: 0}).datum({v, lo, hi, dft}).text(cur)
    var slider = stack.append('input').at({type: 'range', min: lo, max: hi, value: cur, step: 1, tabindex: -1})
      .on('input', function(){ setVar(v, +this.value) })
    scrubs[v] = {num, slider, lo, hi, dft}
  })

  // operand brackets under the sliders: each intermediate's span, in its line color
  function drawBrackets(){
    if (!colors || !stacks.A) return
    var er = expr.node().getBoundingClientRect()
    if (!er.width) return
    var bk = expr.selectAll('.op-brackets').data([0])
    bk = bk.enter().append('div.op-brackets').merge(bk)
    // ops[0]='calc: ( ', ops[2]=' ) * '. Innermost bracket spans the parens;
    // each outer bracket steps 3px further left so the three nest visibly.
    var ch = ops[0].getBoundingClientRect().width / ops[0].textContent.length
    var x0base = ops[0].getBoundingClientRect().right - er.left - 2 * ch  // back over '( '
    var x1paren = ops[2] ? ops[2].getBoundingClientRect().left - er.left + 2 * ch : null  // through ' )'
    var spans = [['B', x1paren], ['C'], ['D']]
      .filter(([b]) => stacks[b])
      .map(([b, x1e], i) => {
        var x0 = x0base - i * 3
        var x1 = x1e ?? (stacks[b].getBoundingClientRect().right - er.left)
        return {left: x0, width: x1 - x0, bottom: i * 4, color: colors[i % colors.length]}
      })
    var s = bk.selectAll('.op-bracket').data(spans)
    s.enter().append('div.op-bracket').merge(s)
      .st({left: d => d.left, width: d => d.width, bottom: d => d.bottom, borderColor: d => d.color})
    s.exit().remove()
  }
  abcdRedrawFns.push(drawBrackets)
  d3.select(window).on('resize.abcdBrackets', drawBrackets)
  requestAnimationFrame(drawBrackets)
  var redrawAll = util.throttleDebounce(() => abcdRedrawFns.forEach(f => f()), 60)
  function sync(){
    meta.vars.forEach(u => {
      var x = u == abcdState.active ? abcdState.val : scrubs[u].dft
      scrubs[u].num.text(x); scrubs[u].slider.node().value = x
    })
  }
  function setVar(v, val){
    var s = scrubs[v]
    val = Math.max(s.lo, Math.min(s.hi, val))
    if (abcdState.active == v && abcdState.val == val) return
    abcdState.active = v; abcdState.val = val
    redrawAll()
  }
  abcdRedrawFns.push(sync)
  var previewing = null
  function revertPreview(){
    if (!previewing) return
    var p = previewing; previewing = null
    expr.selectAll('.scrub').classed('dragging', false)
    setVar(p.active, p.val)
  }
  d3.select(window).on('keyup.abcdPreview', ev => { if (ev.key == 'Shift') revertPreview() })
  expr.selectAll('.scrub')
    .on('pointerdown', function(ev, d){
      ev.preventDefault()
      previewing = null
      var startX = ev.clientX, startVal = +this.textContent
      this.setPointerCapture(ev.pointerId)
      d3.select(this).classed('dragging', true)
        .on('pointermove', ev2 => setVar(d.v, startVal + Math.round((ev2.clientX - startX)/(ev2.shiftKey ? 8 : 2))))
        .on('pointerup pointercancel', function(ev2){
          this.releasePointerCapture(ev2.pointerId)
          d3.select(this).classed('dragging', false).on('pointermove pointerup pointercancel', null)
        })
    })
    .on('mousemove', function(ev, d){
      if (!ev.shiftKey || ev.buttons) return
      if (!previewing) previewing = {active: abcdState.active, val: abcdState.val}
      var box = this.getBoundingClientRect(), [lo, hi] = meta.ranges[d.v]
      setVar(d.v, lo + Math.round((ev.clientX - box.left)/box.width * (hi - lo)))
      d3.select(this).classed('dragging', true)
    })
    .on('mouseleave', revertPreview)
    .on('keydown', function(ev, d){
      var dx = ev.key == 'ArrowLeft' ? -1 : ev.key == 'ArrowRight' ? 1 : 0
      if (!dx) return
      ev.preventDefault()
      setVar(d.v, +this.textContent + dx * (ev.shiftKey ? 5 : 1))
    })
}

function drawProbeRow(mount, {visState, renderAll, cfg, byX, withLegend, yLabel, colors}){
  colors = colors || util.lineColors
  var hmCol = mount.append('div')
  var hmSel = hmCol.append('div.heatmap')
  var lnCol = mount.append('div')
  var lnSel = lnCol.append('div.lines')
  initOooHeatmap({visState, renderAll, sel: hmSel, cfg: {...cfg, colors}, byX})
  initOooLines({visState, renderAll, sel: lnSel, cfg: {...cfg, yLabel, colors}, byX})
  if (!withLegend) return
  util.drawColorbar(hmCol.append('div.heatmap-legend'))
  var lnLeg = lnCol.append('div.line-legend')
  var n = cfg.line_labels.length
  var legendItems = lnLeg.appendMany('div.legend-item', d3.range(n).reverse())
    .each(function(i){
      d3.select(this).append('div.legend-swatch').st({background: colors[(n-1-i) % colors.length]})
      d3.select(this).append('span.lbl').text(cfg.line_labels[i] + '=')
      d3.select(this).append('span.val')
    })
  renderAll.x.fns.push(() => {
    var xi = cfg.xs.indexOf(visState.x)
    var vals = cfg.line_vals_per_x?.[xi] || []
    legendItems.select('span.val').text(i => vals[i] ?? '?')
  })
}

window.initOooAbcd = async function(opts){
  var sel = d3.select('.ooo-abcd').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var {meta, loadVar} = await abcdShared(base, opts?.layerFilter)
  var renderAll = util.initRenderAll(['x'])
  var visState = {x: abcdState.val}

  new IntersectionObserver((es, o) => {
    if (!es.some(e => e.isIntersecting)) return
    var probes = meta.probes || ['resid']
    meta.vars.forEach(v => probes.forEach(p => loadVar(v, p)))
    o.disconnect()
  }).observe(sel.node())

  var colors = [util.gray[500], util.series[4], util.series[2]]  // warm orange/brown — distinct from each other, don't blend with viridis heatmap; match ooo-patch

  abcdRedrawFns.length = 0
  abcdHeader(sel, 'Residual-Stream J-Lens Rank', meta, colors)

  var rowMount = sel.append('div.probe-row')

  async function draw(){
    var v = abcdState.active, cfg = meta.cfgs[v]
    visState.x = abcdState.val
    renderAll.x.fns = []
    var byX = await loadVar(v, 'resid')
    rowMount.html('')
    drawProbeRow(rowMount, {visState, renderAll, cfg, byX, withLegend: true, yLabel: 'Residual-stream J-Lens rank →', colors})
    renderAll.x()
  }

  abcdRedrawFns.push(draw)
  await draw()
}

window.init?.()

// ─── public/ooo-patch/init-ooo-patch.js ───
window.initOooPatch = async function(opts){
  var sel = d3.select('.ooo-patch').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var model = opts?.state?.model || 'opus-4.5'
  var d = await util.getFile(base + model + '.json')

  sel.append('div.op-title').append('span.ttl').text('Patching intermediate values localizes to the same layers')
  var row = sel.append('div.panel-row')
  var W = 220, H = 140, M = {top: 16, right: 10, bottom: 24, left: 44}

  var allDiff = d.cols.flatMap(col => d.panels[col].diff.flat())
  var yExt = d3.extent(allDiff)
  var yPad = (yExt[1] - yExt[0]) * 0.04

  // s = [textX, textY, ax, ay, bx, by, cx, cy]  arc a→c through b, arrowhead at c
  var annos = {
    inter1: {L: 17, text: `Mean patching A+B at L${util.layerLabel(17)}\nusually flips the answer`, s: [-136,-42, -40,-22, -30,  0, -13,  0]},
    inter2: {L: 19, text: '(A+B)*C flips\n~10% later',                          s: [-140,-35, -45,-37, -23,-32, -10,-21]},
    ans:    {L: 22, text: 'and the answer itself\nin the final layers',         s: [-167, -5, -80, 14, -57, 33, -14, 12]},
  }
  var dragOn = new URLSearchParams(location.search).get('drag')

  var panelColor = {inter1: util.gray[500], inter2: util.series[4], ans: util.series[2]}  // warm orange/brown — distinct from each other, don't blend with viridis heatmap; match ooo-abcd

  d.cols.forEach((col, ci) => {
    var p = d.panels[col]
    var pc = panelColor[col]
    var cell = row.append('div.op-cell')

    var c = d3.conventions({sel: cell.append('div.op-chart'), width: W, height: H, margin: M})
    d3.select(c.svg.node().ownerSVGElement).append('defs').append('marker')
      .at({id: 'oop-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto'})
      .append('path').at({d: 'M 0 0 L 10 5 L 0 10 z', fill: '#333'})
    c.x.domain([0, d.n_layers - 1]).rangeRound([0, c.width])
    c.y.domain([yExt[0] - yPad, yExt[1] + yPad]).nice()
    c.xAxis.tickValues(util.layerTicks(d.n_layers)).tickFormat(util.layerLabel)
    c.yAxis.ticks(5)
    c.drawAxis()
    util.ggPlot(c)
    util.addAxisLabel(c, ci == 1 ? 'Layer (reindexed) →' : '', ci == 0 ? `Patched logit − "${d.orig_ans}" logit →` : '')
    c.svg.append('text.panel-title').at({x: c.width/2, y: -5, textAnchor: 'middle'}).text(p.expr)

    var line = d3.line().x((_, i) => c.x(i)).y(v => c.y(v))
    var ttSel = d3.select('.tooltip')
    var expr = p.expr

    var tgtG = c.svg.append('g')
    var paths = tgtG.appendMany('path.tgt', p.targets)
      .at({d: (_, i) => line(p.diff[i]), fill: 'none', stroke: pc, strokeWidth: 0.7, opacity: 0.25})

    var hi = -1
    c.svg.append('rect.hover')
      .at({width: c.width, height: c.height, fill: 'none', pointerEvents: 'all'})
      .on('mousemove', function(ev){
        var [mx, my] = d3.pointer(ev, c.svg.node())
        var L = d3.clamp(0, Math.round(c.x.invert(mx)), d.n_layers - 1)
        var yv = c.y.invert(my)
        var ti = d3.minIndex(p.diff, s => Math.abs(s[L] - yv))
        if (ti !== hi){
          if (hi >= 0) paths.filter((_, i) => i === hi).at({strokeWidth: 0.7, opacity: 0.25})
          paths.filter((_, i) => i === ti).raise().at({strokeWidth: 1.5, opacity: 1})
          hi = ti
        }
        var v = p.targets[ti]
        ttSel.classed('tooltip-hidden', false)
          .st({left: ev.clientX + 12, top: ev.clientY + 12})
          .html(`L${util.layerLabel(L)} · ${d3.format('+.2f')(p.diff[ti][L])}<br>${expr} = ${v} → ans ${p.new_ans[v]}`)
      })
      .on('mouseleave', function(){
        if (hi >= 0) paths.filter((_, i) => i === hi).at({strokeWidth: 0.7, opacity: 0.25})
        hi = -1
        ttSel.classed('tooltip-hidden', true)
      })

    var a = annos[col]
    if (a) drawSwoopy(c, c.x(a.L), c.y(p.mean[a.L]), a, col)
  })

  if (!d3.select('.tooltip').size()) d3.select('body').append('div.tooltip.tooltip-hidden')

  function drawSwoopy(c, tx, ty, a, key){
    var s = a.s
    var g = c.svg.append('g.anno').translate([tx, ty])
    var path = g.append('path').at({stroke: '#000', fill: 'none', strokeWidth: 1, 'marker-end': 'url(#oop-arrow)'})
    var text = g.append('text').at({fontSize: 12, fill: '#000'})
    a.text.split('\n').forEach((ln, i) => text.append('tspan').at({x: 0, dy: i ? 12 : 0}).text(ln))
    function render(){
      text.translate([s[0], s[1]])
      path.at({d: arcThrough([s[2],s[3]], [s[4],s[5]], [s[6],s[7]])})
    }
    render()
    if (!dragOn) return
    g.appendMany('circle.drag-handle', [[0,1],[2,3],[4,5],[6,7]])
      .at({r: 7, fill: 'rgba(0,0,0,0)', stroke: '#333', strokeDasharray: '2 2', cursor: 'move'})
      .translate(d => [s[d[0]], s[d[1]]])
      .call(d3.drag()
        .subject((e,d) => ({x: s[d[0]], y: s[d[1]]}))
        .on('drag', function(e, d){
          s[d[0]] = Math.round(e.x); s[d[1]] = Math.round(e.y)
          d3.select(this).translate([s[d[0]], s[d[1]]])
          render()
          console.log(Object.entries(annos).map(([k,v]) => `    ${k}: {L: ${v.L}, text: ${JSON.stringify(v.text)}, s: [${v.s.join(',')}]},`).join('\n'))
        }))
  }
  function dist(a,b){ return Math.hypot(a[0]-b[0], a[1]-b[1]) }
  function arcThrough(a, b, c){
    var A=dist(c,b), B=dist(b,a), C=dist(a,c)
    var ang = Math.acos((A*A + B*B - C*C)/(2*A*B))
    var K = .5*A*B*Math.sin(ang)
    if (!K) return 'M'+a+' L'+c
    var r = Math.round(A*B*C/4/K*1000)/1000
    var laf = +(Math.PI/2 > ang), saf = +((c[0]-a[0])*(b[1]-a[1])-(c[1]-a[1])*(b[0]-a[0]) < 0)
    return ['M',a,'A',r,r,0,laf,saf,c].join(' ')
  }

}

window.init?.()

// ─── public/feature-examples/init-feature-examples.js ───
window.initFeatureExamples = async function(opts){
  var sel = d3.select('.feature-examples').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'feature_examples.json?v=' + Date.now())

  var orange = t => d3.interpolateOranges(0.1 + 0.55*t)

  d.rows.forEach(row => {
    var col = sel.append('div.fe-col')
    var head = col.append('div.fe-colhead')
    head.append('div.fig-title').text(row.label)
    head.append('div.fe-colsub').text(row.sublabel)

    col.appendMany('div.cell.fchip', row.chips).each(function(f){
      var s = d3.select(this)
      var hdr = s.append('div.fchip-head')
      hdr.append('span.fe-key').text('Label')
      hdr.append('span.clerp').text(f.clerp || '—').at({title: f.clerp || ''})
      hdr.append('span.kurt').text(`κ = ${(f.kurt - 3).toFixed(1)}`)
      var tk = s.append('div.toks')
      tk.append('span.fe-key').text('Top J-tokens')
      tk.appendMany('span.tok', f.top_tokens).text(util.ppToken)
      s.appendMany('div.exrow', f.examples)
        .at({title: ex => ex.map(t => util.ppToken(t.t)).join('')})
        .each(function(ex){
        if (!ex.length) return
        var max = d3.max(ex, t => t.a) || 1
        var pi = d3.maxIndex(ex, t => t.a)
        var row = d3.select(this)
        function paint(t){
          if (t.a <= 0.02*max) return
          var bg = orange(t.a/max)
          d3.select(this).st({background: bg, color: d3.hsl(bg).l < 0.6 ? '#fff' : null})
        }
        row.append('span.exleft').appendMany('span.t', ex.slice(0, pi))
          .text(t => util.ppToken(t.t)).each(paint)
        row.append('span.expeak').appendMany('span.t', [ex[pi]])
          .text(t => util.ppToken(t.t)).each(paint)
        row.append('span.exright').appendMany('span.t', ex.slice(pi + 1))
          .text(t => util.ppToken(t.t)).each(paint)
      })
    })
  })
}

window.init?.()

// ─── public/feature-coverage/init-feature-coverage.js ───
window.initFeatureCoverage = async function(opts){
  var sel = d3.select('.feature-coverage').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'feature_coverage.json')

  var [wlo, whi] = d.workspace_band
  var xMax = d.layers[d.layers.length - 1]
  var sBlue = util.tol.blue
  var sOrange = util.tol.orange  // SAE features in (a) — keep distinct from the blue series
  var sGray = util.gray[500]

  // direct labels: multi-line tspans + draggable via ?tune=1 (util.dragTune,
  // same pattern as modulation-lines). dx/dy printed by the tune panel map back
  // to the dx/dy passed here.
  var tuneItems = []
  var dLabel = (svg, {x, y, dx = 0, dy = 0, anchor = 'start', lines, color, key, tuneKey}) => {
    var t = svg.append('g.direct-label').translate([x, y]).append('text.dlabel')
      .at({textAnchor: anchor, 'data-series': key})
      .st({fill: color, paintOrder: 'stroke', stroke: '#EAECED', strokeWidth: 1, strokeLinejoin: 'round',  // lint-ok hex-js: ggPlot bg halo
           fontSize: 'var(--fs-label)', fontWeight: 600})
    lines.forEach((ln, li) => t.append('tspan').text(ln).at({x: 0, dy: li ? '1.15em' : 0}))
    var p = {x: dx, y: dy}
    t.translate([p.x, p.y])
    tuneItems.push({sel: t, key: tuneKey, get: () => ({...p}), set: q => { p = q; t.translate([q.x, q.y]) }})
    return t
  }

  var row = sel.append('div.panel-row')

  // panels first so flex/stack layout settles, then size every chart off the
  // measured panel width — fills the row on desktop, full width stacked on mobile
  var panels = [0, 1, 2].map(() => row.append('div.fc-panel'))
  var panelW = Math.max(240, Math.min(420, opts?._panelW || panels[0].node().clientWidth || 270))
  var pMargin = () => ({left: 48, right: 8, top: 32, bottom: 32})
  // titles centered over the full panel (not just the plot area) so the three
  // panels share one title baseline and long titles don't clip on mobile
  var panelTitle = (c, text) => c.svg.append('g.axis').translate([panelW/2 - c.margin.left, -10])
    .append('text.axis-label.axis-title').text(text).at({textAnchor: 'middle'})

  // ── (a) histogram ──────────────────────────────────────────────────
  var ch = d3.conventions({
    sel: panels[0].append('div'),
    totalWidth: panelW, height: 230,
    margin: pMargin(),
  })
  var h = d.hist
  var nz = i => h.sae[i] > 0 || h.cov[i] > 0
  var i0 = h.x.findIndex((_, i) => nz(i))
  var i1 = h.x.length - 1 - [...h.sae].reverse().findIndex(v => v > 0)
  var xs = h.x.slice(i0, i1 + 2), sae = h.sae.slice(i0, i1 + 2), cov = h.cov.slice(i0, i1 + 2)
  ch.x = d3.scaleLog().domain([xs[0] * 0.9, xs[xs.length-1] * 1.05]).range([0, ch.width])
  ch.y = d3.scaleLog().domain([1, d3.max(sae.concat(cov))]).range([ch.height, 0]).nice().clamp(true)
  var xticks = [1, 2, 3, 5, 10, 20, 30, 50, 100]
    .filter(v => v >= ch.x.domain()[0] && v <= ch.x.domain()[1])
  ch.xAxis.scale(ch.x).tickValues(xticks).tickFormat(v => '' + v)
  ch.yAxis.scale(ch.y).ticks(6, '~s')
  ch.drawAxis(); util.ggPlot(ch)
  util.addAxisLabel(ch, 'Kurtosis →', 'Feature count →')
  panelTitle(ch, `Layer ${util.layerLabel(d.hist_layer)} J-lens kurtosis`)

  var stepLine = ys => d3.line()
    .x((_,i) => ch.x(xs[i])).y(v => ch.y(Math.max(v, 0.5)))
    .curve(d3.curveStepAfter)(ys)
  ch.svg.append('path.line-series').at({d: stepLine(cov), fill: 'none', stroke: sGray, strokeWidth: 2, 'data-series': 'cov'})
  ch.svg.append('path.line-series').at({d: stepLine(sae), fill: 'none', stroke: sOrange, strokeWidth: 2, 'data-series': 'sae'})

  ch.svg.append('line.ref-line').at({
    x1: ch.x(h.thr), x2: ch.x(h.thr), y1: 0, y2: ch.height,
  })
  // hand-placed via ?tune=1 — offsets from the threshold line / each percentile dot
  var annoOff = {x: 3, y: -42}
  var anno = ch.svg.append('text.fc-anno').text(`${d.kappa_mult}× null max`)
    .at({x: ch.x(h.thr) + annoOff.x, y: ch.height - 5 + annoOff.y, textAnchor: 'start'})
  tuneItems.push({sel: anno, key: 'a-kappa-anno',
    get: () => ({...annoOff}),
    set: q => { annoOff = q; anno.at({x: ch.x(h.thr) + q.x, y: ch.height - 5 + q.y}) }})
  var pctOff = {90: {x: -19, y: 14}, 95: {x: -22, y: 12}, 99: {x: -20, y: 12}}
  h.pcts.forEach(q => {
    var x = ch.x(q.k), y = ch.y(Math.max(1, q.y))
    ch.svg.append('circle').at({cx: x, cy: y, r: 4, fill: sOrange, stroke: '#fff', strokeWidth: 1.5, 'data-series': 'sae'})
    var off = pctOff[q.p] || {x: 5, y: -6}
    var pctT = ch.svg.append('text.fc-pct').text('p' + q.p)
      .at({x: x + off.x, y: y + off.y, textAnchor: 'start'})
    tuneItems.push({sel: pctT, key: 'a-p' + q.p,
      get: () => ({...off}),
      set: qq => { off = qq; pctT.at({x: x + qq.x, y: y + qq.y}) }})
  })

  // direct labels: SAE has the long right tail; null is the sharp left peak.
  var iSae = sae.findIndex(v => v > 0 && v < 200)
  dLabel(ch.svg, {x: ch.x(xs[iSae]), y: ch.y(sae[iSae]), dx: 8, dy: -7,
    lines: ['SAE features'], color: sOrange, key: 'sae', tuneKey: 'a-sae'})
  var iCov = cov.findIndex(v => v > 0 && v < 100)
  dLabel(ch.svg, {x: ch.x(xs[iCov]), y: ch.y(cov[iCov]), dx: 156, dy: 45, anchor: 'start',
    lines: ['Random null'], color: sGray, key: 'cov', tuneKey: 'a-null'})

  // ── (b) workspace fraction lines ────────────────────────────────────
  var c = d3.conventions({
    sel: panels[1].append('div'),
    totalWidth: panelW, height: 230,
    margin: pMargin(),
  })
  var allFrac = d.lines.upper.concat(d.lines.workspace)
  c.x.domain([0, xMax])
  c.y.domain([0, d3.max(allFrac) * 1.08])
  c.xAxis.scale(c.x).tickValues(util.layerTicks(xMax + 1, 6)).tickFormat(util.layerLabel)
  c.yAxis.scale(c.y).ticks(5).tickFormat(d3.format('.0%'))
  c.drawAxis(); util.ggPlot(c)
  util.addAxisLabel(c, 'Layer (reindexed) →', 'Fraction of features →')
  panelTitle(c, 'J-space-aligned fraction by layer')

  util.addWsBand(c, wlo, whi)

  var line = d3.line().x((v,i) => c.x(d.layers[i])).y(v => c.y(v))
  var lineSpec = [
    ['upper', sGray, 1.5, [`All (κ > ${d.kappa_mult}× null max)`], {at: 16, dy: -35, dx: 16, anchor: 'end'}, 'b-all'],
    ['workspace', sBlue, 2.5, ['Excluding motor', 'features'],     {at: 22, dy:  32, dx:  3, anchor: 'end'}, 'b-excl-motor'],
  ]
  lineSpec.forEach(([k, col, sw, lab, L, tk]) => {
    var ys = d.lines[k]
    c.svg.append('path.line-series').at({d: line(ys), fill: 'none', stroke: col, strokeWidth: sw, 'data-series': k})
    c.svg.appendMany('circle', ys.map((v,i) => ({v, i})))
      .at({cx: q => c.x(d.layers[q.i]), cy: q => c.y(q.v), r: 2.2, fill: col, 'data-series': k})
    dLabel(c.svg, {x: c.x(L.at), y: c.y(ys[d.layers.indexOf(L.at)]),
      dx: L.dx ?? 0, dy: L.dy, anchor: L.anchor, lines: lab, color: col, key: k, tuneKey: tk})
  })

  // ── (c) excluding-motor fraction under three weightings ──────────────
  // dict line is identical to (b)'s blue "Excluding motor features";
  // l0/l1 re-weight by firing count / activation mass.
  var w = d.weighted
  var ct = d3.conventions({
    sel: panels[2].append('div'),
    totalWidth: panelW, height: 230,
    margin: pMargin(),
  })
  var allW = w.dict.concat(w.l0, w.l1)
  ct.x.domain([0, xMax])
  ct.y.domain([0, d3.max(allW) * 1.08])
  ct.xAxis.scale(ct.x).tickValues(util.layerTicks(xMax + 1, 6)).tickFormat(util.layerLabel)
  ct.yAxis.scale(ct.y).ticks(5).tickFormat(d3.format('.0%'))
  ct.drawAxis(); util.ggPlot(ct)
  util.addAxisLabel(ct, 'Layer (reindexed) →', 'Fraction →')
  panelTitle(ct, 'Aligned fraction, activation-weighted')
  util.addWsBand(ct, wlo, whi, {label: false})

  var lineT = d3.line().x((v,i) => ct.x(d.layers[i])).y(v => ct.y(v))
  var wSpec = [
    ['dict', sBlue,         2.5, null,  ['Excluding motor features'],    {at: 24, dy:  38, dx: -41, anchor: 'end'}, 'c-excl-motor'],
    ['l1',   util.tol.magenta, 1.8, '4,3', ['L1-weighted'],              {at: 13, dy:  -72, dx:  0, anchor: 'end'}, 'c-l1'],
    ['l0',   util.tol.teal,    1.8, '4,3', ['L0-weighted'],              {at: 23, dy:   24, dx:  5, anchor: 'end'}, 'c-l0'],
  ]
  wSpec.forEach(([k, col, sw, dash, lab, L, tk]) => {
    var ys = w[k]
    ct.svg.append('path.line-series')
      .at({d: lineT(ys), fill: 'none', stroke: col, strokeWidth: sw,
           strokeDasharray: dash, 'data-series': k})
    ct.svg.appendMany('circle', ys.map((v,i) => ({v, i})))
      .at({cx: q => ct.x(d.layers[q.i]), cy: q => ct.y(q.v), r: 2.2,
           fill: col, 'data-series': k})
    dLabel(ct.svg, {x: ct.x(L.at), y: ct.y(ys[d.layers.indexOf(L.at)]),
      dx: L.dx ?? 0, dy: L.dy, anchor: L.anchor, lines: lab, color: col, key: k, tuneKey: tk})
  })

  util.bindSeriesHover(sel)
  // ?tune=1 on the standalone page makes the labels draggable; copy dx/dy back here
  util.dragTune(tuneItems, 'feature-coverage')

  // rendering can add a page scrollbar and shrink the panels — re-render once at the settled width
  var settledW = panels[0].node().clientWidth
  if (!opts?._panelW && settledW && Math.abs(settledW - panelW) > 2)
    return window.initFeatureCoverage({...opts, _panelW: settledW})
}

window.init?.()

// ─── public/comp-lines/init-comp-lines.js ───
window.initCompLines = async function(opts){
  var sel = d3.select('.comp-lines-attn-adj').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'comp_lines.json')

  // Match comp-tail-energy: jlens = orange accent, SAE percentile bins =
  // Blues ramp (dark→light = top→mid), neuron = purple, random = gray
  // (y=1 reference line + legend row).
  var saeBlue = i => d3.interpolateBlues(0.9 - 0.7 * i / 2)
  var COLOR = {
    jlens_vocab: util.tol.orange,
    sae_top1:    saeBlue(0),
    sae_top5:    saeBlue(1),
    sae_mid:     saeBlue(2),
    neuron_out:  util.series[3],
    neuron_in:   util.series[3],
    random:      util.gray[500],
  }
  var srcs = d.sources.map(s => ({...s, color: COLOR[s.key]}))  // lint-ok data-color-js: COLOR override

  var [wlo, whi] = d.workspace_band
  var xLo = 4, xMax = util.DISPLAY_LAYERS.length - 1
  var iLo = d.layers.findIndex(L => L >= xLo)
  var allMed = d.panels.flatMap(p =>
    srcs.flatMap(s => (d.data[p.key][s.key] ?? []).slice(iLo)))
    .filter(v => v != null)
  var yDom = [Math.min(0.85, d3.min(allMed) * 0.9), d3.max(allMed) * 1.1]

  var mountW = sel.node()?.getBoundingClientRect().width || 0
  var stacked = mountW > 0 && mountW < 700
  var panelW = stacked ? Math.min(420, Math.max(240, mountW - 52)) : 290

  var prow = sel.append('div.panel-row')
  d.panels.forEach((p, pi) => {
    var hasY = stacked || !pi
    var c = d3.conventions({
      sel: prow.append('div.cl-panel').append('div'),
      width: panelW, height: 240,
      margin: {left: hasY ? 48 : 6, right: 4, top: 24, bottom: 32},
    })
    c.x.domain([xLo, xMax])
    c.y = d3.scaleLog().domain(yDom).range([c.height, 0])
    c.xAxis.scale(c.x).tickValues(util.layerTicks(xMax + 1, 6).filter(t => t >= xLo)).tickFormat(util.layerLabel)
    c.yAxis.scale(c.y).ticks(5, '~g')
    c.drawAxis(); util.ggPlot(c)
    if (!hasY) c.svg.select('.y').selectAll('text').remove()
    var rw = {attn_v_var: ' (read)', attn_qk_var: ' (read)', attn_w_var: ' (write)'}[p.key] || ''
    util.addAxisLabel(c, 'Source layer (reindexed) →', hasY ? 'Median composition ratio →' : '', p.title + rw)
    util.addWsBand(c, wlo, whi, {label: pi === d.panels.length - 1 && 'Workspace layers'})
    c.svg.append('line.ref-line')
      .at({x1: 0, x2: c.width, y1: c.y(1), y2: c.y(1), stroke: COLOR.random})

    var line = d3.line().defined((v, i) => v != null && d.layers[i] >= xLo)
      .x((v, i) => c.x(d.layers[i])).y(v => c.y(v))
    srcs.slice().reverse().forEach(s => {
      var vals = d.data[p.key][s.key]
      if (!vals) return
      c.svg.append('path.line-series').at({
        d: line(vals), fill: 'none', 'data-series': s.key,
        stroke: s.color, strokeWidth: s.key === 'jlens_vocab' ? 2.2 : 1.8,
      })
      c.svg.appendMany('circle',
        vals.map((v, i) => ({v, i})).filter(m => m.v != null && d.layers[m.i] >= xLo))
        .at({cx: m => c.x(d.layers[m.i]), cy: m => c.y(m.v), r: 2.2, fill: s.color})  // lint-ok data-color-js
    })
  })

  // Side legend column. neuron_out/in collapse to one "Neuron" row.
  var seen = new Set()
  var legRows = srcs.filter(s => !seen.has(s.label) && seen.add(s.label))
    .concat([{key: 'random', label: 'Random direction', color: COLOR.random}])
  prow.append('div.cl-attn-legend')
    .appendMany('div.cl-leg-row', legRows)
    .at({'data-series': s => s.key})
    .each(function(s){
      d3.select(this).append('span.cl-swatch').st({background: s.color})  // lint-ok data-color-js
      d3.select(this).append('span').text(s.label)
    })
  util.bindSeriesHover(sel)
}

window.init?.()

// ─── public/comp-strata/init-comp-strata.js ───
window.initCompStrata = async function(opts){
  var variant = opts?.variant ?? 'sae6'
  var sel = d3.select(`.comp-strata[data-variant="${variant}"]`).html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'comp_strata.json')
  var v = d[variant]

  // sae6 bins are an ordinal lens-readability percentile → single-hue ramp.
  // Blues by default (matches the matplotlib original; light end stays
  // legible). ?ramp=viridis|orange to compare.
  var rampName = new URLSearchParams(location.search).get('ramp') || 'blues'
  var RAMPS = {
    blues:   t => d3.interpolateBlues(0.9 - 0.7 * t),
    viridis: t => d3.interpolateViridis(0.15 + 0.75 * t),
    orange:  t => util.tint(util.tol.orange, 0.05 + 0.75 * t),
  }
  var ramp = RAMPS[rampName] || RAMPS.blues
  var COLOR = variant === 'sae6'
    ? Object.fromEntries(v.bins.map((b, i) =>
        [b.key, ramp(i / (v.bins.length - 1))]))
    : {jlens_vocab: util.lensColors.jacobian, neuron_out: util.series[3]}

  var keys = v.bins.map(b => b.key)
  var [wlo, whi] = d.workspace_band
  var xMax = util.DISPLAY_LAYERS.length - 1
  var SIDES = [
    {key: 'read',  title: 'MLP input (read)'},
    {key: 'write', title: 'MLP output (write)'},
  ]

  var prow = sel.append('div.panel-row')
  SIDES.forEach((side, pi) => {
    var rows = d.layers.map((L, i) => {
      var r = {layer: L}
      keys.forEach(k => r[k] = v.data[side.key][k][i])
      return r
    })
    var stack = d3.stack().keys(keys)(rows)

    var c = d3.conventions({
      sel: prow.append('div.cs-panel').append('div'),
      width: 320, height: 220,
      margin: {left: pi ? 6 : 50, right: pi ? 92 : 6, top: 24, bottom: 32},
    })
    c.x.domain([d.layers[0], xMax])
    c.y.domain([0, 1])
    c.xAxis.tickValues(util.layerTicks(xMax + 1, 6)).tickFormat(util.layerLabel)
    c.yAxis.ticks(4).tickFormat(d3.format('.0%'))
    c.drawAxis(); util.ggPlot(c)
    if (pi) c.svg.select('.y').selectAll('text').remove()
    util.addAxisLabel(c, 'Source layer (reindexed) →',
      pi ? '' : 'Neurons best-matched →', side.title, 0, -3)

    var area = d3.area()
      .x((p, i) => c.x(d.layers[i]))
      .y0(p => c.y(p[0])).y1(p => c.y(p[1]))
    // own <g> so bindSeriesHover's .raise() stays under edges/ref-lines
    c.svg.append('g').appendMany('path.cs-area', stack)
      .at({d: area, fill: s => COLOR[s.key], 'data-series': s => s.key})
    c.svg.appendMany('path.cs-edge', stack.slice(0, -1))
      .at({d: s => d3.line().x((p,i) => c.x(d.layers[i]))
        .y(p => c.y(p[1]))(s), fill: 'none'})

    // uniform-prior reference grid: 1/n lines on top of the fills
    d3.range(1, keys.length).forEach(k =>
      c.svg.append('line.ref-line')
        .at({x1: 0, x2: c.width, y1: c.y(k/keys.length), y2: c.y(k/keys.length)}))

    // workspace-band: bracket at the bottom of the plot interior, ticks
    // descending toward the x-tick numbers; label just above the bar.
    var bx0 = c.x(wlo), bx1 = c.x(whi), bh = 5, by = c.height - bh - 1
    c.svg.append('path.ws-bracket')
      .at({d: `M${bx0},${by+bh} V${by} H${bx1} V${by+bh}`})
    c.svg.append('text.ws-label').text('Workspace layers')
      .translate([(bx0 + bx1) / 2, by - 14]).st({textAnchor: 'middle'})

    if (pi !== 1) return
    var iEnd = d.layers.length - 1
    var anchors = stack.map(s => ({
      key: s.key, y: c.y((s[iEnd][0] + s[iEnd][1]) / 2),
      label: v.bins.find(b => b.key === s.key).label,
    }))
    util.spreadLabels?.(anchors, 13, 0, c.height)
    // light-tint label text is unreadable; clamp label color to ramp(≤0.4).
    var labelColor = k => variant === 'sae6'
      ? ramp(Math.min(0.4, keys.indexOf(k) / (keys.length - 1)))
      : COLOR[k]
    anchors.forEach(a => util.directLabel(c.svg, {
      x: c.width, y: a.y, dx: 6, dy: 4, anchor: 'start',
      text: a.label, color: labelColor(a.key), key: a.key,
    }))
    if (variant === 'sae6')
      c.svg.append('text').text('by J-lens kurtosis')
        .translate([c.width + 6, -10])
        .st({fontSize: 'var(--fs-label)', fill: 'var(--text-light)'})
  })
  util.bindSeriesHover(sel)
}

window.init?.()

// ─── public/comp-tail-energy/init-comp-tail-energy.js ───
window.initCompTailEnergy = async function(opts){
  var sel = d3.select('.comp-tail-energy').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'comp_tail_energy.json')

  // Match the matplotlib + comp-strata palette: SAE percentile bins = Blues
  // ramp (dark→light = top→bottom); jlens = orange so it separates from the
  // blue SAE stack; neuron = purple. Random sits at y=1 by construction →
  // drawn as a reference line, listed in the legend.
  var saeKeys = d.families.map(f => f.key).filter(k => k.startsWith('sae_'))
  var saeRamp = i => d3.interpolateBlues(0.9 - 0.7 * i / (saeKeys.length - 1))
  var COLOR = {
    jlens_vocab: util.tol.orange,
    neuron_out:  util.series[3],
    random:      util.gray[500],
    ...Object.fromEntries(saeKeys.map((k, i) => [k, saeRamp(i)])),
  }
  var LW = k => k === 'jlens_vocab' ? 2.2 : k === 'neuron_out' ? 1.8 : 1.6

  var [wlo, whi] = d.workspace_band
  var xLo = d.layers[0], xMax = util.DISPLAY_LAYERS.length - 1
  var allMed = ['read', 'write'].flatMap(s =>
    d.families.flatMap(f => d.data[s][f.key]).filter(v => v != null))
  var yMax = d3.max(allMed) * 1.05

  var SIDES = [
    {key: 'read',  title: 'MLP input weights (read)'},
    {key: 'write', title: 'MLP output weights (write)'},
  ]

  var mountW = sel.node()?.getBoundingClientRect().width || 0
  var stacked = mountW > 0 && mountW < 700
  var panelW = stacked ? Math.min(420, Math.max(260, mountW - 52)) : 360

  var prow = sel.append('div.panel-row')
  SIDES.forEach((side, pi) => {
    var hasY = stacked || !pi
    var c = d3.conventions({
      sel: prow.append('div.cte-panel').append('div'),
      width: panelW, height: 250,
      margin: {left: hasY ? 44 : 6, right: 4, top: 24, bottom: 32},
    })
    c.x.domain([xLo, xMax])
    c.y.domain([0, yMax])
    c.xAxis.tickValues(util.layerTicks(xMax + 1, 6).filter(t => t >= xLo)).tickFormat(util.layerLabel)
    c.yAxis.ticks(5)
    c.drawAxis(); util.ggPlot(c)
    if (!hasY) c.svg.select('.y').selectAll('text').remove()
    util.addAxisLabel(c, 'Source layer (reindexed) →', hasY ? 'Tail-energy ratio →' : '', side.title)
    util.addWsBand(c, wlo, whi, {label: pi === 1 && 'Workspace layers'})
    c.svg.append('line.ref-line')
      .at({x1: 0, x2: c.width, y1: c.y(1), y2: c.y(1), stroke: COLOR.random})

    var line = d3.line().defined(v => v != null)
      .x((v, i) => c.x(d.layers[i])).y(v => c.y(v))
    d.families.slice().reverse().forEach(f => {
      var vals = d.data[side.key][f.key]
      c.svg.append('path').at({
        d: line(vals), fill: 'none',
        stroke: COLOR[f.key], strokeWidth: LW(f.key),
      })
      c.svg.appendMany('circle', vals.map((v, i) => ({v, i})).filter(m => m.v != null))
        .at({cx: m => c.x(d.layers[m.i]), cy: m => c.y(m.v), r: 2.0, fill: COLOR[f.key]})  // lint-ok data-color-js
    })

  })

  // Legend column to the right of the panels.
  var legRows = [...d.families, {key: 'random', label: 'Random direction'}]
  var leg = prow.append('div.cte-legend')
  leg.appendMany('div.cte-leg-row', legRows)
    .each(function(f){
      d3.select(this).append('span.cte-swatch').st({background: COLOR[f.key]})  // lint-ok data-color-js
      d3.select(this).append('span').text(f.label)
    })
}

window.init?.()

// ─── public/mlp-gain/init-mlp-gain.js ───
window.initMlpGain = async function(opts){
  var sel = d3.select('.mlp-gain').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'mlp_gain.json')

  // left = lens comparisons (paper palette); right = SAE strata (Blues ramp,
  // matches comp-strata so the readability ordinal reads the same way).
  var saeKeys = d.panels[1].families.map(f => f.key)
  var blues = t => d3.interpolateBlues(0.9 - 0.6 * t)
  var COLOR = {
    jlens_vocab: util.tol.orange,
    neuron_out:  util.gray[600],
    ...Object.fromEntries(saeKeys.map((k, i) => [k, blues(i / (saeKeys.length - 1))])),
  }

  var [wlo, whi] = d.workspace_band
  var xMax = util.DISPLAY_LAYERS.length - 1
  var allKeys = d.panels.flatMap(p => p.families.map(f => f.key))
  var allV = allKeys.flatMap(k => d.data[k])
  var yDom = [Math.min(0.85, d3.min(allV) * 0.95), d3.max(allV) * 1.1]

  var mountW = sel.node()?.getBoundingClientRect().width || 0
  var stacked = mountW > 0 && mountW < 700
  var panelW = stacked ? Math.min(420, Math.max(240, mountW - 56)) : 340

  var LABEL = {
    jlens_vocab: {at: 14, dy: -10, dx: -2, anchor: 'end'},
    neuron_out:  {at:  3, dy: -10, dx:  4, anchor: 'start'},
  }

  var prow = sel.append('div.panel-row')
  d.panels.forEach((p, pi) => {
    var hasY = stacked || !pi
    var c = d3.conventions({
      sel: prow.append('div.mg-panel').append('div'),
      width: panelW, height: 250,
      margin: {left: hasY ? 50 : 6, right: pi ? 110 : 8, top: 24, bottom: 32},
    })
    c.x.domain([0, xMax])
    c.y = d3.scaleLog().domain(yDom).range([c.height, 0])
    c.xAxis.scale(c.x).tickValues(util.layerTicks(xMax + 1, 6)).tickFormat(util.layerLabel)
    c.yAxis.scale(c.y).ticks(5, '~g')
    c.drawAxis(); util.ggPlot(c)
    if (!hasY) c.svg.select('.y').selectAll('text').remove()
    util.addAxisLabel(c, 'Source layer (reindexed) →', hasY ? 'Median MLP block gain →' : '', p.title)

    util.addWsBand(c, wlo, whi, {label: pi === 1 && 'Workspace layers'})
    c.svg.append('line.ref-line').at({x1: 0, x2: c.width, y1: c.y(1), y2: c.y(1)})
    if (!pi) c.svg.append('text').text('Random direction')
      .at({x: c.width - 4, y: c.y(1) - 5, textAnchor: 'end'})
      .st({fill: 'var(--text-light)', fontSize: 'var(--fs-label)'})

    var line = d3.line().x((v, i) => c.x(d.layers[i])).y(v => c.y(v))
    p.families.slice().reverse().forEach(f => {
      var vals = d.data[f.key], col = COLOR[f.key]
      c.svg.append('path.line-series').at({
        d: line(vals), fill: 'none', 'data-series': f.key,
        stroke: col, strokeWidth: f.key === 'jlens_vocab' ? 2.2 : 1.8,
      })
      c.svg.appendMany('circle', vals.map((v, i) => ({v, i})))
        .at({cx: m => c.x(d.layers[m.i]), cy: m => c.y(m.v), r: 2.2, fill: col})  // lint-ok data-color-js
    })

    if (!pi) p.families.forEach(f => {
      var L = LABEL[f.key]; if (!L) return
      var li = d.layers.indexOf(L.at)
      if (li < 0) li = d3.bisectLeft(d.layers, L.at)
      util.directLabel(c.svg, {
        x: c.x(d.layers[li]), y: c.y(d.data[f.key][li]),
        dx: L.dx, dy: L.dy, anchor: L.anchor,
        text: f.label, color: COLOR[f.key], key: f.key,
      })
    })
    else {
      var leg = c.svg.append('g.mg-leg').translate([c.width + 10, 8])
      leg.append('text.leg-title').text('J-lens kurtosis').at({y: -2})
      leg.append('text.leg-title').text('percentile').at({y: 10})
      p.families.forEach((f, i) => {
        var g = leg.append('g').translate([0, 26 + i * 15])
        g.append('line').at({x1: 0, x2: 14, stroke: COLOR[f.key], strokeWidth: 2.5})
        g.append('text').text(f.label).at({x: 19, dy: '.32em'})
          .st({fill: util.gray[700]})
      })
    }
  })
  util.bindSeriesHover(sel)
}

window.init?.()

// ─── public/lens-similarity/init-lens-similarity.js ───
window.initLensSimilarity = async function(opts){
  var sel = d3.select('.lens-similarity').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'lens_similarity.json')

  // Per-pair line colour. Jacobian-involving pairs take the *other* lens's
  // util.lensColors hue (matching the per-method palette in line-panels);
  // the no-jacobian logit↔tuned pair is neutral gray.
  var COLOR = {
    'jacobian-logit': util.lensColors.logit,
    'jacobian-tuned': util.lensColors.tuned,
    'logit-tuned':    util.gray[600],
  }
  d.pairs = d.pairs.map(p => ({...p, color: COLOR[p.key]}))  // lint-ok data-color-js: COLOR override above

  // Direct labels — anchored on panel 0 (cosine) where the three lines have
  // the most vertical separation in the mid layers.
  var LABEL = {
    'jacobian-logit': {at: 14, dy: -10, dx:  -4, anchor: 'end'},
    'jacobian-tuned': {at: 17, dy:  14, dx:   2, anchor: 'start'},
    'logit-tuned':    {at:  6, dy: -10, dx:   0, anchor: 'middle'},
  }

  var [wlo, whi] = d.workspace_band
  var xMax = d.layers[d.layers.length - 1]
  // cos/agree are bounded [0,1] — no negative axis space, no headroom past 100%;
  // dots at 0/1 sit on the boundary
  var yDom = {
    cos:   [0, 1],
    kl:    [0, d3.max(d.pairs.flatMap(p => d.data.kl[p.key])) * 1.08],
    agree: [0, 1],
  }

  var prow = sel.append('div.panel-row')
  d.panels.forEach((p, pi) => {
    var cell = prow.append('div.ls-panel')
    var c = d3.conventions({
      sel: cell.append('div'),
      width: 290, height: 230,
      margin: {left: pi ? 42 : 48, right: 6, top: 24, bottom: 32},
    })
    c.x.domain([0, xMax])
    c.y.domain(yDom[p.key])
    // cos/agree are bounded [0,1] — nice() would expand the small pad to [-0.1, 1.1]
    if (p.key === 'kl') c.y.nice()
    c.xAxis.scale(c.x).tickValues(util.layerTicks(xMax + 1, 6)).tickFormat(util.layerLabel)
    c.yAxis.scale(c.y).ticks(5)
    c.drawAxis(); util.ggPlot(c)
    if (pi) c.svg.select('.x .tick text').remove()
    util.addAxisLabel(c, 'Layer (reindexed) →', p.ylabel + ' →', p.title)

    util.addWsBand(c, wlo, whi, {label: pi === d.panels.length - 1 && 'Workspace layers'})

    var line = d3.line().defined(v => v != null)
      .x((v,i) => c.x(d.layers[i])).y(v => c.y(v))
    d.pairs.forEach(s => {
      var ys = d.data[p.key][s.key]
      c.svg.append('path.line-series').at({
        d: line(ys), fill: 'none', 'data-series': s.key,
        stroke: s.color, strokeWidth: 1.9,
      })
      c.svg.appendMany('circle', ys.map((v,i) => ({v, i})).filter(m => m.v != null))
        .at({cx: m => c.x(d.layers[m.i]), cy: m => c.y(m.v), r: 2.2, fill: s.color})  // lint-ok data-color-js
    })

    if (pi) return
    d.pairs.forEach(s => {
      var ys = d.data[p.key][s.key], L = LABEL[s.key]
      var li = d.layers.indexOf(L.at)
      if (li < 0) return
      // ↔ falls back to a font whose glyph sits on the baseline — render an en dash instead
      util.directLabel(c.svg, {
        x: c.x(L.at), y: c.y(ys[li]),
        dx: L.dx, dy: L.dy, anchor: L.anchor,
        text: s.label.replace(' ↔ ', ' – '), color: s.color, key: s.key,
      })
    })
  })
  util.bindSeriesHover(sel)
}

window.init?.()

// ─── public/transcoder-arith/init-transcoder-arith.js ───
window.initTranscoderArith = async function(opts){
  var sel = d3.select('.transcoder-arith')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'arith.json')

  var ML0 = 72, MLn = 22, MRz = 22

  function render(){
    sel.html('')
    var row = sel.append('div.panel-row')
    // stacked (mobile) mode: panel-row goes flex-direction:column via the container query
    var stacked = getComputedStyle(row.node()).flexDirection === 'column'
    var cw = sel.node().offsetWidth || 910
    // stacked panels fill the container width; desktop keeps the fixed 240px panels
    var s = stacked ? Math.max(1.6, Math.min(3.4, (cw - ML0 - MRz) / 100)) : 2.4
    var W = 100 * s
    var orange = d3.scaleSequential(d3.interpolateOranges).domain([0, 1.4]).clamp(true)
    var prgn = d3.scaleDiverging(d3.interpolatePRGn).domain([-1, 0, 1]).clamp(true)
    var ticks20 = d3.range(0, 100, 20)

    function vgrid(c){
      d3.range(0, 101, 20).forEach(t => c.svg.append('line')
        .at({x1: c.x(t), x2: c.x(t), y1: 0, y2: c.height, stroke: '#fff', strokeWidth: 0.7}))
    }
    function frame(c){
      c.svg.append('rect').at({width: c.width, height: c.height, fill: 'none', stroke: util.gray[400], strokeWidth: 0.6})
    }
    function barLabel(svg, name, h){
      var t = svg.append('text').at({x: -28, y: h/2 - 3, textAnchor: 'end', fill: util.gray[700]})
      t.append('tspan.ta-barname').text(name)
      var f = t.append('tspan.ta-formula').at({x: -28, dy: 11, fill: util.gray[500]})
      f.append('tspan').text('· J · W')
      f.append('tspan').text('U').at({baselineShift: 'sub', fontSize: '70%'})  // lint-ok inline-font-js: subscript
    }
    function sectionLabel(svg, txt, w, h){
      svg.append('text.mlabel').text(txt)
        .at({x: w + 16, y: h/2, textAnchor: 'middle', fill: util.gray[500],
             transform: `rotate(90 ${w + 16} ${h/2})`})
    }

    d.features.forEach((f, fi) => {
      // when stacked, every panel is redrawn with its own y-axis labels, bar labels,
      // and section labels so each fills the width and they all share the same left edge
      var first = stacked || fi === 0
      var lastp = stacked || fi === d.features.length - 1
      var ML = stacked ? ML0 : (first ? ML0 : MLn)
      var MR = lastp ? MRz : 4
      var cell = row.append('div.ta-panel')
      cell.append('div.fig-title').text(f.title).st({marginLeft: ML, marginRight: MR})

      // operand activation: 100×100, row=a, col=b
      var c = d3.conventions({
        sel: cell.append('div'),
        width: W, height: W, layers: 'sc',
        margin: {left: ML, right: MR, top: 2, bottom: 20},
      })
      c.x.domain([0, 100]); c.y.domain([0, 100])
      c.xAxis.tickValues(ticks20).tickFormat(d => d).tickSize(3)
      c.yAxis.tickValues(ticks20).tickFormat(d => d).tickSize(3)
      c.drawAxis()
      c.svg.insert('rect', ':first-child').at({width: c.width, height: c.height, fill: util.gray[100]})
      util.addAxisLabel(c, 'Operand b →', first ? 'Operand a →' : '')
      var ctx = c.layers[1]
      for (var i = 0; i < 100; i++) for (var j = 0; j < 100; j++){
        var v = f.heatmap[i][j]
        if (v <= 0) continue
        ctx.fillStyle = orange(v)
        ctx.fillRect(j*s, (99-i)*s, s, s)
      }
      d3.range(0, 101, 20).forEach(t => c.svg.append('line')
        .at({x1: 0, x2: c.width, y1: c.y(t), y2: c.y(t), stroke: '#fff', strokeWidth: 0.7}))
      vgrid(c); frame(c)
      if (lastp) sectionLabel(c.svg, 'avg activation', c.width, c.height)

      cell.append('div.ta-gap')

      // lensed bars: 10×100 each, row=hundreds digit, col=last two digits of sum
      d.bars.forEach((b, bi) => {
        var last = bi === d.bars.length - 1
        var cb = d3.conventions({
          sel: cell.append('div'),
          width: W, height: 10*s, layers: 'sc',
          margin: {left: ML, right: MR, top: 0, bottom: last ? 30 : 12},
        })
        cb.x.domain([0, 100]); cb.y.domain([0, 10])
        cb.xAxis.tickValues(ticks20)
          .tickFormat(last ? d => '_' + String(d).padStart(2, '0') : () => '').tickSize(3)
        cb.yAxis.tickValues([0.5, 9.5])
          .tickFormat(d => Math.floor(d) + '__').tickSize(0)
        cb.drawAxis()
        cb.svg.selectAll('.y .tick text').at({fontSize: 'var(--fs-label)', fill: util.gray[500], x: -3})
        if (last) util.addAxisLabel(cb, 'Predicted sum (last two digits) →', '')
        if (first) barLabel(cb.svg, b.name || b.label, cb.height)
        var g = f[b.key].grid, cx = cb.layers[1]
        for (var h = 0; h < 10; h++) for (var j = 0; j < 100; j++){
          cx.fillStyle = prgn(g[h][j])
          cx.fillRect(j*s, (9-h)*s, s, s)
        }
        vgrid(cb); frame(cb)
        if (lastp && bi === 0) sectionLabel(cb.svg, 'J-lens effect', cb.width, d.bars.length * (10*s + 3))
      })
    })
    util.colorCaption(sel, {promotes: prgn(0.7), suppresses: prgn(-0.7)})
    return {stacked, w: cw}
  }

  var cur = render()
  var mount = sel.node()
  mount.__taRO?.disconnect()
  mount.__taRO = new ResizeObserver(util.throttleDebounce(() => {
    var w = mount.offsetWidth
    var stacked = getComputedStyle(sel.select('.panel-row').node()).flexDirection === 'column'
    if (stacked !== cur.stacked || (stacked && Math.abs(w - cur.w) > 4)) cur = render()
  }, 120))
  mount.__taRO.observe(mount.closest('figure') || mount)
}

window.init?.()

// ─── public/transcoder-translation/init-transcoder-translation.js ───
window.initTranscoderTranslation = async function(opts){
  var sel = d3.select('.transcoder-translation').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'translation.json')

  // Orange is reserved for activation strength in this paper — categorical series
  // use Tol vibrant from util.tol. Override the bake-supplied colors so a future
  // change to util.tol propagates without re-baking.
  var catOverride = {0: util.tol.blue, 1: util.tol.magenta, 2: util.tol.teal}
  var catColor = c => {
    var idx = Object.keys(d.cats).indexOf(c)
    return catOverride[idx] ?? d.cats[c]?.color ?? util.gray[500]
  }

  var row = sel.append('div.panel-row')
  row.append('div.tt-ylabel').text('Rank →')
  d.features.forEach(f => {
    var cell = row.append('div.tt-panel')
    var t = cell.append('div.fig-title')
    // panel titles get sentence case; f.en stays lowercase in the data (it's the literal word)
    t.append('span').text(f.en.charAt(0).toUpperCase() + f.en.slice(1))
    t.append('span.arrow').text('→')
    t.append('span').text(f.fr)

    var cols = cell.append('div.tt-cols')
    ;[['Encoder', f.encoder], ['Decoder', f.decoder]].forEach(([name, toks]) => {
      var box = cols.append('div.tt-box')
      var hdr = box.append('div.tt-hdr')
      hdr.append('span.tt-name').text(name)
      var fm = hdr.append('span.tt-formula')
      fm.append('span').text(' · J · W')
      fm.append('sub').text('U')
      box.append('div.tt-list').appendMany('div.tt-row', toks).each(function(t){
        var s = d3.select(this)
        s.append('span.tt-rank').text(t.rank)
        var tx = util.ppToken(t.tok)
        s.append('span.tt-tok').text(tx).at({title: tx})
          .st({color: catColor(t.cat)})
      })
    })
  })

  var leg = sel.append('div.tt-legend')
  Object.entries(d.cats).forEach(([key, c], idx) => {
    var item = leg.append('div.legend-item')
    item.append('span.legend-sq').st({background: catOverride[idx] ?? c.color})  // lint-ok data-color-js: c.color overridden by catOverride
    item.append('span').text(c.label)
  })

  util.colorCaption(sel, {
    'multilingual concept': util.tol.blue,
    'French context': util.tol.magenta,
    'French word': util.tol.teal,
  })
}

window.init?.()

// ─── public/attn-panel/init-attn-panel.js ───
!function(){
  var WEIGHT_TYPES = ['Q', 'K', 'V', 'O']
  var QKVO_HDR = 'top jlens tokens'
  var PATTERN_HDR = '<span>attention pattern from query token</span><span>↓</span>'

  // white-at-zero tint so unattended tokens stay neutral; full weight = tol.orange
  function attnOrange(w){ return util.tint(util.tol.orange, 1 - Math.max(0, Math.min(1, w))) }

  function renderHead(sel, h, ramp, isMain){
    var ahp = sel.append('div.ahp.card')
    ahp.append('div.fig-title').text(h.label + ' Attention Head')
    var body = ahp.append('div.body')

    var left = body.append('div')
    left.append('div.mlabel.pattern-right').html(PATTERN_HDR)
    left.append('div.snips').appendMany('div.snip', h.snippets).each(function(s){
      d3.select(this).append('span.row').appendMany('span.tok', s.tokens)
        .text(d => d)
        .st({background: (_, i) => ramp(s.w[i])})
        .classed('tok-hit', (_, i) => !isMain && i === s.q)
    })

    var right = body.append('div')
    right.append('div.mlabel').html(QKVO_HDR)
    right.append('div.qkvo').appendMany('div.col', WEIGHT_TYPES).each(function(wt){
      var col = d3.select(this)
      col.append('div.wt').html(`W<sub>${wt}</sub>`)
      col.appendMany('div.t', h.qkvo[wt]).text(d => d).at({title: d => d})
    })
  }

  async function render(sel, opts, keys, ramp, isMain){
    sel.html('')
    var base = (opts?.datapath || './').replace(/\/?$/, '/')
      .replace(/attn-panel-appendix\/$/, 'attn-panel/')
    var d = await util.getFile(base + 'heads.json')
    keys.forEach(k => renderHead(sel, d.heads[k], ramp, isMain))
  }

  window.initAttnPanel = opts => render(d3.select('.attn-panel'), opts, ['british'], attnOrange, true)
  window.initAttnPanelAppendix = opts =>
    render(d3.select('.attn-panel-appendix'), opts, ['async', 'temperature', 'honorific'], attnOrange)
}()

window.init?.()

// ─── public/jlens-circuit-graph/init-jlens-circuit-graph.js ───
window.initJlensCircuitGraph = async function({datapath}){
  var sel = d3.select('.jlens-circuit-graph').html('')
  var d = await util.getFile(datapath + 'data.json')

  var row = sel.append('div.panel-row')

  // ── left panel: curated attribution graph ──
  var gp = row.append('div.graph-panel')
  gp.append('div.fig-title').text('J-lens attribution graph')
  gp.append('div.prompt-box').text(d.prompt)

  var BW = 128, BH = 48, STACK = 3
  var X = col => 70 + col*185, Y = r => 28 + r*88
  var W = X(d3.max(d.graph.nodes, n => n.col)) + BW/2 + STACK*2.5 + 8
  var H = Y(d3.max(d.graph.nodes, n => n.row)) + BH/2 + STACK*2.5 + 6
  var svg = gp.append('svg').at({viewBox: `0 0 ${W} ${H}`})

  var byId = {}
  d.graph.nodes.forEach(n => byId[n.id] = {...n, x: X(n.col), y: Y(n.row)})

  svg.append('defs').append('marker')
    .at({id: 'jlens-cg-arrow', viewBox: '0 0 10 10', refX: 8.5, refY: 5,
         markerWidth: 12, markerHeight: 12, orient: 'auto', markerUnits: 'userSpaceOnUse'})
    .append('path.arrowhead').at({d: 'M0,0L10,5L0,10z'})

  // trunk-style edges: every input to a box merges below it and enters
  // through a single arrowhead; tributaries join with rounded breaks
  var bySrc = d3.group(d.graph.edges, e => e.source)
  bySrc.forEach(es => {
    es.sort((a, b) => byId[a.target].x - byId[b.target].x)
    es.forEach((e, i) => e._sOff = (i - (es.length - 1)/2)*22)
  })
  d3.group(d.graph.edges, e => e.target).forEach((es, tgt) => {
    var t = byId[tgt], r = 10
    var yStub = t.y + BH/2 + STACK*2, yMerge = yStub + 20
    svg.append('path.edge').at({d: `M${t.x},${yMerge - r} L${t.x},${yStub}`, markerEnd: 'url(#jlens-cg-arrow)'})
    es.forEach(e => {
      var s = byId[e.source]
      var x0 = s.x + (e._sOff || 0), x1 = t.x, sx = x1 > x0 ? 1 : -1
      // exit from the source's top when it sits below the merge level,
      // from its bottom otherwise, so the line never crosses a box
      var fromTop = s.y - BH/2 > yMerge + 12
      var y0 = fromTop ? s.y - BH/2 : s.y + BH/2 + STACK*2
      var path = Math.abs(x1 - x0) < 6
        ? `M${x0},${y0} L${x1},${yMerge - r}`
        : `M${x0},${y0} L${x0},${yMerge + (fromTop ? r : -r)} Q${x0},${yMerge} ${x0 + sx*r},${yMerge} ` +
          `L${x1 - sx*r},${yMerge} Q${x1},${yMerge} ${x1},${yMerge - r}`
      svg.append('path.edge').at({d: path})
    })
  })

  // supernode boxes — stacked-card look, atom tokens in small gray underneath
  var boxFill = n => n.kind == 'reminder' ? util.tint(util.brand.manilla, 0.62) : util.brand.manilla
  var node = svg.appendMany('g.node', d.graph.nodes.map(n => byId[n.id]))
    .translate(n => [n.x - BW/2, n.y - BH/2])
    .classed('reminder', n => n.kind == 'reminder')
  node.each(function(n){
    var g = d3.select(this)
    d3.range(STACK, 0, -1).forEach(i =>
      g.append('rect.stack').at({x: i*2.5, y: i*2.5, width: BW, height: BH, rx: 8})
        .st({fill: boxFill(n), stroke: util.gray[500]}))
    g.append('rect.stack').at({width: BW, height: BH, rx: 8})
      .st({fill: boxFill(n), stroke: util.gray[500]})
  })
  node.append('text.blabel').text(n => n.label)
    .at({x: BW/2, y: n => n.atoms.length ? BH/2 + 1 : BH/2 + 5, textAnchor: 'middle'})
  node.filter(n => n.atoms.length).append('text.alabel')
    .text(n => n.atoms.join(' · ')).at({x: BW/2, y: BH/2 + 15, textAnchor: 'middle'})

  var leg = gp.append('div.legend-row')
  ;[['J-space supernode', util.brand.manilla],
    ['non-J-space remainder term', util.tint(util.brand.manilla, 0.62)]].forEach(([t, c]) => {
    var li = leg.append('div.legend-item')
    li.append('div.legend-sq').st({background: c, border: '1px solid ' + util.gray[500]})
    li.append('span').text(t)
  })
  var li = leg.append('div.legend-item')
  li.append('svg').at({width: 22, height: 10})
    .append('path.edge').at({d: 'M0,5 L14,5', markerEnd: 'url(#jlens-cg-arrow)'})
  li.append('span').text('attribution edge')

  // ── right panel: the original matplotlib swap plot, shipped as swaps.svg ──
  // title rendered by the page (same .fig-title as the left panel) so the two
  // panel headers read as siblings; the svg itself carries no title
  var bp = row.append('div.bars-panel')
  bp.append('div.fig-title').text('Coordinate swaps: probability of the implied answer')
  bp.append('img.swaps-img').at({
    src: datapath + 'swaps.svg',
    alt: 'Probability of the implied counterfactual answer before vs after each coordinate swap',
  })
}

window.init?.()

// ─── public/attn-broadcast-reselect/init-attn-broadcast-reselect.js ───
window.initAttnBroadcastReselect = async function(opts){
  var sel = d3.select('.attn-broadcast-reselect').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  // axis extent from all x/y values (plus a small pad so labels fit).
  // Gain ratio can't fall below 1's left pad and MRR delta can't be negative
  // in any meaningful way — domains start at exactly 1 and 0; whiskers that
  // dip past those bounds are clamped to the boundary.
  var xExt = d3.extent(d.populations.flatMap(p => p.x))
  var yExt = d3.extent(d.populations.flatMap(p => p.y))
  var pad = 0.1
  var clampX = v => Math.max(1, v)
  var clampY = v => Math.max(0, v)

  sel.append('div.fig-title').text('Broadcast-head gain and label preservation by population')

  var c = d3.conventions({
    sel: sel.append('div'),
    width: 460, height: 380,
    margin: {left: 56, right: 12, top: 18, bottom: 44},
  })
  c.x.domain([1, xExt[1] + pad])
  c.y.domain([0, yExt[1] + 0.04])
  c.xAxis.ticks(6); c.yAxis.ticks(6)
  c.drawAxis(); util.ggPlot(c)
  var yLabOffset = -5
  util.addAxisLabel(c, 'Gain[P] / gain[random] →', 'MRR[P] − MRR[random] →', '', 0, yLabOffset)

  // ?tune=1 on the standalone page makes the y-axis label and title draggable (util.dragTune)
  var yLabG = d3.select(c.svg.select('.y .axis-label').node().parentNode)
  var titleSel = sel.select('.fig-title').st({position: 'relative'})
  util.dragTune([
    {sel: yLabG, key: 'y-label',
      get: () => ({x: yLabOffset - 30, y: c.height / 2}),
      set: p => yLabG.translate([p.x, p.y])},
    {sel: titleSel, key: 'title',
      get: () => ({x: 0, y: 0}),
      set: p => titleSel.st({left: p.x + 'px', top: p.y + 'px'})},
  ], 'attn-broadcast-reselect')

  // baseline lines: x=1 (random gain), y=0 (random mrr)
  c.svg.append('line.ref-line')
    .at({x1: c.x(1), x2: c.x(1), y1: 0, y2: c.height})
  c.svg.append('line.ref-line')
    .at({x1: 0, x2: c.width, y1: c.y(0), y2: c.y(0)})

  var relabel = {'Lens vectors (J)': 'J-lens vectors', 'J, rotated': 'J-lens rotated'}
  d.populations.forEach(p => {
    var hasIQR = p.x.length === 3
    var x50 = hasIQR ? p.x[1] : p.x[0], y50 = hasIQR ? p.y[1] : p.y[0]
    var mx = c.x(x50), my = c.y(y50)
    if (hasIQR) {
      c.svg.append('line.abr-whisker')
        .at({x1: c.x(clampX(p.x[0])), x2: c.x(clampX(p.x[2])), y1: my, y2: my, stroke: p.color})
      c.svg.append('line.abr-whisker')
        .at({x1: mx, x2: mx, y1: c.y(clampY(p.y[0])), y2: c.y(clampY(p.y[2])), stroke: p.color})
    }
    c.svg.append('circle.abr-mean')
      .at({cx: mx, cy: my, r: 6, fill: p.color})
    var a = p.anchor
    c.svg.append('text.abr-label')
      .text(relabel[p.label] || p.label)
      .translate([mx + a.dx, my + a.dy])
      .st({textAnchor: a.ta, fill: p.color})
  })

}

window.init?.()

// ─── public/ablation-bars/init-ablation-bars.js ───
window.initAblationBars = async function({datapath}){
  var sel = d3.select('.ablation-bars').html('')
  var d = await util.getFile(datapath + 'bars.json')
  var mm = s => s.replace(/\bsonnet\b/gi, 'Sonnet 4.5').replace(/\bhaiku\b/gi, 'Haiku 4.5')
  var trColor = tr => tr.hatch ? util.gray[400]
    : util.ablationColors[tr.name] ?? tr.color  // lint-ok data-color-js: fallback

  // title + legend in HTML so they stay visible while the wide SVG h-scrolls on mobile
  sel.append('div.fig-title').text(mm(d.title))
  sel.append('div.legend-row').appendMany('div.legend-item', d.traces).each(function(tr){
    d3.select(this).append('span.legend-sq').st({background: trColor(tr)})
    d3.select(this).append('span').text(mm(tr.name))
  })

  var nT = d.tasks.length
  var c = d3.conventions({
    sel: sel.append('div.ab-scroll').append('div'),
    width: 1020,
    height: 320,
    margin: {left: 52, right: 8, top: 22, bottom: 88},
    layers: 's',
  })

  var x0 = d3.scaleBand().domain(d3.range(nT)).range([0, c.width])
    .paddingInner(0.16).paddingOuter(0.05)
  var x1 = d3.scaleBand().domain(d3.range(d.traces.length))
    .range([0, x0.bandwidth()]).paddingInner(0.12)
  c.y.domain([0, 1])

  // axes — gray panel + white gridlines from the shared ggPlot helper
  c.x.domain([0, 1])
  c.yAxis.ticks(6).tickFormat(d3.format('.0%'))
  c.drawAxis()
  c.svg.select('.x').remove()
  util.ggPlot(c)
  util.addAxisLabel(c, '', mm(d.ylabel), '', 0, -10)

  // 2-line x-tick labels
  c.svg.append('g.x-ticks').translate([0, c.height + 6])
    .appendMany('text.tick-label', d3.range(nT))
    .translate(i => [x0(i) + x0.bandwidth()/2, 0])
    .at({textAnchor: 'middle'})
    .each(function(i){
      var parts = d.display[i].split(/ (.+)/)
      d3.select(this).append('tspan').text(parts[0]).at({x: 0, dy: '0.9em'})
      if (parts[1]) d3.select(this).append('tspan').text(parts[1]).at({x: 0, dy: '1.15em'})
    })

  // bars + asymmetric error bars
  var g = c.svg.appendMany('g.task', d3.range(nT)).translate(i => [x0(i), 0])
  d.traces.forEach((tr, j) => {
    var fill = trColor(tr)
    g.append('rect.bar').at({
      x: x1(j), width: x1.bandwidth(), fill,
      y: i => c.y(tr.y[i]), height: i => c.height - c.y(tr.y[i]),
      
    })
    var ex = x1(j) + x1.bandwidth()/2, cap = Math.min(2, x1.bandwidth()*0.35)
    g.append('path.err').at({d: i =>
      `M${ex},${c.y(tr.lo[i])} V${c.y(tr.hi[i])}` +
      ` M${ex-cap},${c.y(tr.lo[i])} h${2*cap}` +
      ` M${ex-cap},${c.y(tr.hi[i])} h${2*cap}`,
      stroke: util.gray[700],
    })
  })

  // group brackets + 2-line captions
  var br = c.svg.append('g.brackets').translate([0, c.height])
  var yTip = 38, yBar = 46, yTxt = 52
  d.groups.forEach(gr => {
    var x0p = x0(gr.x0) - x0.step()*0.03
    var x1p = x0(gr.x1) + x0.bandwidth() + x0.step()*0.03
    br.append('path').at({d: `M${x0p},${yTip} V${yBar} H${x1p} V${yTip}`})
    var t = br.append('text').translate([(x0p+x1p)/2, yTxt]).at({textAnchor: 'middle'})
    gr.caption.split('<br>').forEach((line, k) =>
      t.append('tspan').text(line).at({x: 0, dy: k ? '1.15em' : '0.9em'}))
  })
}

window.init?.()

// ─── public/ablation-examples/init-ablation-examples.js ───
window.initAblationExamples = async function({datapath}){
  var pctfirst = new URLSearchParams(location.search).has('pctfirst')
  var sel = d3.select('.ablation-examples').html('').classed('pctfirst', pctfirst)
  var chips = await util.getFile(datapath + 'chips.json')

  // Linear KL→Oranges; the colormap's 0-end is a warm cream (#fff5eb), so for
  // t<0.05 lerp from true white into Oranges(0.0465) — continuous at the join,
  // and t≥0.05 follows the Oranges hue path unchanged.
  var orng = d3.interpolateOranges, EPS = 0.05
  var ramp = t => t < EPS
    ? d3.interpolateRgb('#fff', orng(0.93*EPS))(t/EPS)
    : orng(0.93*t)
  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  var allow = s => esc(s)
    .replaceAll('&lt;b&gt;','<b>').replaceAll('&lt;/b&gt;','</b>')
    .replaceAll('&lt;i&gt;','<i>').replaceAll('&lt;/i&gt;','</i>')
    .replaceAll('&lt;br&gt;','<br>')
  // marker-only tokens (↑ ⍽ ⇪) strip to '' — show the raw marker, not ∅
  var lbl = s => { var p = util.ppCell(s); return p === '∅' ? s : p }

  // Drop prediction rows whose token renders as the replacement glyph (U+FFFD)
  // or decodes to empty after marker stripping — they're partial/invalid byte
  // sequences from the tokenizer, not real predictions.
  var isJunk = t => /\uFFFD/.test(t) || util.ppToken(t).trim() === ''
  function pred(rows, n){
    rows = (rows || []).filter(([t]) => !isJunk(t))
    return d3.range(n).map(i => {
      var [t, p] = rows[i] || [' ', 0]
      var tx = esc(util.ppCell(t)), pct = rows[i] ? (p*100).toFixed(0)+'%' : ''
      return `<div class="row" title="${tx}"><div class="bar" style="width:${(p*100).toFixed(1)}%"></div>` +
        (pctfirst ? `<span class="p">${pct}</span><span class="t">${tx}</span>`
                  : `<span class="t">${tx}</span><span class="p">${pct}</span>`) + `</div>`
    }).join('')
  }

  sel.append('div.chip-grid').appendMany('div.abl-chip', chips).each(function(D){
    var chip = d3.select(this)
    var head = chip.append('div.ch-head')
    head.append('span.ch-title').text(D.title)
      .append('span.ch-tag').text(' ' + (D.tag || ''))
    if (D.analysis) head.append('span.ch-help').html(
      `Analysis <span class="q">?</span><span class="tip">${allow(D.analysis)}</span>`)
    if (D.anno) chip.append('div.ch-anno').html(allow(D.anno))

    var strip = chip.append('div.ch-strip.prompt-block')
    var elide = D.lo > 1
    if (elide) strip.append('span.ellipsis').text('[...]')
    var prevNl = false
    var spans = strip.appendMany('span.ct', d3.range(D.toks.length))
      .each(function(i){
        var t = D.toks[i], x = D.kl[i] / D.vmax
        if (i === 0 && elide) t = t.replace(/^\s+/, '')
        var disp = util.ppToken(t, true)  // strip case/space markers, keep \n
        disp = disp.replace(/\n+/g, m => '⏎'.repeat(m.length) + '\n')
        if (prevNl) disp = disp.replace(/^(⏎+)\n/, '$1')
        prevNl = t.endsWith('\n')
        // Marker-only tokens (↑ cap, ⍽ space) strip to '' — keep the marker
        // glyph so the span has width and stays clickable.
        if (!disp.trim()) disp = t || '∅'
        var bg = ramp(x)
        d3.select(this).text(disp)
          .st({background: bg, color: d3.hsl(bg).l < 0.6 ? '#fff' : null})
      })

    var sub = chip.append('div.ch-sub')
    var nSel = d3.max(D.sel, s => s.length), nPred = d3.max(D.base, b => b.length)
    var cSel = sub.append('div.ch-col')
    var hSel = cSel.append('h6.mlabel').html('Top Ablated <span class="pos"></span>')
    var dSel = cSel.append('div.c-sel')
    var cBase = sub.append('div.ch-col')
    cBase.append('h6.mlabel').html('Before <span class="unit">(prob)</span>')
    var dBase = cBase.append('div.c-base')
    var cAbl = sub.append('div.ch-col')
    var hAbl = cAbl.append('h6.mlabel').html('After <span class="kl"></span>')
    var dAbl = cAbl.append('div.c-abl')

    var posLbl = hSel.select('.pos'), klLbl = hAbl.select('.kl')
    var cur = -1
    function show(i){
      if (i === cur) return
      spans.classed('tok-hit', j => j === i)
      cur = i
      posLbl.text(`"${lbl(D.raw[i])}"`)
      var k = D.kl[i]
      klLbl.text('(KL=' + (k >= 10 ? k.toFixed(1) : k.toFixed(2)) + ')')
      var half = Math.ceil(nSel / 2)
      var sel_filtered = (D.sel[i] || []).filter(t => t == null || !isJunk(t))
      dSel.html(d3.range(nSel).map(r => {
        var t = sel_filtered[r], col = r < half ? 1 : 2, row = (r % half) + 1
        var tx = t == null ? '' : esc(util.ppCell(t))
        return `<div class="sel-row" title="${tx}" style="grid-column:${col};grid-row:${row}">` +
          `<span class="rk">${r+1}</span>${tx}</div>`
      }).join(''))
      dBase.html(pred(D.base[i], nPred))
      dAbl.html(pred(D.abl[i], nPred))
    }
    spans.on('mouseenter', (e, i) => show(i))
    strip.on('mouseleave', () => show(D.default))
    show(D.default)
  })

  var leg = sel.append('div.abl-legend')
  leg.append('span.leg-label').text('Token shading = KL after ablating that position')
  leg.append('span.leg-end').text('max')
  leg.append('svg').at({width: 120, height: 10})
    .appendMany('rect', d3.range(40))
    .at({x: i => i*3, width: 4, height: 10, fill: i => ramp(1 - i/39)})
  leg.append('span.leg-end').text('0')
}

window.init?.()

// ─── public/ablation-strength/init-ablation-strength.js ───
window.initAblationStrength = async ({datapath}) => {
  const sel = d3.select('.ablation-strength').html('')
  const d = await util.getFile(datapath + 'table.json')
  const pct = v => (v * 100).toFixed(0) + '%'

  sel.append('div.fig-title').html(
    `Ablation strength <span class='sub'>multihop n=${d.n_items}, ` +
    `clean ${pct(d.clean_acc)} · PT n=${d.n_pos.toLocaleString()}</span>`
  )
  const hasLayers = d.rows[0]?.layers != null
  const tbl = sel.append('table')
  tbl.append('thead').append('tr').html(
    '<th class="mlabel">ablation</th>' + (hasLayers ? '<th class="mlabel">layers ablated</th>' : '') +
    '<th class="mlabel">multihop acc</th><th class="mlabel">PT top-1 match</th>'
  )
  tbl.append('tbody').appendMany('tr', d.rows).each(function (r) {
    const tr = d3.select(this).classed('control', r.name === 'random')
    var rc = util.ablationColors[r.name] ?? r.color  // lint-ok data-color-js: fallback
    tr.append('td').html(
      `<span class='swatch' style='background:${rc}'></span>${r.name}` +
      (r.name === 'random' ? `<span class='control-note'>control</span>` : '')
    )
    if (hasLayers) tr.append('td.layers').text(r.layers)
    tr.append('td').text(pct(r.mh_acc))
    tr.append('td').text(pct(r.pt_acc))
  })
}

window.init?.()

// ─── public/blackmail-clamp/init-blackmail-clamp.js ───
!function(){

async function loadData(opts){
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  return await util.getFile(base + 'data.json')
}

var CONDS = [
  {key: 'clean', label: 'No ablation', long: 'Baseline'},
  {key: 'clamped_active', label: 'Ablated', long: 'After ablating eval awareness\nJ-lens vectors'},
]

var METRICS = [
  {key: 'ea', lines: ['Verbalized', 'eval awareness'], label: 'Verbalized eval awareness', color: util.series[0],
   exLabel: 'Verbalized Eval Awareness'},
  {key: 'bl', lines: ['Blackmail', 'rate'],  label: 'Blackmail rate',  color: util.series[5],
   exLabel: 'Attempted Blackmail'},
]

function drawPanel(sel, cond, d){
  var prompts = [...new Set(d.per_prompt.map(r => r.prompt))].sort()
  var c = d3.conventions({
    sel,
    width: 240, height: 230,
    margin: {left: 56, top: 38, right: 10, bottom: 32},
  })
  var x = d3.scaleBand().domain(METRICS.map(d => d.key)).range([0, c.width]).padding(0.32)
  c.y.domain([0, 1])
  c.yAxis.ticks(4).tickFormat(d3.format('.0%'))
  c.drawAxis()
  c.svg.select('.x').remove()
  util.ggPlot(c)
  util.addAxisLabel(c, '', '')
  var lines = cond.long.split('\n')
  var tt = c.svg.append('g.axis').translate([c.width/2, -10 - (lines.length - 1)*14])
    .append('text.axis-label.axis-title').at({textAnchor: 'middle'})
  lines.forEach((ln, i) => tt.append('tspan').text(ln).at({x: 0, dy: i ? 14 : 0}))

  METRICS.forEach(metric => {
    var a = d.agg[cond.key]
    var p = a[metric.key] / a.n
    var ci = a[metric.key + '_ci']
    var bx = x(metric.key), bw = x.bandwidth()
    var cx = bx + bw/2
    c.svg.append('rect')
      .at({x: bx, width: bw, y: c.y(p), height: c.height - c.y(p), fill: metric.color})
    util.barWhisker(c.svg, {x: cx, lo: c.y(ci[0]), hi: c.y(ci[1]), stroke: util.gray[900]})
    prompts.forEach((pr, j) => {
      var row = d.per_prompt.find(r => r.prompt === pr && r.condition === cond.key)
      if (!row) return
      var v = row[metric.key]
      var jitter = 0.45 * bw * ((j / Math.max(prompts.length - 1, 1)) - 0.5)
      c.svg.append('circle.jpt').datum({row, v, metric}).at({
        cx: cx + jitter, cy: c.y(v / row.n),
        r: 2.2, fillOpacity: 0, stroke: '#000', strokeWidth: 1,
      })
    })
    var lab = c.svg.append('text')
      .at({x: cx, y: c.height + 14, textAnchor: 'middle'})
      .st({fontSize: 'var(--fs-body)'})
    metric.lines.forEach((ln, i) =>
      lab.append('tspan').text(ln).at({x: cx, dy: i ? 12 : 0}))
  })
}

function drawCard(sel, ex, metric){
  sel.append('div.ex-label').text(metric.exLabel)
  var body = sel.append('div.excerpt')
  var h = ex.hilite
  if (h && h[0] >= 0){
    body.append('span').text(ex.text.slice(0, h[0]))
    body.append('mark').text(ex.text.slice(h[0], h[1]))
      .st({background: util.tint(metric.color, 0.85)})
    body.append('span').text(ex.text.slice(h[1]))
  } else {
    body.text(ex.text)
  }
}

window.initBlackmailClamp = async function(opts){
  var sel = d3.select('.blackmail-clamp').html('')
  var d = await loadData(opts)
  // 2×2 grid: each row = (panel, excerpt card). Grid row height is driven
  // by the panel SVG; the card stretches to match, so the two columns stay
  // vertically aligned regardless of margin tweaks.
  var grid = sel.append('div.bc-row')
  CONDS.forEach((cond, i) => {
    drawPanel(grid.append('div.panel'), cond, d)
    drawCard(grid.append('div.card'), d.excerpts[i], METRICS[i])
  })
}

}()
window.init?.()

// ─── public/lensapp-panel/init-lensapp-panel.js ───
window.initLensappPanel = async function(opts){
  var slug = opts.slug
  var sel = d3.select(`.lensapp-panel[data-slug="${slug}"]`).html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + slug + '.json')

  // Same orange ramp as feature-examples; text flips to white once bg is dark.
  var orange = t => d3.interpolateOranges(0.1 + 0.55*t)
  function exRow(host, ex, gmax, cls){
    var row = host.append('div.exrow.prompt-block' + (cls ? '.' + cls : ''))
      .at({title: ex.chunks.map(([s]) => s).join('')})
    if (ex.lo > 0) row.append('span.ell').text('…')
    ex.chunks.forEach(([s, a]) => {
      var sp = row.append('span.t').text(s)
      if (a > 0){
        var t = Math.max(0, Math.min(1, a / (gmax || 1)))
        var bg = orange(t)
        sp.st({background: bg}).classed('dark', d3.hsl(bg).l < 0.6)
      }
    })
    if (ex.hi < ex.n) row.append('span.ell').text('…')
  }

  var titleCase = s => s.replace(/\w+/g, (w, i) =>
    i && /^(a|an|and|or|the|in|of|on|to|for)$/i.test(w) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1))

  var card = sel.append('div.card')
  card.append('div.fig-title').text(titleCase(d.label))
  var cols = card.append('div.cols')

  var left = cols.append('div')
  left.append('div.mlabel').text('J-lens top tokens')
  left.append('div.toks').appendMany('span', d.top_tokens).text(t => t)
  left.append('div.mlabel.gap').text('Activating examples')
  d.examples.forEach(ex => exRow(left, ex, d.gmax))
  if (d.prompt_acts){
    left.append('div.mlabel.gap').text('…on an agentic misalignment eval (right)')
    exRow(left, d.prompt_acts, d.prompt_acts.gmax, 'prompt-row')
  }

  var right = cols.append('div')
  right.append('div.mlabel').text('Steering prompt')
  right.append('div.prompt').text(d.prompt)
  right.append('div.mlabel.gap').text('Steering completions')
  var roll = right.append('div.roll')
  d.rollouts.forEach(r => {
    var lab = roll.append('div.rlab')
    lab.append('div').text(r.label)
    if (r.ann) lab.append('div.ann').text(r.ann)
    roll.append('div.rbracket')
    var rtxt = roll.append('div.rtxt').text(r.text)
    if (r.trunc !== false) rtxt.append('span.trunc').text(' […]')
  })
}

window.init?.()

// ─── public/reflection-training/init-reflection-training.js ───
window.initReflectionTraining = async function(opts){
  var sel = d3.select(opts?.sel || '.reflection-training').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'reflection.json')
  // Per-eval wording lives in the baked JSON (reflection-fabrication vs
  // reflection-deception reuse this init); fall back to the fabrication text.
  var L = d.labels || {}
  // 'no substantive report' is baked as a light gray that washes into the
  // ggPlot panel bg — darken render-side so the sliver and legend stay visible
  d.split.classes.forEach(cl => { if (cl.cls == 'no substantive report') cl.color = util.gray[700] })

  // haiku → util.modelColors.haiku per the shared model→color map; orange is
  // otherwise reserved for activation shading. reflection-finetune is a new
  // experiment family — use the jlens series color (blue).
  var modelColor = {haiku: util.modelColors.haiku, reflection: util.tol.blue}
  var modelLabel = {haiku: ['Claude', 'Haiku 4.5'], reflection: ['reflection', 'fine-tune']}
  var H = 310

  var figTitle = opts?.figTitle ?? L.figTitle
  if (figTitle) sel.append('div.fig-title').text(figTitle)
  var row = sel.append('div.panel-row')

  // ── A: dishonesty headline ──
  var pA = row.append('div.panel')
  pA.append('div.fig-title').text('A: ' + (L.titleA ?? 'Reflection training reduces dishonesty'))
  pA.append('div.psub').text(L.subA ??
    `Dishonesty score on the eval (27 cases × 5 reps; n=${d.eval.haiku.n}, n=${d.eval.reflection.n}).`)
  var ms = ['haiku', 'reflection']
  var ymax = d3.max(ms, m => d.eval[m].hi) + 0.04
  var cA = d3.conventions({
    sel: pA.append('div'), width: 244, height: H,
    margin: {left: 52, top: 18, right: 6, bottom: 38},
  })
  var xb = d3.scaleBand().domain(ms).range([0, cA.width]).padding(0.3)
  cA.y.domain([0, ymax])
  cA.xAxis.tickFormat(m => '').tickSize(0)
  cA.yAxis.ticks(5)
  cA.drawAxis(); util.ggPlot(cA)
  cA.svg.selectAll('.x .tick path').remove()
  util.addAxisLabel(cA, '', L.yA ?? 'Dishonesty score →', '', 0, -8)
  ms.forEach(m => {
    var e = d.eval[m], cx = xb(m) + xb.bandwidth()/2
    cA.svg.append('rect').at({x: xb(m), width: xb.bandwidth(), y: cA.y(e.dishonesty),
      height: cA.height - cA.y(e.dishonesty), fill: modelColor[m]})  // lint-ok data-color-js: shared model→color map
    util.barWhisker(cA.svg, {x: cx, lo: cA.y(e.lo), hi: cA.y(e.hi)})
    cA.svg.append('text.num').text(e.dishonesty.toFixed(2))
      .at({x: cx, y: cA.y(e.hi) - 6, textAnchor: 'middle', fontSize: 'var(--fs-small)', fill: util.gray[700]})
    modelLabel[m].forEach((s, i) => cA.svg.append('text').text(s)
      .at({x: cx, y: cA.height + 14 + i*12, textAnchor: 'middle', fontSize: 'var(--fs-small)', fill: util.gray[600]}))
  })

  // ── B: spike-rate token table ──
  var nTok = d.tokens.n_show ?? 18
  var rows = d.tokens.rows.slice(0, nTok)
  var pB = row.append('div.panel')
  pB.append('div.fig-title').text('B: ' + (L.titleB ?? 'Workspace content shifts with finetuning'))
  pB.append('div.psub').text(
    (L.subB ??
      `Top {n} tokens by increase in J-lens top-${d.tokens.topk} ` +
      `spike rate over the last ${d.tokens.n_tail} prompt tokens.`
    ).replace('{n}', nTok))
  var tab = pB.append('table.rktab')
  var hr = tab.append('thead')
  hr.append('tr').html(
    '<th rowspan=2>token</th><th colspan=3>% prompts</th><th colspan=3>% positions</th>')
  hr.append('tr').html(
    '<th>haiku</th><th></th><th>refl.</th><th>haiku</th><th></th><th>refl.</th>')
  tab.append('tbody').appendMany('tr', rows).html(r =>
    `<td class='tk'>${util.ppToken?.(r.tok) ?? r.tok}</td>` +
    `<td>${(r.base_pcase*100).toFixed(0)}</td><td class='arr'>→</td>` +
    `<td>${(r.refl_pcase*100).toFixed(0)}</td>` +
    `<td>${(r.base_ppos*100).toFixed(1)}</td><td class='arr'>→</td>` +
    `<td>${(r.refl_ppos*100).toFixed(1)}</td>`)

  // ── C: grader split ──
  var pC = row.append('div.panel')
  pC.append('div.fig-title').text('C: ' + (L.titleC ?? 'Workspace ablation reverts behavior'))
  pC.append('div.psub').text(L.subC ??
    `Ablate the top-10 ethics directions per position at workspace layers.`)
  var split = pC.append('div.split-wrap')
  var n = d.split.conds.length
  var cC = d3.conventions({
    sel: split.append('div'), width: 290, height: H - 58,
    margin: {left: 52, top: 30, right: 6, bottom: 38},
  })
  var xs = d3.scaleBand().domain(d3.range(n)).range([0, cC.width]).padding(0.18)
  cC.y.domain([0, 1])
  cC.xAxis.tickValues(d3.range(n)).tickFormat(() => '').tickSize(0)
  cC.yAxis.ticks(5).tickFormat(d3.format('.0%'))
  cC.drawAxis(); util.ggPlot(cC)
  cC.svg.selectAll('.x .tick path').remove()
  util.addAxisLabel(cC, '', 'Fraction →', L.axisC ?? 'Mean dishonesty', 0, -8, -8)
  var cum = new Array(n).fill(0)
  d.split.classes.forEach(cl => {
    cl.frac.forEach((f, i) => {
      cC.svg.append('rect').at({x: xs(i), width: xs.bandwidth(),
        y: cC.y(cum[i] + f), height: cC.y(cum[i]) - cC.y(cum[i] + f), fill: cl.color})  // lint-ok data-color-js: ordinal good→bad ramp
      cum[i] += f
    })
  })
  d.split.conds.forEach((c, i) => {
    var cx = xs(i) + xs.bandwidth()/2
    cC.svg.append('text.num').text(d.split.dishonesty[i].toFixed(2))
      .at({x: cx, y: -6, textAnchor: 'middle', fontSize: 'var(--fs-small)', fill: util.gray[700]})
    ;[c.model, c.cond].forEach((s, j) => cC.svg.append('text').text(s)
      .at({x: cx, y: cC.height + 14 + j*12, textAnchor: 'middle', fontSize: 'var(--fs-small)', fill: util.gray[600]}))
  })
  var leg = split.append('div.split-legend')
  // cl.color: bake-side semantic green→red ordinal ramp; lint-ok data-color-js
  leg.appendMany('div.lrow', d.split.classes).html(cl =>
    `<span class='legend-sq' style='background:${cl.color}'></span>` +  // lint-ok data-color-js
    `${cl.cls} <span class='rub'>(${cl.dishonesty == null ? '–' : cl.dishonesty.toFixed(1)})</span>`)
}

window.init?.()

// ─── public/dn-tracecond/init-dn-tracecond.js ───
window.initDnTracecond = async function(opts){
  var sel = d3.select('.dn-tracecond').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  // Same condition palette as the selfreport/ablation figures: gray
  // baseline, red J-space ablation (nofinal = darker red), blue-tint
  // controls. Any condition not in the data is dropped.
  var allConds = [
    {key: 'clean',   label: 'baseline',                            color: util.gray[400]},
    {key: 'ablate',  label: 'J-space ablated',                     color: util.tol.red},
    {key: 'nofinal', label: 'J-space ablated (final pos. spared)', color: '#7a1f1f'},
    {key: 'ortho',   label: 'non-J-space control',                 color: util.tint(util.tol.blue, 0.25)},
    {key: 'random',  label: 'random control',                      color: util.tint(util.tol.blue, 0.55)},
  ]
  var params = new URLSearchParams(location.search)
  var hide = (params.get('hide') || '').split(',')
  var CONDS = allConds.filter(c =>
    d.curves[d.trials[0]][c.key]?.length && !hide.includes(c.key))

  // Shared y across the three panels so the eye can compare.
  var lo = d3.min(d.trials, tt => d3.min(CONDS,
    cn => d3.min(d.curves[tt][cn.key], p => p.mean - p.se)))
  var xi = Object.fromEntries(d.gaps.map((g, j) => [g, j]))

  var row = sel.append('div.tc-row')
  drawSetup(row.append('div.tc-setup'), d.example)
  d.trials.forEach((t, i) => drawPanel(row.append('div.tc-panel'), t, i))
  drawLegend(sel)

  function drawSetup(sel, ex){
    sel.append('div.fig-title').text('A')
    sel.append('div.mlabel').text('Demonstrations')
    var lines = sel.append('div.tc-lines.demo')
    ex.demos.forEach(([cue, fill, out]) => addLine(lines, cue, fill, out, false))
    lines.append('div.tc-ellip').text('…')
    sel.append('div.mlabel').text('Test')
    var test = sel.append('div.tc-lines')
    addLine(test, ex.test[0], ex.test[1], ex.test[2], true)
    var brace = sel.append('div.tc-brace')
    brace.append('span.bspan').text('cue')
    brace.append('span.bspan.fill').text(`k filler words`)
    brace.append('span.bspan').text('outcome')

    function addLine(lines, cue, fill, out, isTest){
      var ln = lines.append('div.tc-line')
      ln.append('span.tc-cue').text(cue)
      fill.forEach(w => ln.append('span.tc-fill').text(w))
      ln.append('span.tc-out').classed('test', isTest).text(isTest ? '?' : out)
    }
  }

  function drawPanel(sel, t, i){
    sel.append('div.fig-title')
      .text(String.fromCharCode(66 + i) + '   ' + t + ' demos / pair')
    var pw = d.trials.length > 3 ? 168 : 220
    var c = d3.conventions({
      sel: sel.append('div'), width: pw, height: 240,
      margin: {left: i ? 14 : 50, right: 8, top: 6, bottom: 36},
    })
    c.x.domain([0, d.gaps.length - 1])
    c.y.domain([lo * 1.05, 0]).clamp(true)
    c.xAxis.tickValues(d3.range(d.gaps.length)).tickFormat(j => d.gaps[j])
    c.yAxis.ticks(5)
    c.drawAxis()
    if (i) c.svg.select('.y').selectAll('text').remove()
    util.ggPlot(c)
    util.addAxisLabel(c, 'gap k (filler words)', i ? '' : 'log P(correct outcome)')

    var px = p => c.x(xi[p.k])
    var line = d3.line().x(px).y(p => c.y(p.mean))
    var area = d3.area().x(px)
      .y0(p => c.y(p.mean - p.se)).y1(p => c.y(p.mean + p.se))
    CONDS.forEach(cn => {
      var pts = d.curves[t][cn.key]
      c.svg.append('path').at({d: area(pts), fill: cn.color, opacity: 0.18})
      c.svg.append('path')
        .at({d: line(pts), fill: 'none', stroke: cn.color, strokeWidth: 2.2})
      c.svg.appendMany('circle', pts)
        .at({r: 2.6, fill: cn.color})
        .translate(p => [px(p), c.y(p.mean)])
    })
  }

  function drawLegend(sel){
    var leg = sel.append('div.legend-row').st({justifyContent: 'center'})
    CONDS.forEach(cn => {
      var item = leg.append('div.legend-item')
      item.append('span.swatch').st({background: cn.color})
      item.append('span').text(cn.label)
    })
  }
}

window.init?.()

// ─── public/dn-exclusion/init-dn-exclusion.js ───
window.initDnExclusion = async function(opts){
  var sel = d3.select('.dn-exclusion').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  // Bar palette: gray baseline, red primed-concept early, lighter red
  // primed-concept late, blue other-concept matched-norm control.
  var COLORS = {
    'clean': util.gray[400],
    'target_p913': util.tol.red,
    'target_p1822': '#d99494',
    'sibling_p913': util.tint(util.tol.blue, 0.45),
  }

  var row = sel.append('div.ex-row')
  drawSetup(row.append('div.ex-setup'), d.example)
  ;[['incl', 'B', 'Name the primed answer'],
    ['excl', 'C', 'Avoid the primed answer']].forEach(([task, letter, title], i) => {
    var bars = d.tasks[task]
    var bw = 104
    var psel = row.append('div.ex-panel')
    psel.append('div.fig-title').text(letter + '   ' + title)
    var c = d3.conventions({
      sel: psel.append('div'),
      width: bw * bars.length, height: 278,
      margin: {left: 46, right: 8, top: 6, bottom: 38},
    })
    c.x.domain([-0.6, bars.length - 0.4])
    c.y.domain([0, 1])
    c.xAxis.tickValues(d3.range(bars.length)).tickFormat(j => '')
    c.yAxis.ticks(5)
    c.drawAxis()
    util.ggPlot(c)
    util.addAxisLabel(c, '', 'P(primed answer)')
    // multi-line tick labels
    c.svg.select('.x').selectAll('.tick').append('foreignObject')
      .at({x: -bw/2 + 3, y: 4, width: bw - 6, height: 36})
      .append('xhtml:div').at({class: 'ex-xtick'}).text((_, j) => bars[j].label)

    var bf = 0.45
    bars.forEach((b, j) => {
      c.svg.append('rect').at({
        x: c.x(j - bf/2), width: c.x(j + bf/2) - c.x(j - bf/2),
        y: c.y(b.mean), height: c.y(0) - c.y(b.mean),
        fill: COLORS[b.key],
      })
      // 95% CI
      c.svg.append('path').at({
        d: `M${c.x(j)},${c.y(b.mean - b.ci)} V${c.y(b.mean + b.ci)} ` +
           `M${c.x(j) - 4},${c.y(b.mean - b.ci)} h8 ` +
           `M${c.x(j) - 4},${c.y(b.mean + b.ci)} h8`,
        stroke: '#333', strokeWidth: 1.2, fill: 'none',
      })
      // per-item dots
      var n = b.vals.length
      c.svg.appendMany('circle', b.vals).at({
        r: 1.8, fill: 'none', stroke: '#444', strokeWidth: 0.5,
      }).translate((v, k) => [
        c.x(j - bf*0.4 + bf*0.8 * k/(n-1)), c.y(v),
      ])
    })
  })

  function drawSetup(sel, ex){
    sel.append('div.fig-title').text('A')
    sel.append('div.mlabel').text('Priming sentence')
    sel.append('div.ex-box.prime-box').text(`Here is a sentence: "${ex.sentence}"`)
    var imp = sel.append('div.ex-implies')
    imp.append('div.ex-arrow').text('↓')
    imp.append('div.ex-implies-label').text('implies')
    var pr = imp.append('div.ex-prime-row')
    pr.append('div.ex-prime').text(ex.prime)
    pr.append('span.ex-anno').text('← Ablate this J-lens vector')
    var qrow = sel.append('div.ex-qrow')
    ;[['Name', ex.name_q], ['Avoid', ex.avoid_q]].forEach(([h, q]) => {
      var col = qrow.append('div.ex-qcol')
      col.append('div.mlabel').text(h)
      col.append('div.ex-box').text(q)
    })
    sel.append('div.mlabel').text('Prefilled response')
    var pf = sel.append('div.ex-box.ex-prefill')
    pf.append('span').text(ex.prefill)
    pf.append('span.ex-meas').text('[sample next token]')
  }
}

window.init?.()

// ─── public/refl-training-examples/init-refl-training-examples.js ───
window.initReflTrainingExamples = async function(opts){
  var sel = d3.select('.refl-training-examples').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var panels = sel.append('div.rte-panels')
    .appendMany('div.rte-panel', d.examples)

  var titles = panels.append('div.fig-title')
  titles.append('span.rte-chip').text((e, i) => String.fromCharCode(65 + i))
  titles.append('span').text(e => e.label.replace(/^\([a-z]\)\s*/i, ''))

  panels.append('div.rte-ctx').text(e => e.context)

  // Preceding transcript: one role-boxed turn per snippet entry. Bracketed
  // tool-call summaries and thinking-tag lines render as muted italic; the
  // remaining lines are the literal code/output in mono.
  panels.append('div.rte-snippet')
    .appendMany('div.rte-turn', e => e.snippet || [])
    .each(function(t){
      var turn = d3.select(this).classed('rte-turn-' + t.role.toLowerCase(), true)
      turn.append('div.rte-role').text(t.role === 'tool' ? 'Tool result' : t.role)
      turn.append('pre.rte-text').selectAll('span')
        .data(t.text.split('\n')).enter().append('span')
        .attr('class', s => (s.trimStart().startsWith('⟨') || /thinking>/.test(s)) ? 'rte-summary' : null)
        .text((s, i) => (i ? '\n' : '') + s)
    })

  // Reflection probe = the Human turn that elicits the reflection.
  var probe = panels.append('div.rte-turn.rte-turn-human')
  probe.append('div.rte-role').text('Human')
  probe.append('div.rte-probe').text(e => e.probe)

  // Reflection = the Assistant's response, shown as prose (sans), not mono.
  var refl = panels.append('div.rte-turn.rte-turn-assistant.rte-reflbox')
  refl.append('div.rte-role').text('Assistant')
  refl.append('div.rte-refl')
    .appendMany('span', e => e.reflection)
    .attr('class', s => s === '…' ? 'rte-ellip' : null)
    .text(s => s === '…' ? ' […] ' : s + ' ')
}

window.init?.()

// ─── public/modulation-readout/init-modulation-readout.js ───
window.initModulationReadout = async (opts) => {
  var sel = d3.select('.modulation-readout').html('')
  var d = await util.getFile(opts.datapath + 'modulation.json')
  var n = d.panels.length
  var pp = t => util.ppCell?.(t) ?? (util.ppToken(t) || t)
  // raw byte-fallback tokens ("\xe2\x80"…) and zero-width chars aren't readable — skip them
  var isJunk = t => /\\x[0-9a-fA-F]{2}/.test(t) || !util.ppToken(t).replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim()
  var cleanTopk = lys => lys.map(l => {
    var topk = l.topk.filter(k => !isJunk(k.t))
    return Object.assign({}, l, {topk, top1: topk[0]?.t ?? l.top1})
  })

  var esc = s => String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))

  // back-compat: old data ships only p.layers at one position
  d.panels.forEach(p => {
    if (p.positions) return
    p.positions = [p.layers]; p.tokens = [p.key_tok_str]; p.key_pos = 0
    var i = p.display_prompt.lastIndexOf(p.key_tok_str)
    p.display_prefix = p.display_prompt.slice(0, i)
    p.display_suffix = p.display_prompt.slice(i + p.key_tok_str.length)
  })

  // clip the linebreak panel's long prompt after "…on this continent," so the
  // three prompt blocks end up about the same height; the trailing newline is
  // kept (it's the lens-read position). Handles both bake shapes — marker
  // display_parts and the all-tokens layout.
  d.panels.forEach(p => {
    var cut
    if (p.display_parts) {
      cut = p.display_parts.findIndex(s => s.includes('on this continent,'))
      if (cut < 0) return
      p.display_parts = p.display_parts.slice(0, cut + 1)
    } else {
      cut = p.tokens.findIndex(t => /continent/.test(t))
      if (cut < 0) return
      while (cut < p.tokens.length - 1 && !/\n/.test(p.tokens[cut])) cut++
      p.display_suffix = ''
    }
    p.tokens = p.tokens.slice(0, cut + 1)
    p.positions = p.positions.slice(0, cut + 1)
    if (p.hl_range) p.hl_range = [Math.min(p.hl_range[0], cut), Math.min(p.hl_range[1], cut + 1)]
    p.key_pos = Math.min(p.key_pos, cut)
  })

  d.panels.forEach(p => { p.positions = p.positions.map(cleanTopk) })
  // drop the leading turn-marker newlines so the prompt box doesn't open with
  // blank lines above "Human:". Token 0 stays in place so position indexing holds.
  d.panels.forEach(p => {
    if (p.display_prefix) p.display_prefix = p.display_prefix.replace(/^\n+/, '')
    else if (p.tokens?.[0]) p.tokens[0] = p.tokens[0].replace(/^\n+/, '')
  })

  function spanify(s, p) {
    var out = esc(s)
    if (p.focus_clause) {
      var fc = esc(p.focus_clause)
      out = out.replace(fc, `<span class="hl">${fc}</span>`)
    }
    return out.replace(/(⟨[^⟩]*⟩|…)/g, m => `<span class="elide">${m}</span>`)
  }

  // Per-panel default layer (display-label → pub index via DISPLAY_LAYERS).
  var DEFAULT_DISPLAY = [79, 88, 71]
  d.panels.forEach((p, pi) => {
    var disp = DEFAULT_DISPLAY[pi]
    if (disp == null) return
    var pub = util.DISPLAY_LAYERS.indexOf(disp)
    if (pub >= 0) p.default_layer = pub
  })

  var row = sel.append('div.mod-row').st({'--ncol': n})
  d.panels.forEach(p => row.append('div.fig-title').text(p.title))

  // panels 0/1 share a teacher-forced response — sync token clicks end-aligned,
  // but only where the two prompts actually overlap (same token at the aligned
  // slot). Clicks outside the overlap, or on any other panel, just select locally.
  var SYNC = [0, 1]
  var states = [], renders = [], tokSels = [], aliasSels = []

  function syncTok(from, i){
    if (!SYNC.includes(from)) return
    var off = d.panels[from].tokens.length - 1 - i
    SYNC.forEach(ti => {
      if (ti === from) return
      var j = d.panels[ti].tokens.length - 1 - off
      if (j < 0 || !d.panels[ti].positions[j]) return
      if (d.panels[ti].tokens[j] !== d.panels[from].tokens[i]) return
      states[ti].pos = j; states[ti].src = null; renders[ti]()
    })
  }
  function pickTok(pi, i, src){
    states[pi].pos = i; states[pi].src = src; renders[pi](); syncTok(pi, i)
  }

  d.panels.forEach((p, pi) => {
    var prompt = row.append('div.display-prompt.prompt-block')
    aliasSels[pi] = null

    if (p.display_parts){
      // scattered scan tokens (linebreak ↵ markers): text parts interleaved
      // with one clickable marker per lens position
      var nodes = []
      p.display_parts.forEach((part, i) => {
        prompt.append('span.nodata').html(spanify(part, p))
        if (i < p.tokens.length) nodes.push(
          prompt.append('span.ptok').text(p.tokens[i])
            .on('click', () => pickTok(pi, i, null)).node())
      })
      tokSels[pi] = d3.selectAll(nodes)
      return
    }

    // human-turn copy of the response sentence (inside the Write "..." quote):
    // clickable aliases that select the matching response position
    var sent = p.tokens.slice(2).join('')
    var qi = sent.length > 1 ? p.display_prefix.indexOf(sent.trim()) : -1
    if (qi >= 0){
      prompt.append('span.nodata').html(spanify(p.display_prefix.slice(0, qi), p))
      var cursor = qi, anodes = []
      p.tokens.forEach((t, ti) => {
        if (ti < 2) return
        var len = (ti === 2 ? t.replace(/^ /, '') : t).length
        anodes.push(prompt.append('span.ptok-alias')
          .text(p.display_prefix.slice(cursor, cursor + len))
          .datum(ti)
          .on('click', (e, ti2) => pickTok(pi, ti2, 'human')).node())
        cursor += len
      })
      aliasSels[pi] = d3.selectAll(anodes)
      prompt.append('span.nodata').html(spanify(p.display_prefix.slice(cursor), p))
    } else {
      prompt.append('span.nodata').html(spanify(p.display_prefix, p))
    }

    var hr = p.hl_range
    tokSels[pi] = prompt.appendMany('span.ptok', d3.range(p.tokens.length))
      .text(i => p.tokens[i])
      .classed('hl', i => hr && i >= hr[0] && i < hr[1])
      .classed('nodata', i => !p.positions[i]?.length)
      .on('click', (e, i) => { if (p.positions[i]?.length) pickTok(pi, i, null) })
    prompt.append('span.nodata').html(spanify(p.display_suffix, p))
  })

  d.panels.forEach((p, pi) => {
    var pair = row.append('div.lenspair')
    var swoop = pair.append('svg.swoop')
    var tbl = pair.append('table.lens')
    tbl.append('tr').html('<th>Layer</th><th>J-lens top-1</th>')
    var keyRows = p.positions[p.key_pos]
    var trs = tbl.appendMany('tr.ly', keyRows)
    trs.append('th').text(l => util.layerLabel(l.layer))
    var tds = trs.append('td')

    // English gloss for the (rare) non-Latin top-1; shown inline so the panel
    // tables stay aligned across all three families.
    var GLOSS = {'дум': 'think'}
    var glossOf = t => { var k = pp(t).trim(); return /[A-Za-z]/.test(k) ? null : GLOSS[k] }

    var detail = pair.append('div.detail')
    var dlyr = detail.append('div.dlyr')
    var dtoks = detail.append('div')

    var st = states[pi] = {pos: p.key_pos, layer: p.default_layer, src: null}

    function render(){
      var lys = p.positions[st.pos]
      tokSels[pi].classed('tok-hit', (_, i) => i === st.pos)
      // outline the human-turn copy only when it was the click origin
      if (aliasSels[pi]) aliasSels[pi].classed('on', ti => st.src === 'human' && ti === st.pos)
      trs.data(lys)
      tds.data(lys).each(function(l){
        var s = d3.select(this).text(pp(l.top1))
        var g = glossOf(l.top1)
        if (g) s.append('span.gloss').text(` (${g})`)
      })
      var l = lys.find(x => x.layer === st.layer) || lys[0]
      st.layer = l.layer
      trs.classed('on', x => x.layer === st.layer)
      dlyr.text(`Layer ${util.layerLabel(st.layer)}`)
      // show as many top-k rows as there are layer rows so the detail box and
      // the lens table come out the same height (no dead white space)
      dtoks.html('').appendMany('div.tok', l.topk.slice(0, lys.length))
        .text(k => pp(k.t))
        .st({'--p': k => k.p + '%'})
      requestAnimationFrame(drawSwoop)
    }
    renders[pi] = render

    function drawSwoop(){
      var pr = pair.node().getBoundingClientRect()
      var tr = trs.filter('.on').node().getBoundingClientRect()
      var dr = dlyr.node().getBoundingClientRect()
      // start 1px inside the selected row's outline so the connector reads as
      // flush (the swoop now paints above the table — see style.css z-index)
      var x0 = Math.round(tr.right - pr.left) - 1
      var y0 = Math.round(tr.top + tr.height/2 - pr.top)
      var x1 = Math.round(dr.left - pr.left) - 1
      var y1 = Math.round(dr.top + dr.height/2 - pr.top)
      var mx = Math.round((x0 + x1) / 2)
      swoop.html('').append('path').at({
        d: `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`,
        fill: 'none', stroke: 'var(--text)', strokeWidth: 1})
    }

    // Layer-row hover is per-panel only (token clicks still sync via SYNC) so
    // each panel can sit at its own DEFAULT_DISPLAY layer.
    trs.on('mouseenter', (e, l) => { st.layer = l.layer; render() })
    render()
  })
}

window.init?.()

// ─── public/modulation-lines/init-modulation-lines.js ───
window.initModulationLines = async ({datapath}) => {
  const sel = d3.select('.modulation-lines').html('')
  const d = await util.getFile(datapath + 'lines.json')
  d.panels.forEach(p => p.series.forEach((s, i) => s.color = util.series[i % util.series.length]))

  sel.append('div.head').append('div.fig-title').text(d.title)

  const innerW = 300, H = 320
  const row = sel.append('div.panels')
  // when the panels stack (narrow container), give every panel the wide margin
  // + y-axis title so the stacked plot areas line up vertically
  const stacked = getComputedStyle(row.node()).flexDirection === 'column'

  // labelPos: [x, y, lines] — px in panel-0 plot coords, hand-placed via ?tune=1 drag (copy panel offsets back here)
  var labelPos = {
    'Category instance': [11, 32, ['Category', 'instance']],
    'Math expression':   [143, 39, ['Math', 'expression']],
    'Line width':        [142, 174, ['Line', 'width']],
  }

  // ?tune=1 on the standalone page makes these labels draggable (util.dragTune)
  var tuneKeys = {'Category instance': 'cat-instance', 'Math expression': 'math-expr', 'Line width': 'line-width'}
  var tuneItems = []

  d.panels.forEach((p, pi) => {
    // The first panel carries the rotated y label; its left margin has to
    // cover the label's text height plus the addAxisLabel offset so the
    // figure's overflow-x: clip doesn't shave it.
    const M = pi === 0 || stacked
      ? {left: 56, right: 16, top: 28, bottom: 36}
      : {left: 42, right: 16, top: 28, bottom: 36}
    const c = d3.conventions({
      sel: row.append('div'), width: innerW,
      height: H - M.top - M.bottom, margin: M,
    })
    c.x = d3.scalePoint().domain(d.models).range([0, c.width]).padding(0.28)
    c.xAxis.scale(c.x)
    c.y.domain([0, 1])
    c.yAxis.tickFormat(d3.format('.0%')).tickValues(d3.range(0, 1.01, 0.2))

    c.drawAxis()
    util.ggPlot(c)
    c.svg.selectAll('.x .tick path').remove()
    util.addAxisLabel(c, '', pi === 0 || stacked ? d.ylabel : '', p.label, 0, -14)

    const line = d3.line().x((_, i) => c.x(d.models[i])).y(v => c.y(v))
    p.series.forEach(s => {
      c.svg.append('path.series.line-series').at({d: line(s.y), stroke: s.color, 'data-series': s.label})
      c.svg.appendMany('circle.pt', s.y)
        .at({r: 3.5, fill: s.color})
        .translate((v, i) => [c.x(d.models[i]), c.y(v)])
    })

    if (pi === 0) p.series.forEach(s => {
      var [x, y, lines] = labelPos[s.label]
      var t = c.svg.append('text.dlabel')
        .translate([x, y])
        .at({textAnchor: 'start', 'data-series': s.label})
        .st({fill: s.color, paintOrder: 'stroke', stroke: '#EAECED', strokeWidth: 1, strokeLinejoin: 'round'})  // lint-ok hex-js: ggPlot bg halo
      lines.forEach((ln, li) => t.append('tspan').text(ln).at({x: 0, dy: li ? '1.15em' : '.32em'}))
      tuneItems.push({sel: t, key: tuneKeys[s.label],
        get: () => ({x, y}),
        set: q => t.translate([q.x, q.y])})
    })
  })
  util.bindSeriesHover(sel)
  util.dragTune(tuneItems, 'modulation-lines')
}

window.init?.()

// ─── public/modulation-prompts/init-modulation-prompts.js ───
window.initModulationPrompts = async ({datapath}) => {
  const sel = d3.select('.modulation-prompts').html('')
  const d = await util.getFile(datapath + 'data.json')
  if (!d3.select('.tooltip').size()) d3.select('body').append('div.tooltip.tooltip-hidden')
  const tt = d3.select('.tooltip')

  sel.append('div.head').append('div.fig-title').text(d.title)

  const leg = sel.append('div.legend-row')
  d.groups.forEach(g => {
    const it = leg.append('div.legend-item')
    it.append('span.legend-sq').st({background: g.color})
    it.append('span').text(g.label)
  })

  const innerW = 264, innerH = 180
  const grid = sel.append('div.mp-scroll').append('div.grid')
  // deterministic per-dot offset so the figure is stable across reloads
  const jitter = (i, n) => n <= 1 ? 0 : (i / (n - 1) - 0.5) * 0.62

  d.panels.forEach(p => {
    const isLeft = p.mi === 0, isTop = p.fi === 0
    const fam = d.families[p.fi]
    const M = {
      left: isLeft ? 60 : 28,
      right: 8,
      top: isTop ? 22 : 6,
      bottom: p.fi === d.families.length - 1 ? 30 : 18,
    }
    const c = d3.conventions({
      sel: grid.append('div.cell'),
      width: innerW, height: innerH, margin: M, layers: 's',
    })
    const x = d3.scaleBand().domain(d3.range(d.groups.length))
      .range([0, c.width]).paddingInner(0.28).paddingOuter(0.14)
    c.y.domain([0, 1])
    c.yAxis.ticks(5).tickFormat(d3.format('.0%'))
    c.x.domain([0, 1])
    c.drawAxis()
    c.svg.select('.x').remove()
    util.ggPlot(c)

    // column header (model) on top row; row header (family + metric) on left col
    if (isTop) c.svg.append('text.col-head')
      .at({x: c.width/2, y: -8, textAnchor: 'middle'}).text(d.models[p.mi])
    if (isLeft) util.addAxisLabel(c, '', `${fam.label}  (${fam.metric})`, '', 0, -14)

    // bars (group means) — focus/dismissal heights are the modulation-lines values
    p.groups.forEach((g, gi) => {
      if (g.mean == null) return
      c.svg.append('rect.bar').at({
        x: x(gi), width: x.bandwidth(),
        y: c.y(g.mean), height: c.height - c.y(g.mean),
        fill: d.groups[gi].color, fillOpacity: 0.45,
      })
    })

    // dots (per-phrasing) with hover tooltip
    p.groups.forEach((g, gi) => {
      const cx = x(gi) + x.bandwidth()/2
      c.svg.appendMany('circle.dot', g.dots)
        .at({r: 3.2, fill: d.groups[gi].color, stroke: 'white', strokeWidth: 0.8})
        .translate((dot, i) => [cx + jitter(i, g.dots.length) * x.bandwidth(), c.y(dot.y)])
        .on('mouseover', (e, dot) => {
          tt.classed('tooltip-hidden', false).html('')
          tt.append('div.mp-tt-var').text(dot.v)
          tt.append('div.mp-tt-text').text(`"${dot.t || ''}"`)
          tt.append('div.mp-tt-val').text(d3.format('.1%')(dot.y))
        })
        .on('mousemove', e => {
          var bb = tt.node().getBoundingClientRect()
          tt.st({
            left: d3.clamp(8, e.clientX - bb.width/2, innerWidth - bb.width - 8) + 'px',
            top: (e.clientY + 14) + 'px',
          })
        })
        .on('mouseleave', () => tt.classed('tooltip-hidden', true))
    })

    // none floor
    if (p.none != null) c.svg.append('line.floor').at({
      x1: 0, x2: c.width, y1: c.y(p.none), y2: c.y(p.none),
    })

    // x ticks (group labels) on bottom row only
    if (p.fi === d.families.length - 1)
      c.svg.append('g.x-ticks').translate([0, c.height + 6])
        .appendMany('text.tick-label', d.groups)
        .at({textAnchor: 'middle', x: (g, i) => x(i) + x.bandwidth()/2, dy: '0.9em'})
        .text(g => g.label)
  })
}

window.init?.()

// ─── public/latent-patching/init-latent-patching.js ───
window.initLatentPatching = async function(opts){
  var sel = d3.select(opts?.sel || '.latent-patching').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  // Match flex-generalization-example: orange = the swapped/patched concept.
  var CLEAN = util.gray[500], PATCHED = util.tol.orange
  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  var allow = s => esc(s)
    .replaceAll('&lt;b&gt;','<b>').replaceAll('&lt;/b&gt;','</b>')
    .replaceAll('&lt;i&gt;','<i>').replaceAll('&lt;/i&gt;','</i>')
    .replaceAll('&lt;br&gt;','<br>')

  var panels = sel.appendMany('div.lp-panel', d.panels)

  // ── left: title + prompt + swap ──
  var left = panels.append('div.lp-left')
  left.append('div.fig-title').text(p => p.title)
  var prompt = left.append('div.lp-prompt')
  // Mark the read position (last prompt token) — that's where the top-5
  // log-probs in the tables are measured. Last word, or last char for the
  // no-space Chinese prompt.
  var splitHit = p => p.prompt.match(/^([\s\S]*?)([A-Za-z0-9]+|.)$/).slice(1)
  prompt.append('span').text(p => splitHit(p)[0])
  prompt.append('span.tok-hit').text(p => splitHit(p)[1])
  left.filter(p => p.gloss).append('div.lp-gloss').text(p => p.gloss)
  left.append('div.lp-swaps').html(p =>
    'J-lens coordinate swap: ' + p.swap.map(s =>
      `${esc(s[0])} → <span style="color:${PATCHED}">${esc(s[1])}</span>`).join(', '))

  // ── right: clean / patched bar tables + annotation ──
  var right = panels.append('div.lp-right')
  function col(side, label, color, barBg){
    var c = right.append('div.lp-col.bar-table').classed(side, true)
    c.append('h6.mlabel').html((p, i) =>
      `<span class="swatch" style="background:${color}"></span> ${esc(label)}` +
      (i == 0 && side == 'clean' ? ` <span class="hdr-sub">(log prob)</span>` : ''))
    c.appendMany('div.bar-row', p => {
      var rows = p[side], maxP = d3.max([...p.clean, ...p.patched], e => Math.exp(e.lp))
      return rows.map(e => ({...e, w: Math.exp(e.lp) / maxP * 100}))
    }).at({title: e => util.ppCell(e.t).trim()})
      .html(e => `<div class="bar" style="width:${e.w.toFixed(1)}%;background:${barBg}"></div>` +
                 `<span class="t">${esc(util.ppCell(e.t).trim())}</span><span class="val">${e.lp.toFixed(2)}</span>`)
  }
  col('clean', 'Clean', CLEAN, util.gray[200])
  col('patched', 'Swapped', PATCHED, util.tint(PATCHED, 0.65))
  right.append('div.lp-anno').html(p => allow(p.anno))

  if (sel.classed('latent-patching')) util.colorCaption(sel, {clean: util.gray[600], swapped: PATCHED})
}

window.init?.()

// ─── public/multihop-swap-success/init-multihop-swap-success.js ───
window.initMultihopSwapSuccess = async function(opts){
  var sel = d3.select('.multihop-swap-success').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  // when the panel-row stacks (container < 768px), each panel redraws to fill
  // the available width so both align and keep full-size labels
  var fig = sel.node().closest('figure')
  var cs = fig && getComputedStyle(fig)
  var avail = fig ? fig.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) : 0
  var stackW = avail && avail < 768 ? avail : 0

  // Side-by-side at native size fits inside class='wide'; .panel-row's
  // generic 768px @container threshold would otherwise stack the panels and
  // trigger a fitMount downscale (which is what made everything tiny).
  var row = sel.append('div.panel-row').st({flexDirection: 'row'})
  drawBars(row.append('div.bars'), d)
  drawOnset(row.append('div.onset'), d.onset)

  function drawBars(sel, d){
    var c = d3.conventions({
      sel, width: stackW ? stackW - 72 : 280, height: 280,
      margin: {left: 58, right: 14, top: 32, bottom: 32},
    })
    var x = d3.scaleBand().domain(d.models.map(m => m.label))
      .range([0, c.width]).paddingInner(0.35).paddingOuter(0.18)
    c.y.domain([0, 1])
    c.yAxis.ticks(5).tickFormat(d3.format('.0%'))
    c.drawAxis()
    c.svg.select('.x').remove()
    util.ggPlot(c)
    util.addAxisLabel(c, '', 'Swap success rate →', 'How often the swap works', 0, -8)

    c.svg.appendMany('text.xlab', d.models)
      .text(m => m.label).translate(m => [x(m.label) + x.bandwidth()/2, c.height + 16])
      .at({textAnchor: 'middle'})

    var g = c.svg.appendMany('g.mbar', d.models)
      .translate(m => [x(m.label), 0])
    g.append('rect').at({
      width: x.bandwidth(), y: m => c.y(m.p), height: m => c.height - c.y(m.p),
      fill: util.gray[400],
    })
    g.each(function(m){
      util.barWhisker(d3.select(this), {x: x.bandwidth()/2, lo: c.y(m.p - m.se), hi: c.y(m.p + m.se)})
    })
    g.append('text.val').text(m => d3.format('.0%')(m.p))
      .translate(m => [x.bandwidth()/2, c.y(m.p + m.se) - 5])
      .at({textAnchor: 'middle'})
  }

  function drawOnset(sel, on){
    var kinds = [
      {key: 'intermediate', label: 'Intermediate swap', color: util.tol.blue},
      {key: 'target',       label: 'Answer swap',       color: util.tol.red},
    ]
    var c = d3.conventions({
      sel, width: stackW ? stackW - 66 : 420, height: 280,
      margin: {left: 58, right: 8, top: 32, bottom: 32},
    })
    var lo = d3.min(kinds, k => d3.min(on.l, (_, i) => on.mean[k.key][i] - on.se[k.key][i]))
    var hi = d3.max(kinds, k => d3.max(on.l, (_, i) => on.mean[k.key][i] + on.se[k.key][i]))
    c.x.domain(d3.extent(on.l))
    c.y.domain([lo, hi]).nice()
    c.xAxis.ticks(Math.ceil(on.l.length/2)).tickFormat(util.layerLabel)
    c.yAxis.ticks(5)
    c.drawAxis()
    util.ggPlot(c)
    util.addAxisLabel(c, 'Swap window upper layer (reindexed) →', 'Δ log-prob (expected − original) →', 'When the swap takes effect', 0, -8)

    var line = d3.line().x((_, i) => c.x(on.l[i])).y(v => c.y(v))
    var area = d3.area().x((_, i) => c.x(on.l[i]))
      .y0((d, i) => c.y(d.m - d.s)).y1((d, i) => c.y(d.m + d.s))
    kinds.forEach(k => {
      var band = on.l.map((_, i) => ({m: on.mean[k.key][i], s: on.se[k.key][i]}))
      c.svg.append('path.se')
        .at({d: area(band), fill: k.color, stroke: 'none'})
        .st({opacity: 0.18})
    })
    kinds.forEach(k => {
      c.svg.append('path.mean')
        .at({d: line(on.mean[k.key]), fill: 'none', stroke: k.color, strokeWidth: 3})
    })

    var labelPos = {  // [anchorIdx, dx, dy, textAnchor] — hand-placed
      intermediate: [6, -8, -34, 'end'],
      target:       [8,  0,  36, 'middle'],
    }
    kinds.forEach(k => {
      var [ai, dx, dy, anchor] = labelPos[k.key]
      c.svg.append('text.dlabel').text(k.label)
        .translate([c.x(on.l[ai]) + dx, c.y(on.mean[k.key][ai]) + dy])
        .at({dy: '.32em', textAnchor: anchor})
        .st({fill: k.color, paintOrder: 'stroke', stroke: '#EAECED', strokeWidth: 2, strokeLinejoin: 'round'})  // lint-ok hex-js: ggPlot bg halo
    })
  }
}

window.init?.()

// ─── public/repeat-switch/init-repeat-switch.js ───
window.initRepeatSwitch = async function(opts){
  var sel = d3.select('.repeat-switch').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  var bandLbl = `L${util.layerLabel(d.layers[0])}–${util.layerLabel(d.layers[1])}`

  sel.append('div.fig-title').text('Swapping the decoded strategy between prompts flips the model’s choice')

  // val = log-prob. Probability bars only on Model output rows (showBars) — the
  // lens-median probs are mostly <1% and render as slivers.
  function barTable(host, entries, mark, cls, showBars){
    var t = host.append('div.rs-bars.bar-table' + (cls || ''))
    t.appendMany('div.bar-row', entries).at({title: e => util.ppCell(e.t).trim()}).html(e => {
      var c = mark ? (e.abl ? ' abl' : e.don ? ' don' : '') : ''
      var bar = showBars ? `<div class="bar" style="width:${(Math.exp(e.lp)*100).toFixed(1)}%"></div>` : ''
      return bar +
             `<span class="t${c}">${esc(util.ppCell(e.t).trim())}</span>` +
             `<span class="val">${e.lp.toFixed(2)}</span>`
    })
  }

  var grid = sel.append('div.rs-grid')
  d.panels.forEach((p, i) => {
    var col = grid.append('div.rs-panel')
    col.append('div.mlabel.rs-panel-label').text(`${p.label} prompt`)
    var body = esc(p.promptBody)
    var dot = body.lastIndexOf('.')
    body = body.slice(0, dot) + '<span class="tok-hit">.</span>' + body.slice(dot + 1)
    col.append('div.rs-prompt.prompt-block').html(
      `<span class="prompt-role">Human:</span> ${body}\n\n` +
      `<span class="prompt-role">Assistant:</span> <span class="prompt-gen">${esc(p.cleanChoice)}</span>`)

    var tbl = col.append('div.rs-table')
    tbl.append('div.rs-corner')
    tbl.append('div.rs-colhead').text('Original')
    tbl.append('div.rs-colhead').text('After plan swap')

    tbl.append('div.rs-rowlab').html(`<span class="rs-lab1">J-lens decode at "."</span><br>${bandLbl} median`)
    barTable(tbl, p.lensBefore, true)
    barTable(tbl, p.lensAfter, true)

    tbl.append('div.rs-rowlab.rs-sep').text('Model output')
    barTable(tbl, p.outBefore, false, '.rs-sep', true)
    barTable(tbl, p.outAfter, false, '.rs-sep', true)
  })

  // Legend lives in the gdoc figcaption — color the cue words to match the
  // .abl (red strikethrough) / .don (teal) token styling in the tables.
  util.colorCaption(sel, {removed: 'var(--tol-red)', installed: 'var(--tol-teal)'})
}

window.init?.()

// ─── public/verbal-report/init-verbal-report.js ───
window.initVerbalReport = async function(opts){
  var sel = d3.select('.verbal-report').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  var ttSel = d3.select('.tooltip')

  var main = sel.append('div.vr-main')

  // ── example block (left) ──
  var ex = d.example
  var top = main.append('div.vr-example')
  top.append('div.fig-title').text(`"Think of a ${ex.category}"`)
  top.append('div.vr-prompt.prompt-block').html(
    `<span class="prompt-role">Human:</span> ${esc(ex.promptBody)}\n\n` +
    `<span class="prompt-role">Assistant</span><span class="tok-hit">:</span>`)

  function barTable(host, label, entries, isLens){
    var t = host.append('div.vr-bars.bar-table').classed('vr-lens', isLens)
    var h = t.append('h6')
    h.append('span.swatch').st({background: isLens ? util.tol.orange : util.gray[400], marginRight: 5})
    h.append('span').text(label)
    var max = d3.max(entries, e => Math.exp(e.lp))
    var bg = isLens ? util.tint(util.tol.orange, 0.7) : 'var(--gray-200)'
    t.appendMany('div.bar-row', entries).at({title: e => util.ppCell(e.t).trim()}).html(e =>
      `<div class="bar" style="width:${(Math.exp(e.lp)/max*100).toFixed(1)}%;background:${bg}"></div>` +
      `<span class="t">${esc(util.ppCell(e.t).trim())}</span><span class="val">${e.lp.toFixed(2)}</span>`)
  }
  top.append('div.mlabel.vr-section').text('Original')
  var c1 = top.append('div.vr-cols')
  barTable(c1, `J-lens ${ex.rhoLayer}`, ex.lensTop, true)
  barTable(c1, "Model's next-token logits", ex.outTop)
  top.append('div.mlabel.vr-section').text(`Swapping "${ex.swapAnswer}" → "${ex.swapTarget}"`)
  var c2 = top.append('div.vr-cols')
  barTable(c2, `J-lens ${ex.rhoLayer}`, ex.lensTopAfter, true)
  barTable(c2, "Model's next-token logits", ex.outTopAfter)

  // ── quant block (right column) ──
  var q = d.quant
  var bot = main.append('div.vr-quant')
  bot.append('div.fig-title').text(`Across ${q.categories?.length || 14} categories`)

  // ρ at three layers
  var cL = d3.conventions({
    sel: bot.append('div'), width: 200, height: 150,
    margin: {left: 50, right: 8, top: 2, bottom: 28},
  })
  var xL = d3.scaleBand().domain(q.rhos.map(r => r.L)).range([0, cL.width])
    .paddingInner(0.35).paddingOuter(0.18)
  cL.y.domain([0, 1]).clamp(true)
  cL.yAxis.ticks(5)
  cL.drawAxis()
  cL.svg.select('.x').remove()
  util.ggPlot(cL)
  util.addAxisLabel(cL, 'Layer →', '')
  var yLab = cL.svg.select('.y').append('g').translate([-38, cL.height/2])
    .append('text.axis-label').at({textAnchor: 'middle', transform: 'rotate(-90)'})
  yLab.append('tspan').text('Lens vs output rank').at({x: 0})
  yLab.append('tspan').text('Spearman ρ →').at({x: 0, dy: '1.1em'})
  cL.svg.appendMany('text.xlab', q.rhos)
    .text(r => r.L).translate(r => [xL(r.L) + xL.bandwidth()/2, cL.height + 14])
    .at({textAnchor: 'middle'})
  cL.svg.appendMany('rect.vr-med', q.rhos)
    .at({x: r => xL(r.L), width: xL.bandwidth(), y: r => cL.y(d3.median(r.rhos)),
      height: r => cL.height - cL.y(d3.median(r.rhos)), fill: util.gray[400]})
  var rng = d3.randomUniform.source(d3.randomLcg(0))(-0.18, 0.18)
  var trunc = s => s && s.length > 200 ? s.slice(0, 200) + '…' : (s || '')
  function appendTopk(host, lt){
    if (!lt?.tokens?.length) return
    var toks = host.append('div.toks')
    lt.tokens.forEach((t, ti) => {
      var pp = util.ppToken?.(t) ?? t
      toks.append('span.tok').text(pp).classed('hl', lt.hit_idx?.includes(ti))
    })
  }
  function placeTT(e){
    var bb = ttSel.node().getBoundingClientRect()
    ttSel.st({left: d3.clamp(20, e.clientX - bb.width/2, innerWidth - bb.width - 20) + 'px',
              top: (innerHeight > e.clientY + 20 + bb.height ? e.clientY + 20 : e.clientY - bb.height - 20) + 'px'})
  }
  q.rhos.forEach(r => {
    var x0 = xL(r.L), w = xL.bandwidth()
    var cats = r.cats || [], prompts = r.prompts || [], topks = r.lens_topk || []
    cL.svg.appendMany('circle.jpt', r.rhos.map((v, i) => ({v, L: r.L, cat: cats[i], pr: prompts[i], lt: topks[i]})))
      .at({cx: () => x0 + w/2 + rng()*w, cy: o => cL.y(o.v), r: 2,
        fillOpacity: 0, stroke: '#000', strokeWidth: 1})
  })
  var lastL
  util.nearestHover(cL.svg, cL.svg.selectAll('circle.jpt'), {
    radius: 40,
    onHover: (o, el, e) => {
      if (el !== lastL){
        lastL = el
        ttSel.classed('tooltip-hidden', false).html('')
        ttSel.append('div').html(`<b>${o.L}</b> · ${o.cat || ''} · ρ = ${o.v}`)
        if (o.pr) ttSel.append('div.prompt-block').text(trunc(o.pr))
        appendTopk(ttSel, o.lt)
      }
      placeTT(e)
    },
    onLeave: () => { lastL = null; ttSel.classed('tooltip-hidden', true) },
  })

  // before→after slope (log y, rank=1 at top)
  var cR = d3.conventions({
    sel: bot.append('div'), width: 200, height: 150,
    margin: {left: 44, right: 12, top: 2, bottom: 28},
  })
  var xR = d3.scalePoint().domain(['before', 'after']).range([0, cR.width]).padding(0.3)
  cR.y = d3.scaleLog().domain([1, 1000]).range([0, cR.height]).clamp(true)
  cR.yAxis.scale(cR.y).tickValues([1, 10, 100, 1000]).tickFormat(d => d >= 1000 ? '1k+' : d)
  cR.drawAxis()
  cR.svg.select('.x').remove()
  util.ggPlot(cR)
  util.addAxisLabel(cR, '', 'Candidate output rank →')
  cR.svg.appendMany('text.xlab', ['No swap', 'After swap'])
    .text(s => s).translate((s,i) => [xR(i ? 'after' : 'before'), cR.height + 14])
    .at({textAnchor: 'middle'})
  var rngR = d3.randomUniform.source(d3.randomLcg(1))(-0.5, 0.5)
  var jw = xR.step() * 0.14
  q.pairs.forEach(p => { p.j0 = rngR()*jw; p.j1 = rngR()*jw })
  var slopes = cR.svg.appendMany('path.slope', q.pairs)
    .at({d: p => `M${xR('before') + p.j0},${cR.y(p.before)} L${xR('after') + p.j1},${cR.y(p.after)}`,
      stroke: util.gray[600], strokeWidth: 0.6, opacity: 0.35})
    .st({mixBlendMode: 'multiply'}).nodes()
  var cB = cR.svg.appendMany('circle.jpt', q.pairs.map((p, i) => ({p, i, side: 'before'})))
    .at({cx: o => xR('before') + o.p.j0, cy: o => cR.y(o.p.before), r: 2,
      fillOpacity: 0, stroke: '#000', strokeWidth: 1}).nodes()
  var cA = cR.svg.appendMany('circle.jpt', q.pairs.map((p, i) => ({p, i, side: 'after'})))
    .at({cx: o => xR('after') + o.p.j1, cy: o => cR.y(o.p.after), r: 2,
      fillOpacity: 0, stroke: '#000', strokeWidth: 1}).nodes()
  var lastR, hovEls = []
  var clearHov = () => { hovEls.forEach(n => n.classList.remove('hov')); hovEls = [] }
  util.nearestHover(cR.svg, cR.svg.selectAll('circle.jpt'), {
    radius: 40,
    onHover: (o, el, e) => {
      if (el !== lastR){
        lastR = el
        clearHov()
        hovEls = [slopes[o.i], cB[o.i], cA[o.i]]
        hovEls.forEach(n => n.classList.add('hov'))
        var p = o.p
        ttSel.classed('tooltip-hidden', false).html('')
        ttSel.append('div').html(`<b>${p.cat}</b>${p.word ? ' · ' + esc(p.word) : ''}`)
        ttSel.append('table.tt-pair').html(
          `<tr><td class=k>no swap</td><td>rank <b>${p.before}</b></td></tr>` +
          `<tr><td class=k>after swap</td><td>rank <b>${p.after}</b></td></tr>`)
        if (p.prompt) ttSel.append('div.prompt-block').text(trunc(p.prompt))
        appendTopk(ttSel, p.lens_topk)
      }
      placeTT(e)
    },
    onLeave: () => { lastR = null; clearHov(); ttSel.classed('tooltip-hidden', true) },
  })
}

window.init?.()

// ─── public/verbal-introspection/init-verbal-introspection.js ───
window.initVerbalIntrospection = async function(opts){
  var sel = d3.select('.verbal-introspection').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var SLOT = util.tol.blue, GREY = util.gray[500], HL = 'var(--hl-yellow)'
  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  var main = sel.append('div.vi-main')
  var left = main.append('div.vi-left')
  var right = main.append('div.vi-right')

  // ── prompt box ──
  left.append('div.fig-title').text('Verbal introspection of injected workspace content')
  var box = left.append('div.vi-prompt.prompt-block')
  d.turns.forEach((t, i) => {
    var p = box.append('div.vi-turn')
    p.append('span.prompt-role').text(t.role + ': ')
    if (i === d.spanTurnIdx){
      var s = p.append('span.hl')
      s.append('span').text(d.spanPre)
      s.append('span.tok-hit').text(',')
      s.append('span').text(d.spanPost)
    } else if (i === d.turns.length - 1){
      p.append('span').text(d.lastBody)
      p.append('span.hit-c.tok-hit').text('"')
    } else {
      p.append('span').text(t.body)
    }
  })

  // ── 3 bar tables ──
  var cols = left.append('div.vi-cols')
  function table(l1, l2, rows, swatch, barColor, isLens){
    var c = cols.append('div.vi-col.bar-table').classed('vi-lens', !!isLens)
    var h = c.append('h6')
    var l = h.append('div')
    l.append('span.swatch').st({background: swatch, marginRight: 5})
    l.append('span').html(l1)
    h.append('div.cond').html(l2)
    var maxP = d3.max(rows, e => Math.exp(e.lp))
    c.appendMany('div.bar-row', rows).at({title: e => util.ppCell(e.t).trim()}).html(e =>
      `<div class="bar" style="width:${(Math.exp(e.lp)/maxP*100).toFixed(1)}%;background:${barColor}"></div>` +
      `<span class="t">${esc(util.ppCell(e.t).trim())}</span><span class="val">${e.lp.toFixed(2)}</span>`)
  }
  table(`J-lens ${esc(d.lensLabel)} at <span class="tok-hit">,</span>`, 'Original', d.tables.lensTgt, util.tol.orange, util.tint(util.tol.orange, 0.7), true)
  table('Next-token logits at <span class="hit-c tok-hit">&quot;</span>', 'Original', d.tables.outClean, util.gray[400], 'var(--gray-200)')
  table('Next-token logits at <span class="hit-c tok-hit">&quot;</span>', `After <span class="hl">injecting</span> "${esc(d.exampleConcept)}"`, d.tables.outTgt, util.tol.red, util.tint(util.tol.red, 0.7))

  // ── right: median RR ± IQR vs strength ──
  right.append('div.fig-title').text(`Injection across ${d.n} concepts`)
  var m = {left: 50, right: 14, top: 8, bottom: 36}
  var ch = d3.clamp(220, left.node().offsetHeight - right.node().offsetHeight - m.top - m.bottom, 520)
  var c = d3.conventions({
    sel: right.append('div'), width: 280, height: ch,
    margin: m,
  })
  c.x.domain([0, d3.max(d.curve.s)])
  c.y = d3.scaleLog().domain([1e-4, 1]).range([c.height, 0]).clamp(true)
  c.xAxis.tickValues([0, 0.01, 0.02]).tickFormat(v => v.toFixed(2))
  c.yAxis.scale(c.y).tickValues([1e-4, 1e-3, 1e-2, 1e-1, 1])
    .tickFormat(v => v >= 1 ? '1' : v.toFixed(-Math.log10(v)))
  c.drawAxis()
  util.ggPlot(c)
  util.addAxisLabel(c, 'Steering strength s →', 'Median reciprocal rank of injected concept →')
  d3.select(c.svg.select('.y .axis-label').node().parentNode).translate([-38, c.height/2 - 15])

  var area = d3.area().x((_, i) => c.x(d.curve.s[i])).y0(v => c.y(v[0])).y1(v => c.y(v[1]))
  var line = d3.line().x((_, i) => c.x(d.curve.s[i])).y(v => c.y(v))
  // labelPos: [anchorIdx, dx, dy, textAnchor] — hand-placed
  ;[
    ['other', GREY, 'Other positions', [5, -6, -16, 'end']],
    ['slot',  SLOT, 'At the open quote', [4, -26, 16, 'end']],
  ].forEach(([k, col, lab, [ai, dx, dy, anchor]]) => {
    var q = d.curve[k]
    c.svg.append('path').at({d: area(q.q25.map((lo, i) => [lo, q.q75[i]])), fill: col, opacity: 0.18})
    c.svg.append('path.line-series').at({d: line(q.q50), fill: 'none', stroke: col, strokeWidth: 1.8, 'data-series': k})
    // filled median anchors — the curve's "key statistic" marker per style guide
    c.svg.appendMany('circle', q.q50).at({cx: (_, i) => c.x(d.curve.s[i]), cy: v => c.y(v), r: 2.4, fill: col})
    c.svg.append('text.dlabel').text(lab)
      .at({x: c.x(d.curve.s[ai]) + dx, y: c.y(q.q50[ai]) + dy, dy: '.32em', textAnchor: anchor, fontSize: 'var(--fs-small)', 'data-series': k})
      .st({fill: col, paintOrder: 'stroke', stroke: '#fff', strokeWidth: 1, strokeLinejoin: 'round'})
  })
  util.bindSeriesHover(right)
  util.dragTuneLabels(sel, 'verbal-introspection')
  util.colorCaption(sel, {
    'user turn': {bg: HL},
    'open quotation mark': {bg: util.tint(SLOT, 0.85)},
    'every other position': {bg: util.tint(GREY, 0.85)},
  })
}

window.init?.()

// ─── public/top-down-summoning/init-top-down-summoning.js ───
window.initTopDownSummoning = async function(opts){
  var sel = d3.select(opts?.sel || '.top-down-summoning').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var spec = opts?.spec || 'main'
  var d = await util.getFile(base + spec + '.json')

  var ORANGE = util.tol.orange
  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  var strength = r => r == null ? 0 : r <= 2 ? 1.0 : r <= 5 ? 0.6 : 0.3
  var DARK = d3.color(ORANGE).darker(0.6).formatHex()
  var bg = (r, hex) => r == null ? 'transparent'
    : strength(r) >= 1 ? DARK : util.tint(hex, 1 - strength(r))
  // flip to white text when the activation fill gets dark enough that black text
  // muddies (matches the activation-ramp rule in CLAUDE-FIGURE-STYLE-GUIDE.md)
  var hot = r => r != null && strength(r) > 0.6

  // older bake shape: per-panel q1/q2 instead of a conds list
  d.panels.forEach(p => {
    if (p.conds) return
    p.conds = ['q1', 'q2'].map(c => ({kind: c,
      label: c == 'q1' ? 'Next-word question' : 'Property question',
      q: p[c].q, gen: p[c].gen, stim: p[c].stim,
      counts: [{targets: p.targets, nHit: p[c].nHit, nTot: p[c].nTot}]}))
  })

  var nRows = d3.max(d.panels, p => 1 + d3.sum(p.conds, c => (c.label ? 1 : 0) + 2))
  var grid = sel.append('div.tds-grid').classed('tds-3col', d.panels.length == 3)
  var panels = grid.appendMany('div.tds-panel', d.panels).st({gridRow: 'span ' + nRows})
  panels.append('div.mlabel.tds-title').text(p => p.title)

  panels.each(function(p){
    var pn = d3.select(this)
    p.conds.forEach(c => {
      if (c.label) pn.append('div.mlabel.tds-cond').text(c.label)
      var tx = pn.append('div.tds-tx.prompt-block')
      tx.append('span.prompt-role').text('Human: ')
      tx.append('span.q-diff').text(c.q)
      tx.append('span').text(' "')
      tx.appendMany('span.t', c.stim)
        .text(s => s.t)
        .at({title: s => s.r == null ? null : 'rank ' + s.r})
        .classed('hot', s => hot(s.r))
        .st({background: s => bg(s.r, ORANGE)})
      tx.append('span').text('\n\n')
      tx.append('span.prompt-role').text('Assistant: ')
      tx.append('span').text(c.gen)
      // one short line: merge target sets when their hit counts match
      var counts = c.counts.every(ct => ct.nHit == c.counts[0].nHit)
        ? [{targets: c.counts.flatMap(ct => ct.targets), nHit: c.counts[0].nHit}]
        : c.counts
      pn.append('div.tds-count').html(counts.map(ct =>
        `${ct.targets.map(t => `"${esc(t)}"`).join(' / ')} in lens on ` +
        `${ct.nHit} token${ct.nHit == 1 ? '' : 's'}`).join('<br>'))
    })
  })

  util.colorCaption(sel, {
    ...(spec == 'main' ? {'different question': {bg: 'var(--hl-yellow)'}} : {}),
    'J-lens top-10': {bg: DARK, color: '#fff'},
  })
}

window.init?.()

// ─── public/flex-gen-systematic/init-flex-gen-systematic.js ───
window.initFlexGenSystematic = async function(opts){
  var spec = opts?.spec || 'systematic'
  var sel = d3.select(opts?.sel || '.flex-gen-systematic').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + spec + '.json')
  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  if (spec === 'appendix') return renderAppendix(sel, d, esc)

  // ═══ systematic: dot-stem left, scatter right ═══
  var row = sel.append('div.fgs-row')
  // Categorical palette from the visual vocab (avoid orange + red — see style guide).
  var catPalette = [util.tol.blue, util.tol.teal, util.tol.magenta, util.gray[500]]
  var col = Object.fromEntries(d.catOrder.map((c, i) => [c, catPalette[i % catPalette.length]]))

  // ── left: per-function HIT, ●=α=1 / ×=α=2 ──
  var rows = []
  d.catOrder.forEach(c => {
    var sub = d.pts.filter(p => p.cat === c).sort((a, b) => b.hit2 - a.hit2)
    rows.push(...sub)
  })
  var H = 320, W = 280, M = {left: 78, right: 8, top: 6, bottom: 30}
  var cL = d3.conventions({sel: row.append('div'), width: W, height: H, margin: M})
  // Top-1 rate is a proportion — no negative axis space, no headroom past 100%;
  // markers at 0/1 sit on the boundary
  cL.x.domain([0, 1])
  var y = d3.scalePoint().domain(d3.range(rows.length)).range([0, cL.height]).padding(0.5)
  cL.xAxis.tickValues([0, 0.5, 1.0]).tickFormat(d3.format('.0%'))
  cL.drawAxis(); cL.svg.select('.y').remove()
  util.ggPlot(cL)
  util.addAxisLabel(cL, 'Top-1 rate →', '')
  // category divider lines
  for (var i = 1; i < d.catOrder.length; i++)
    cL.svg.append('line').at({x1: 0, x2: cL.width, y1: (y(i*4-1)+y(i*4))/2, y2: (y(i*4-1)+y(i*4))/2,
      stroke: util.gray[300], strokeWidth: 0.5})
  var g = cL.svg.appendMany('g.frow', rows).translate((p, i) => [0, y(i)])
  g.append('line').at({x2: p => cL.x(p.hit1/d.nPer), stroke: p => col[p.cat], strokeWidth: 1.2})
  g.append('line').at({x2: p => cL.x(p.hit2/d.nPer), stroke: p => col[p.cat], strokeWidth: 1.0,
    strokeDasharray: '2,2'})
  // α=1 filled "key statistic" marker (3.5 ~ small-side of the 1.8-2.2 stroked
  // range; filled so it reads as the anchor against the × at α=2)
  g.append('circle').at({cx: p => cL.x(p.hit1/d.nPer), r: 3.5, fill: p => col[p.cat]})
  g.append('path').at({d: 'M-4,-4L4,4M-4,4L4,-4', transform: p => `translate(${cL.x(p.hit2/d.nPer)},0)`,
    stroke: p => col[p.cat], strokeWidth: 1.5, fill: 'none'})
  g.append('text').text(p => p.func).at({x: -6, dy: '.32em', textAnchor: 'end',
    fontSize: 'var(--fs-label)', fill: util.gray[700]})
  // legend — categorical dots (mirror the data markers' filled circles)
  var leg = cL.svg.append('g').translate([cL.width - 60, cL.height - 86])
  d.catOrder.forEach((c, i) => {
    var lg = leg.append('g').translate([0, i*12])
    lg.append('circle').at({r: 3.5, fill: col[c]})
    lg.append('text').text(c).at({x: 8, dy: '.32em', fontSize: 'var(--fs-label)', fill: util.gray[700]})
  })
  ;[['α=1', 'circle'], ['α=2', 'x']].forEach(([lab, mk], i) => {
    var lg = leg.append('g').translate([0, 52 + i*12])
    if (mk === 'circle') lg.append('circle').at({r: 3.5, fill: '#fff', stroke: util.gray[700], strokeWidth: 1})
    else lg.append('path').at({d: 'M-3,-3L3,3M-3,3L3,-3', stroke: util.gray[700], strokeWidth: 1.4})
    lg.append('text').text(lab).at({x: 8, dy: '.32em', fontSize: 'var(--fs-label)', fill: util.gray[700]})
  })

  // ── right: csum vs Δlp scatter ──
  var W2 = 360, M2 = {left: 50, right: 14, top: 6, bottom: 36}
  var cR = d3.conventions({sel: row.append('div'), width: W2, height: H, margin: M2})
  var xExt = d3.extent(d.pts, p => p.csum), xSpan = xExt[1] - xExt[0]
  var yExt = d3.extent(d.pts, p => p.dlpc), ySpan = yExt[1] - yExt[0]
  cR.x.domain([xExt[0] - 0.06*xSpan, xExt[1] + 0.18*xSpan])
  cR.y.domain([Math.min(yExt[0], 0) - 0.06*ySpan, yExt[1] + 0.08*ySpan])
  cR.xAxis.ticks(5); cR.yAxis.ticks(5)
  cR.drawAxis(); util.ggPlot(cR)
  util.addAxisLabel(cR, 'Clean workspace loading (cos at arg + cos at readout) →',
    'Swap effect at α=1 (Δlp_target − Δlp_spon) →', '', 6, -6)
  // y=0 ref + fit line
  cR.svg.append('line').at({x1: 0, x2: cR.width, y1: cR.y(0), y2: cR.y(0), stroke: util.gray[300], strokeWidth: 0.7})
  var xs = cR.x.domain()
  cR.svg.append('line').at({x1: cR.x(xs[0]), x2: cR.x(xs[1]),
    y1: cR.y(d.fit.m*xs[0]+d.fit.b), y2: cR.y(d.fit.m*xs[1]+d.fit.b),
    stroke: util.gray[400], strokeWidth: 1.1, strokeDasharray: '4,3'})
  // error bars + dots + labels — whiskers in series color, faded so dots dominate
  var pg = cR.svg.appendMany('g.pt', d.pts).translate(p => [cR.x(p.csum), cR.y(p.dlpc)])
  pg.append('line').at({x1: p => cR.x(p.csum-p.csumStd)-cR.x(p.csum), x2: p => cR.x(p.csum+p.csumStd)-cR.x(p.csum),
    stroke: p => util.tint(col[p.cat], 0.6), strokeWidth: 1})
  pg.append('line').at({y1: p => cR.y(p.dlpc-p.dlpcSem)-cR.y(p.dlpc), y2: p => cR.y(p.dlpc+p.dlpcSem)-cR.y(p.dlpc),
    stroke: p => util.tint(col[p.cat], 0.6), strokeWidth: 1})
  // circles on cR.svg (not inside translated g.pt) so nearestHover reads cx/cy
  cR.svg.appendMany('circle.jpt', d.pts)
    .at({cx: p => cR.x(p.csum), cy: p => cR.y(p.dlpc), r: 2.2,
      fillOpacity: 0, stroke: p => col[p.cat], strokeWidth: 1})
  // label placement: try 4 diagonals, greedily pick the one with most clearance
  // from other points + already-placed label boxes. Diagonal keeps text off the
  // CI crosshair (which runs horiz+vert through the point).
  var px = d.pts.map(p => [cR.x(p.csum), cR.y(p.dlpc)])
  var diag = [[6, -4, 'start'], [-6, -4, 'end'], [6, 11, 'start'], [-6, 11, 'end']]
  var charW = 6, lineH = 10, pad = 4, placed = []
  function labelBox(i, [dx, dy, anc]){
    var w = d.pts[i].func.length * charW
    var x0 = anc === 'start' ? px[i][0] + dx : px[i][0] + dx - w
    return [x0, px[i][1] + dy - lineH, x0 + w, px[i][1] + dy]
  }
  function boxDist(b, x, y){
    var dx = Math.max(b[0] - x, 0, x - b[2]), dy = Math.max(b[1] - y, 0, y - b[3])
    return Math.hypot(dx, dy)
  }
  function overlap(a, b){ return a[0] < b[2]+pad && a[2]+pad > b[0] && a[1] < b[3]+pad && a[3]+pad > b[1] }
  function score(i, cand){
    var bx = labelBox(i, cand), s = 1e9
    px.forEach(([x, y], j) => { if (j !== i) s = Math.min(s, boxDist(bx, x, y)) })
    placed.forEach(b => { if (overlap(bx, b)) s -= 1e3 })
    if (bx[2] > cR.width || bx[0] < 0) s -= 200
    return s
  }
  var nudge = {}
  d3.range(d.pts.length).sort((a, b) => px[a][0] - px[b][0]).forEach(i => {
    var best = d3.greatest(diag, c => score(i, c))
    nudge[d.pts[i].func] = best
    placed.push(labelBox(i, best))
  })
  pg.append('text').text(p => p.func)
    .at({x: p => nudge[p.func][0], dy: p => nudge[p.func][1],
         textAnchor: p => nudge[p.func][2],
         fontSize: 'var(--fs-label)', fill: util.gray[600]})
    .st({paintOrder: 'stroke', stroke: '#EAECED', strokeWidth: 1, strokeLinejoin: 'round'})  // lint-ok hex-js: ggPlot bg halo
  cR.svg.append('text.num').text(`r = ${d.r >= 0 ? '+' : ''}${d.r.toFixed(2)}`)
    .at({x: 8, y: 14, fontSize: 'var(--fs-body)', fill: util.gray[700]})
    .st({fontVariantNumeric: 'tabular-nums'})

  var ttSel = d3.select('.tooltip'), last
  util.nearestHover(cR.svg, cR.svg.selectAll('circle.jpt'), {
    radius: 40,
    onHover: (p, el, e) => {
      if (el !== last){
        last = el
        ttSel.classed('tooltip-hidden', false).html('')
        ttSel.append('div').html(`<b style="color:${col[p.cat]}">${esc(p.func)}</b> · ${p.cat}`)
        ttSel.append('div').html(
          `top-1: <b>${p.hit1}/${d.nPer}</b> (α=1), ${p.hit2}/${d.nPer} (α=2)<br>` +
          `loading: ${p.csum.toFixed(2)} · Δlp: ${p.dlpc.toFixed(2)}`)
      }
      var bb = ttSel.node().getBoundingClientRect()
      ttSel.st({left: d3.clamp(20, e.clientX - bb.width/2, innerWidth - bb.width - 20) + 'px',
                top: (innerHeight > e.clientY + 20 + bb.height ? e.clientY + 20 : e.clientY - bb.height - 20) + 'px'})
    },
    onLeave: () => { last = null; ttSel.classed('tooltip-hidden', true) },
  })
}

function renderAppendix(sel, d, esc){
  // sentence-case the baked lowercase category/function names (matches flex-gen-example's .capitalize())
  var cap = s => s.charAt(0).toUpperCase() + s.slice(1)
  d.cats.forEach(cat => {
    var cs = sel.append('div.fga-cat')
    cs.append('div.fga-cat-h').text(cap(cat.name))
    var row = cs.append('div.fga-row')
    cat.funcs.forEach(F => {
      var grd = row.append('div.fga-grid')
      grd.append('div.fga-grid-h').html(`${esc(cap(F.name))} <span class="n">${F.nHit}/12 top-1</span>`)
      var tbl = grd.append('table.g')
      var thr = tbl.append('tr')
      thr.append('th.r')
      cat.args.forEach(a => thr.append('th')
        .html(`<span class="o mlabel">${esc(a)}</span><span class="a">${esc(F.answers[a])}</span>`).at({title: a}))
      cat.args.forEach((sp, ri) => {
        var tr = tbl.append('tr')
        tr.append('th.r').text(sp).at({title: sp})
        F.cells[ri].forEach(c => {
          var td = tr.append('td').text(c.t).at({title: c.t + (c.rk ? ` (rank ${c.rk})` : '')})
          if (c.diag) td.classed('diag', true)
          else {
            var cls = c.rk === 1 ? 'hit' : c.rk <= 5 ? 'near' : 'miss'
            td.classed(cls, true)
            if (c.rk > 1) td.append('span.rk').text(c.rk)
          }
        })
      })
    })
  })
  var leg = sel.append('div.fga-legend')
  leg.append('span').text('Rank of correct answer:')
  ;[['hit', '1'], ['near', '2–5'], ['miss', '>5'], ['diag', 'No swap']].forEach(([cls, lab]) => {
    var it = leg.append('span.item')
    it.append('span.sw').classed(cls, true)
    it.append('span').text(lab)
  })
}

window.init?.()

// ─── public/selectivity-linecount/init-selectivity-linecount.js ───
window.initSelectivityLinecount = async function(opts){
  var sel = d3.select(opts?.sel || '.selectivity-linecount').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')
  sel.st({'--ncol': d.conds.length})

  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  var orange = t => d3.interpolateOranges(0.1 + 0.55*t)
  var condFill = co => /^Automatic/.test(d.condLabel[co]) ? util.gray[300] : util.tol.blue

  // ── 3-column example ──
  sel.append('div.fva-row3.titles').appendMany('div.fig-title', d.example)
    .text(e => e.title)
  sel.append('div.fva-note').text('Model output in bold')

  var tops = sel.append('div.fva-row3').appendMany('div', d.example)
  var pr = tops.append('div.fva-prompt.prompt-block')
  pr.each(function(e){
    var vmax = Math.max(1, d3.max(e.tokens, t => t.d))
    d3.select(this).appendMany('span', e.tokens).each(function(t){
      var s = d3.select(this).attr('class', t.cls || null)
      var txt = t.nl ? esc(t.s).replaceAll('\n', "<span class='nl'>↵</span>\n") : esc(t.s)
      if (t.d > 0) s.classed('ramp', true)
        .st({background: orange(t.d / vmax)})
      s.html(txt)
    })
  })
  tops.append('div.fva-legend').text(e => `${e.density} ${d.densityNoun || 'number-tokens in lens'}`)

  // The continue column reports the model's output token (a newline) rather
  // than the column it wraps at — apply here so the figure is correct even
  // against a data.json baked before the corresponding bake-script change.
  d.example.filter(e => e.cond == 'continue').forEach(e => {
    e.ansLabel = 'output:'; e.ans = '↵'
  })
  // swapLabel is now the section heading (was previously repeated under each
  // column). Baked data.json before this change has the short form
  // "Swap the lens count 40s→60s:"; rephrase it here so the figure reads
  // correctly without waiting on a re-bake.
  var m = /(\d)0s.*?(\d)0s/.exec(d.swapLabel || '')
  var swapHeading = m
    ? `Swap J-lens vectors for numbers in the ${m[1]}0s for numbers in the ${m[2]}0s`
    : d.swapLabel
  sel.append('div.fig-title.mid').text(swapHeading)
  var bots = sel.append('div.fva-row3').appendMany('div.fva-swp', d.example)
  bots.append('div.row2').html(e =>
    `<span class='lab'>${esc(e.ansLabel)}</span>` +
    `<span><b class='out'>${esc(e.ans)}</b>` +
    `<span class='vd'>before swap</span></span>`)
  bots.append('div.row2').html(e =>
    `<span class='lab'>after swap:</span>` +
    `<span><b class='out'>${esc(e.swap)}</b>` +
    `<span class='vd'>${esc(e.verdict)}</span></span>`)

  // ── 3 bar panels ──
  sel.append('div.fva-sep').text(`Across all n=${d.n} snippets`)
  // match Fig 20's selectivity-language barChart: same y-label wording, %
  // ticks on every panel, multi-line rotated label (not addAxisLabel arrow)
  var YLAB = {
    'P(correct answer) →': 'Task success rate',
    'Count tokens in lens →': 'Rate of count appearing in\nJ-lens on prompt tokens',
    'P(answer follows swap) →': 'Rate of answer following swap',
  }
  var br = sel.append('div.fva-bars').appendMany('div', d.bars)
  var colW = br.node().offsetWidth
  var M = {left: 58, right: 8, top: 22, bottom: 50}
  br.each(function(b){
    var c = d3.conventions({
      sel: d3.select(this), width: colW - M.left - M.right, height: 200, margin: M,
    })
    var x = d3.scaleBand().domain(d.conds).range([0, c.width])
      .paddingInner(0.3).paddingOuter(0.14)
    var ylim = b.ylim || [0, d3.max(b.vals, v => (v.mean||0) + (v.sem||0)) * 1.12]
    c.y.domain(ylim)
    c.yAxis.ticks(5).tickFormat(d3.format('.0%')).tickSize(4)
    c.drawAxis(); c.svg.select('.x').remove()
    util.ggPlot(c)
    var ylines = (YLAB[b.ylabel] || b.ylabel.replace(/\s*→\s*$/, '')).split('\n')
    var yfs = ylines.length > 1 ? 12 : 14
    var yx = -44 - (ylines.length-1) * (yfs+1)
    var ytxt = c.svg.append('text').at({x: yx, y: c.height/2})
      .attr('transform', `rotate(-90 ${yx} ${c.height/2})`)
      .st({fontSize: yfs, fill: util.gray[700], textAnchor: 'middle'})
    ylines.forEach((l, i) => ytxt.append('tspan').at({x: yx, dy: i ? yfs+1 : 0}).text(l))
    c.svg.append('text.panel-title').text(b.title)
      .at({x: 0, y: -8, fontSize: 'var(--fs-small)', fontWeight: 600})  // lint-ok inline-font-js: SVG axis-title
    c.svg.appendMany('text.xlab', d.conds).at({textAnchor: 'middle'})
      .translate(co => [x(co)+x.bandwidth()/2, c.height+12])
      .each(function(co){
        var ls = d.condLabel[co].split('\n')
        d3.select(this).appendMany('tspan', ls).text(s => s)
          .at({x: 0, dy: (_, i) => i ? '1.15em' : 0})
      })
    var g = c.svg.appendMany('g', b.vals.filter(v => v.mean != null))
      .translate(v => [x(v.cond), 0])
    g.append('rect').at({
      width: x.bandwidth(), y: v => c.y(v.mean), height: v => c.height - c.y(v.mean),
      fill: v => condFill(v.cond),
    })
    g.each(function(v){
      util.barWhisker(d3.select(this), {x: x.bandwidth()/2, lo: c.y(v.mean - v.sem), hi: c.y(v.mean + v.sem)})
    })
  })
}

window.init?.()

// ─── public/selectivity-language/init-selectivity-language.js ───
window.initSelectivityLanguage = async function(opts){
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var swap = await util.getFile(base + 'swap.json').catch(() => null)
  var rd = null, ex = null

  var orange = t => d3.interpolateOranges(0.1 + 0.55*t)
  var WS_LABELS = {'Explicit report': 1, 'Flexible computation': 1}
  var catFill = lab => WS_LABELS[lab] ? util.tol.blue : util.gray[400]

  function barChart(sel, rows, meta, ylab, ymax){
    sel.html('')
    var groups = []
    meta.tasks.forEach(t => meta.models.forEach(m => groups.push([t, m])))
    var nC = meta.cats.length, nG = groups.length
    var avail = Math.max(120, sel.node().clientWidth
      || sel.node().parentNode?.clientWidth || 380)
    var nM = meta.models.length, nT = meta.tasks.length
    var bottomM = 42 + (nM > 1 ? 16 : 0)
                     + (nT > 1 ? 16 : 0)
    var c = d3.conventions({
      sel, totalWidth: Math.min(avail, 420), height: 200,
      margin: {left: 58, top: 22, right: 4,
               bottom: bottomM},
    })
    var gx = d3.scaleBand().domain(d3.range(nG))
      .range([0, c.width]).paddingInner(0.18)
    var cx = d3.scaleBand().domain(meta.cats)
      .range([0, gx.bandwidth()]).paddingInner(0.22)
    c.y.domain([0, ymax])
    c.yAxis.tickFormat(d3.format('.0%')).ticks(5).tickSize(4)
    c.drawAxis()
    c.svg.select('.x').remove()
    util.ggPlot(c)
    var ylines = String(ylab).split('\n')
    var yfs = ylines.length > 1 ? 12 : 14
    var yx = -44 - (ylines.length-1) * (yfs+1)
    var ytxt = c.svg.append('text')
      .at({x: yx, y: c.height/2})
      .attr('transform', `rotate(-90 ${yx} ${c.height/2})`)
      .st({fontSize: yfs, fill: util.gray[700],
           textAnchor: 'middle'})
    ylines.forEach((l, i) => ytxt.append('tspan')
      .at({x: yx, dy: i ? yfs+1 : 0}).text(l))

    var idx = {}
    rows.forEach(r => { idx[[r.task, r.model, r.cat]] = r })

    groups.forEach(([t, m], gi) => {
      var g = c.svg.append('g').translate([gx(gi), 0])
      meta.cats.forEach(cat => {
        var r = idx[[t, m, cat]]
        if (!r || r.mean == null) return
        var bx = cx(cat), bw = cx.bandwidth()
        var n = r.pts.length
        var sd = n > 1 ? Math.sqrt(
          r.pts.reduce((a,p)=>a+(p-r.mean)**2,0)/(n-1)) : 0
        var se = n > 1 ? sd/Math.sqrt(n) : 0
        var lo = Math.max(0, r.mean - 1.96*se)
        var hi = Math.min(1, r.mean + 1.96*se)
        g.append('rect')
          .at({x: bx, y: c.y(r.mean), width: bw,
               height: c.height - c.y(r.mean)})
          .st({fill: catFill(meta.labels[cat])})
          .append('title')
          .text(`${t} / ${meta.model_labels[m]}\n`
              + `${meta.labels[cat]}: `
              + `${(r.mean*100).toFixed(0)}% ± `
              + `${(1.96*se*100).toFixed(0)}% (n=${n})`)
        if (n > 1) util.barWhisker(g, {x: bx + bw/2, lo: c.y(lo), hi: c.y(hi)})
      })
      meta.cats.forEach((cat, ci) => {
        var bx = cx(cat), bw = cx.bandwidth()
        var words = meta.labels[cat].split(' ')
        var txt = g.append('text')
          .at({x: bx + bw/2, y: c.height + 14})
          .st({fontSize: 'var(--fs-label)', textAnchor: 'middle',
               fill: util.gray[700]})
        words.forEach((w, i) => txt.append('tspan')
          .at({x: bx + bw/2, dy: i ? '1.1em' : 0}).text(w))
      })
      // Model label under bars; task header above models
      // when there are multiple tasks.
      if (nG > 1){
        var mY = c.height + 46
        if (meta.models.length > 1){
          g.append('text')
            .at({x: gx.bandwidth()/2, y: mY})
            .st({fontSize: 'var(--fs-label)', textAnchor: 'middle',
                 fill: util.gray[500]})
            .text(meta.model_labels[m].split(' ')[0])
        }
        if (m === meta.models[0] && meta.tasks.length > 1){
          var tX = gx.bandwidth() * meta.models.length / 2
          var tY = meta.models.length > 1 ? mY + 16 : mY
          g.append('text')
            .at({x: tX, y: tY})
            .st({fontSize: 'var(--fs-small)', textAnchor: 'middle',
                 fontWeight: 600, fill: util.gray[700]})  // lint-ok inline-font-js: structural sub-axis label
            .text(t)
        }
      }
    })
  }

  if (swap){
    d3.selectAll('.flex-auto-swap').each(function(){
      var sel = d3.select(this)
      var tag = sel.attr('data-tag') || 'v2'
      var tasksAttr = sel.attr('data-tasks')
      var modelsAttr = sel.attr('data-models')
      var tasks = tasksAttr
        ? tasksAttr.split(',') : swap.tasks
      var models = modelsAttr
        ? modelsAttr.split(',') : swap.models
      var rows = (swap[tag] || [])
        .filter(r => tasks.includes(r.task)
                  && models.includes(r.model))
      var meta = {cats: swap.cats, tasks: tasks,
                  models: models, labels: swap.labels,
                  colors: swap.colors,
                  model_labels: swap.model_labels}
      var ylab = tag === 'ablation'
        ? 'P(own answer preserved)'
        : 'P(answer follows swap)'
      barChart(sel, rows, meta, ylab, 1.0)
    })

    // Polished example layout: one cell per column, each
    // with title, prompt box, lens-count, swap rows.
    d3.selectAll('.flex-auto-polished').each(function(){
      var sel = d3.select(this).html('')
      var pe = swap.polished_ex
      if (!pe) return
      var grid = sel.append('div').at({class: 'row3'})
      function renderPrompt(c){
        var smax = d3.max(c.lens_strength || []) || 1
        // Fallback when no lens_hits collected for this
        // column: render plain prompt text.
        if (!c.tokens.length && c.prompt_text){
          var t = esc(c.prompt_text)
          if (c.anom_str)
            t = t.replace(esc(c.anom_str),
              `<span class='anom'>${esc(c.anom_str)}</span>`)
          var ws = c.out0.split(/\s+/)
          var mg = ws.slice(0,5).join(' ') + (ws.length > 5 ? '…' : '')
          return `<span class='prompt-role'>Human:</span> ${t}`
            + `\n\n<span class='prompt-role'>Assistant:</span>`
            + ` <span class='prompt-gen'>${esc(mg)}</span>`
        }
        var pp = c.tokens.map(prettyToken)
        for (var i = 1; i < pp.length; i++)
          if (pp[i].startsWith(' ')
              && pp[i-1].endsWith('\n'))
            pp[i] = pp[i].slice(1)
        var html = `<span class='prompt-role'>Human:</span>`
        var atok = c.assistant_tok
        pp.forEach((s, i) => {
          if (atok && i >= atok[0] && i < atok[1]){
            if (i === atok[0])
              html += `\n\n<span class='prompt-role'>Assistant:`
                    + `</span>`
            return
          }
          var isAnom = c.anom_tok && i >= c.anom_tok[0]
            && i < c.anom_tok[1]
          s = esc(s)
          if (c.lens_hit?.[i]){
            var t = (c.lens_strength?.[i] || 0) / smax
            html += `<span class='ramp${isAnom?' anom':''}' `
              + `style='background:${orange(t)}'`
              + `>${s}</span>`
          } else if (isAnom){
            html += `<span class='anom'>${s}</span>`
          } else html += s
        })
        if (!atok)
          html += `\n\n<span class='prompt-role'>Assistant:</span>`
        var ws = c.out0.split(/\s+/)
        var mgen = ws.slice(0,5).join(' ') + (ws.length > 5 ? '…' : '')
        html += ` <span class='prompt-gen'>${esc(mgen)}</span>`
        return html
      }
      pe.cols.forEach((c, idx) => {
        var cell = grid.append('div')
        cell.append('div').at({class: 'fig-title'})
          .st({borderBottom: 'none', paddingBottom: 0})
          .text(c.title.replace(' — ', ': '))
        cell.append('div').at({class: 'prompt prompt-block'})
          .html(renderPrompt(c))
        var isCont = c.cat === 'auto_cont'
        // Legend (bold/orange-swatch key) sits between the prompt block and
        // the swap block in the auto_cont column — shared key for the whole
        // example row, placed once. Replaces the old per-column "N tokens
        // in lens" annotations.
        if (isCont) cell.append('div').at({class: 'inlay'})
          .html(`<b>bold</b> = model output · `
              + `<span class='legend-sq' style='background:${orange(.8)}'></span>`
              + `${esc(pe.sig_label)} in lens top-${pe.k}`)
        // Word-boundary truncation so the swap-result line never ends
        // mid-word (the auto_cont output is a full sentence; a hard char
        // cut at 36 sliced "cómo" → "cóm"). 34 keeps "…observando" and
        // fits the column at the paper's <figure class='wide'> width.
        var short = s => {
          var first = s.split(/[\n.]/)[0]
          if (first.length <= 34) return first
          return first.slice(0, 34).replace(/\s+\S*$/, '') + '…'
        }
        var swp = cell.append('div').at({class: 'swp'})
        swp.append('div').at({class: 'row-lr'})
          .html(`Swap J-lens ${esc(pe.own)}→${esc(pe.donor)} `
              + `at every position:`)
        swp.append('div').at({class: 'row-mid'})
          .html(`<span class='lab'>output:</span> `
              + `<b class='out'>${esc(short(c.out0))}</b>`)
        swp.append('div').at({class: 'row-mid'})
          .html(`<span class='lab'>after swap:</span> `
              + `<b class='out'>${esc(short(c.out1))}</b>`
              + (isCont ? ''
                : `<span class='vd'>${esc(c.verdict)}</span>`))
        if (isCont) swp.append('div').at({class: 'vd-line'})
          .text(c.verdict)
      })
      sel.append('div').at({class: 'sep'})
        .text(`Across all n=${pe.n_stim} snippets`)
    })

    // 3-panel chart (a/b/c) — sonnet lang prefill.
    d3.selectAll('.flex-auto-3panel').each(function(){
      var sel = d3.select(this)
      var tp = swap.three_panel
      if (!tp) return
      sel.html('')
      tp.panels.forEach(p => {
        var cell = sel.append('div')
        var chart = cell.append('div')
        var meta = {cats: tp.cats, tasks: ['lang'],
                    models: ['sonnet'], labels: swap.labels,
                    colors: swap.colors,
                    model_labels: swap.model_labels}
        var ymax = p.key === 'b'
          ? Math.max(.05,
              ...p.rows.map(r => r.mean || 0)) * 1.15
          : 1.0
        barChart(chart, p.rows, meta, p.ylab, ymax)
        chart.select('svg g').append('text.panel-title')
          .text(`${p.key} · ${p.title}`)
          .at({x: 0, y: -8, fontSize: 'var(--fs-small)', fontWeight: 600})  // lint-ok inline-font-js: SVG axis-title
      })
    })

    util.colorCaption(d3.select('.selectivity-language'), {
      'continuation': {bg: util.gray[400], color: '#fff'},
      'anomaly detection': {bg: util.gray[400], color: '#fff'},
      'explicit report': {bg: util.tol.blue, color: '#fff'},
      'flexible computation': {bg: util.tol.blue, color: '#fff'},
    })
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;',
        '"':'&quot;',"'":'&#39;'}[c]))
  }

  function prettyToken(t){
    // tokenization markers: case marker precedes space
    // marker (↑⍽human = " Human"). ppToken consumes the
    // space; we need to preserve it.
    if (t.startsWith('<') && t.endsWith('>')) return ''
    return String(t)
      .replace(/([▲↑])([·⍽ ]?)(\p{L})/gu,
               (_, _c, sp, l) => (sp ? ' ' : '') + l.toUpperCase())
      .replace(/⇪([·⍽ ]?)(\p{L}+)/gu,
               (_, sp, w) => (sp ? ' ' : '') + w.toUpperCase())
      .replace(/[▲↑⇪]/gu, '')
      .replace(/[⍽ ·]/gu, ' ')
      .replace(/⏎/gu, '\n')
  }

  function renderTokenPrompt(c){
    // Token-level rendering when lens-hit data is present.
    // c.tokens: per-token marked strings;
    // c.lens_hit: bool[]; c.anom_tok: [start,end) or null.
    var smax = d3.max(c.lens_strength || []) || 1
    var ws = c.ws_prefix || ''
    var pp = c.tokens.map(prettyToken)
    // Drop a leading space on tokens that follow a
    // newline so paragraphs aren't indented by one char.
    for (var i = 1; i < pp.length; i++)
      if (pp[i].startsWith(' ') && pp[i-1].endsWith('\n'))
        pp[i] = pp[i].slice(1)
    while (pp.length && !pp[pp.length-1].trim()) pp.pop()
    var body = pp.map((s, i) => {
      // Prefill mode: body tokens include the Assistant
      // marker inline; replace those tokens with the
      // styled turn label.
      if (c.assistant_tok && i >= c.assistant_tok[0]
          && i < c.assistant_tok[1]){
        return i === c.assistant_tok[0]
          ? `\n\n<span class='fa-turn'>Assistant:</span>`
          : ''
      }
      var isAnom = c.anom_tok && i >= c.anom_tok[0]
          && i < c.anom_tok[1]
      s = esc(s)
      if (c.lens_hit?.[i]){
        var aCls = isAnom ? ' fa-anom' : ''
        var t = (c.lens_strength?.[i] || 0) / smax
        return (
          `<span class='fa-lens-hit${aCls}' `
          + `style='background:${orange(t)}'>`
          + s + `</span>`)
      }
      if (isAnom) return `<span class='fa-anom'>${s}</span>`
      return s
    }).join('')
    var lead = pp[0]?.startsWith(' ') ? '' : ' '
    var wsD = ws ? (ws.startsWith(' ') ? ws : ' ' + ws) : ''
    var tail = c.assistant_tok
      ? ''
      : (`\n\n<span class='fa-turn'>Assistant:</span>`
         + (wsD ? `<span class='fa-ws'>${esc(wsD)}</span>` : ''))
    return (
      `<span class='fa-turn'>Human:</span>${lead}${body}`
      + tail
    )
  }

  function highlightPrompt(c, mode){
    if (c.tokens) return renderTokenPrompt(c)
    // mode: 'all' | 'stim' | 'post' | 'surround'
    // Returns HTML with swap region wrapped in .fa-swp and
    // anomaly (if present) in .fa-anom.
    var q = esc(c.question)
    var et = esc(c.text)
    var stim_start = Math.max(0, q.indexOf(et))
    var stim_end = stim_start + et.length
    var pre, swp, post
    if (mode === 'all' || mode === 'surround'){
      pre = ''; swp = q; post = ''
    } else if (mode === 'stim'){
      pre = q.slice(0, stim_start)
      swp = q.slice(stim_start)
      post = ''
    } else {
      var q_start = stim_end
      while (q[q_start] === '\n') q_start++
      pre = q.slice(0, q_start)
      swp = q.slice(q_start)
      post = ''
    }
    if (c.anomaly){
      var ea = esc(c.anomaly)
      // For 'surround' the anomaly is EXCLUDED from the
      // swap — render it as a non-swp island inside the
      // highlighted region.
      if (mode === 'surround'){
        swp = swp.replace(
          ea,
          `</span><span class='fa-anom'>${ea}</span>`
          + `<span class='fa-swp'>`)
      } else {
        pre = pre.replace(
          ea, `<span class='fa-anom'>${ea}</span>`)
        swp = swp.replace(
          ea, `<span class='fa-anom'>${ea}</span>`)
      }
    }
    // Write-only continuation embeds its own Assistant
    // prefix in the question string; detect to avoid
    // double-rendering the turn marker.
    var hasAssist = /\n\nAssistant:/.test(c.question)
    // For full-scope (all/surround), the swap covers the
    // Human:/Assistant: markers too — highlight them.
    var full = (mode === 'all' || mode === 'surround')
    var headCls = full ? 'fa-swp fa-pre' : 'fa-pre'
    var tail = hasAssist ? ''
      : `<span class='${headCls}'>\n\nAssistant:</span>`
    // Warm-start prefix (if provided): show separately
    // after Assistant:, styled to distinguish unswapped-
    // sampled tokens from swapped generation.
    if (c.ws_prefix){
      tail += `<span class='fa-ws'>${esc(c.ws_prefix)}</span>`
    }
    return (`<span class='${headCls}'>Human: </span>${pre}`
          + `<span class='fa-swp'>${swp}</span>`
          + `${post}${tail}`)
  }

  var TASK_NOUN = {
    lang: 'language', code: 'programming-language',
    cuisine: 'cuisine', sport: 'sport',
    code2: 'programming-language',
  }

  function renderExample(sel, d, tag){
    sel.html('')
    var head = sel.append('div').at({class: 'fa-ex-head'})
    var noun = TASK_NOUN[d.task] || d.task
    head.append('b').text(d.donor
      ? `Swapping ${noun} J-lens vector: ${d.own} → ${d.donor}`
      : `Ablating ${noun} J-lens vector: ${d.own} → ∅`)
    if (d.cols.some(c => c.lens_hit)){
      var lm = d.lens_meta || {}
      var lr = lm.display_layers?.length
        ? `L${lm.display_layers[0]}–`
          + `${lm.display_layers[lm.display_layers.length-1]}`
        : 'Workspace layers'
      head.append('span').at({class: 'fa-ex-legend'})
        .html(
          `<span class='fa-sw'></span>`
          + `${d.own}-token in lens top-${lm.k||10}, ${lr}`
          + (d.cols.some(c => c.anom_tok)
             ? ` · <span class='fa-anom'>underlined</span>`
               + ` = inserted anomaly` : ''))
    }
    var nc = d.cols.length
    // Group: report+flexible (workspace) come first, then
    // continuation+anomaly (automatic). Add a wider gap
    // and a dashed divider before the automatic group.
    var nAuto = d.cols.filter(c =>
      /^Automatic/.test(c.title)).length
    var nWork = nc - nAuto
    var grid = nc >= 6
      ? {gridTemplateColumns:
           `repeat(${Math.ceil(nWork/2)}, 1fr) `
           + `repeat(${Math.ceil(nAuto/2)}, 1fr)`,
         gridTemplateRows: 'auto auto',
         gridAutoFlow: 'column',
         columnGap: '18px', rowGap: '28px'}
      : {gridTemplateColumns: `repeat(${nc}, 1fr)`}
    var cols = sel.append('div').at({class: 'fa-ex-cols'})
      .st(grid)
    // Default highlight mode (for legacy tags with no
    // per-column `highlight` field).
    var dflt = tag==='v2all' || tag==='sf_final' ? 'all'
      : d.question_first ? 'stim' : 'post'
    d.cols.forEach((c, i) => {
      var isAuto = /^Automatic/.test(c.title)
      var firstAuto = isAuto && i === nWork
      var col = cols.append('div').at({class: 'fa-ex-col'})
        .classed('fa-ex-auto', isAuto)
        .classed('fa-ex-divider', firstAuto)
      col.append('h4.mlabel').text(c.title).at({title: c.title})
      var mode = c.highlight || dflt
      col.append('div').at({class: 'fa-ex-prompt prompt-block'})
        .html(highlightPrompt(c, mode))
      var outs = col.append('div').at({class: 'fa-ex-outs'})
      ;['0.0','1.0'].forEach(k => {
        outs.append('div').at({class: 'fa-ex-out'})
          .html(`<span class='fa-alpha'>`
              + `α=${k==='0.0'?'0':'1'}</span>`
              + `<span>${esc(c.out[k] || '—')}</span>`)
      })
      col.append('div').at({class: 'fa-ex-verdict'})
        .text(c.verdict)
    })
    if (d.stim_gloss){
      sel.append('div').at({class: 'fa-ex-gloss'})
        .text(`[${d.own}] ${d.stim_gloss}`
            + (d.anom_gloss
               ? `  · anomaly: ${d.anom_gloss}` : ''))
    }
  }

  if (ex){
    d3.selectAll('.flex-auto-example').each(function(){
      var sel = d3.select(this)
      var task = sel.attr('data-task')
      var tag = sel.attr('data-tag') || 'v2'
      var d = ex[tag]?.[task]
      if (d) renderExample(sel, d, tag)
    })
  }

  if (rd){
    d3.selectAll('.flex-auto-readout').each(function(){
      var sel = d3.select(this)
      var meta = {cats: rd.cats, tasks: rd.tasks,
                  models: rd.models, labels: rd.labels,
                  colors: rd.colors,
                  model_labels: rd.model_labels}
      var ymax = d3.max(rd.data, r => r.mean) * 1.1 || .4
      barChart(sel, rd.data, meta,
               'Lens readout hit rate (cell, k=10)', ymax)
    })
  }
}

window.init?.()

// ─── public/post-training/init-post-training.js ───
window.initPostTraining = async function(opts){
  var spec = opts?.spec || 'tylenol'
  var sel = d3.select(opts?.sel || '.post-training').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + spec + '.json')

  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  var PROD = util.tol.blue, BASE = util.gray[600]
  var sideLabel = s => s.replace(/^base model$/i, 'Base model').replace(/^base$/, 'Base model').replace('post-trained', 'Sonnet 4.5')

  if (spec === 'tylenol') return renderTylenol()
  return renderCombined()

  // ── tylenol: 2 columns × (static prompt + 2 token bar-tables at the
  // single readout position). No per-token selection — readers see exactly
  // the keyPos readout the prose discusses; bake ships only that.
  function renderTylenol(){
    var sideColor = t => /base/i.test(t.label) ? BASE : PROD
    var pair = sel.append('div.pt-pair')
    var cols = pair.appendMany('div.pt-col', d.cols)
    var pr = cols.append('div.pt-prompt.prompt-block')
    if (d.sysText){
      pr.append('span.sys').text(d.sysText)
      pr.append('br'); pr.append('br')
    }
    pr.append('span.prompt-role').text('Human: ')
    pr.append('span').html(c => esc(c.promptBody)
      .replace(/(\d+mg)/, '<span class="hl">$1</span>')
      .replace('pain is', 'pain <span class="tok-hit">is</span>'))

    var rt = cols.append('div.rtables')
      .appendMany('div.rtable', c => d3.sort(c.tables, t => !/base/i.test(t.label)))
    var hd = rt.append('div.pt-side')
    hd.append('span.swatch').st({background: sideColor})
    hd.append('span').text(t => /base/i.test(t.label) ? 'Base model' : 'Post-trained model')
    var ro = hd.filter(t => t.rollout).append('span.pt-ro').text('ⓘ')
    var tip = ro.append('div.pt-ro-tip')
    tip.append('div.pt-ro-title').text('Completion:')
    tip.append('div.prompt-block').text(t => t.rollout)

    rt.append('div.bar-table').each(function(t){
      var maxLp = d3.max(t.rows, r => r.lp)
      var bg = util.tint(sideColor(t), 0.75)
      var rs = d3.select(this).appendMany('div.bar-row', t.rows)
      rs.append('div.bar').st({width: r => (Math.exp(r.lp - maxLp) * 100) + '%', background: bg})
      rs.append('span.t').text(r => util.ppCell(r.t).trim())
      rs.append('span.val').text(r => r.lp.toFixed(2))
    })
  }

  // ── combined: title/sub, 2 stacked transcripts (rank-colored), bar chart ──
  function renderCombined(){
    sel.append('div.fig-title').text(d.title)
    sel.append('div.psub').text(d.sub)
    var main = sel.append('div.pt-main')
    var left = main.append('div.pt-left')
    var right = main.append('div.pt-right')

    // rank → color (white→orange, log scale). Same ramp as feature activations.
    // capped at 0.85 so dark-end text stays legible — legend uses the same ramp().
    var yFloor = d.bars.yFloor
    var ramp = t => d3.interpolateOranges(t * 0.85)
    var rankT = r => Math.max(0, Math.min(1, 1 - Math.log(Math.min(r+1, yFloor))/Math.log(yFloor)))
    var rankColor = r => r >= yFloor ? '' : ramp(rankT(r))
    // flip text dark→light when the background is too dark to read
    var rankTxt = r => rankT(r) > 0.6 ? '#fff' : ''

    var sideColor = t => t.label === 'base' ? BASE : PROD
    var tx = left.appendMany('div.pt-tx-wrap', d3.sort(d.transcripts, t => t.label !== 'base'))
    var side = tx.append('div.pt-side')
    side.append('span.swatch').st({background: sideColor})
    side.append('span').text(t => sideLabel(t.label))
    side.filter(t => t.answer).append('span.pt-side-ans')
      .text(t => 'Answer: ' + t.answer)
    var box = tx.append('div.pt-tx.prompt-block')
    box.append('span.sys').text(d.sysText)
    box.append('br'); box.append('br')
    box.append('span.prompt-role').text('Human: ')
    box.appendMany('span.tok', t => t.humanTokens)
      .text(e => e.s).st({background: e => rankColor(e.r), color: e => rankTxt(e.r)})
    box.append('br'); box.append('br')
    box.append('span.prompt-role').text('Assistant: ')
    box.appendMany('span.tok', t => t.asstTokens)
      .text(e => e.s).st({background: e => rankColor(e.r), color: e => rankTxt(e.r)})
    box.filter(t => t.ellipsis).append('span.ell').text(' …')

    // legend: endpoint labels are HTML spans (not svg text) so they never clip
    var leg = left.append('div.pt-legend')
    leg.append('span.leg-label').text(`Token shading = J-lens rank of ${d.conceptLabel.replace(/ word$/, ' words')}`)
    leg.append('span.leg-end').text('1')
    var lw = 140, lh = 9, ln = 50
    leg.append('svg.colorbar').at({width: lw, height: lh})
      .appendMany('rect', d3.range(ln)).at({
        x: i => i*lw/ln, width: lw/ln + 1, height: lh, fill: i => ramp(1 - i/(ln-1)),
      })
    leg.append('span.leg-end').text(yFloor + '+')

    // bar panel: inverted log y, geomean bars + per-item dots
    // sized so the chart's bottom edge lines up with the bottom of the transcripts
    var margin = {left: 50, right: 8, top: 8, bottom: 44}
    var txBottom = (tx.nodes().at(-1)?.getBoundingClientRect().bottom - left.node().getBoundingClientRect().top) || 0
    var chartH = Math.max(320, txBottom - margin.top - margin.bottom)
    var c = d3.conventions({
      sel: right.append('div'), width: 220, height: chartH, margin,
    })
    var spans = d.bars.spans, items = d.bars.items
    var xpos = [], xc = 0
    spans.forEach((sp, si) => {
      if (si) xc += 0.6
      ;['base','prod'].forEach(sd => { xpos.push({sp, sd, x: xc}); xc += 1 })
    })
    var x = d3.scaleLinear().domain([-0.7, xc - 0.3]).range([0, c.width])
    c.y = d3.scaleLog().domain([yFloor, 0.85]).range([c.height, 0])
    c.yAxis.scale(c.y).tickValues([1,2,5,10,20,50,100]).tickFormat(d3.format('d'))
    c.drawAxis()
    c.svg.select('.x').remove()
    util.ggPlot(c)
    util.addAxisLabel(c, '', 'Rank of concept words →', '', 0, -8)

    var ttSel = d3.select('.tooltip')
    var bw = x(0.85) - x(0)
    var rk = (it, sd, sp) => Math.min(it[sd][sp] + 1, yFloor)
    var fmtR = v => v >= yFloor ? '≥' + yFloor : v
    var circ = {}, slope = {}
    xpos.forEach(p => {
      var gm = d.bars.geomean[p.sp][p.sd]
      var base = p.sd === 'prod' ? PROD : BASE
      c.svg.append('rect').at({
        x: x(p.x) - bw/2, width: bw,
        y: c.y(gm), height: c.y(yFloor) - c.y(gm),
        fill: p.sp === 'user' ? base : util.tint(base, 0.5),
      })
      circ[p.sp + '_' + p.sd] = c.svg.appendMany('circle.jpt',
        items.map((it, i) => ({it, i, sp: p.sp, sd: p.sd, v: rk(it, p.sd, p.sp)})))
        .at({cx: x(p.x), cy: o => c.y(o.v), r: 1.8,
          fillOpacity: 0, stroke: util.gray[700], strokeWidth: 1}).nodes()
    })
    spans.forEach((sp, si) => {
      var x0 = x(xpos[si*2].x), x1 = x(xpos[si*2+1].x)
      slope[sp] = c.svg.appendMany('path.slope', items).at({
        d: it => `M ${x0} ${c.y(rk(it,'base',sp))} L ${x1} ${c.y(rk(it,'prod',sp))}`,
        stroke: util.gray[600], strokeWidth: 0.5, opacity: 0.25, pointerEvents: 'none',
      }).nodes()
    })

    var last, hovEls = []
    var clearHov = () => { hovEls.forEach(n => n.classList.remove('hov')); hovEls = [] }
    util.nearestHover(c.svg, c.svg.selectAll('circle.jpt'), {
      radius: 40,
      onHover: (o, el, e) => {
        if (el !== last){
          last = el
          clearHov()
          hovEls = [slope[o.sp][o.i], circ[o.sp+'_base'][o.i], circ[o.sp+'_prod'][o.i]]
          hovEls.forEach(n => n.classList.add('hov'))
          var it = o.it
          ttSel.classed('tooltip-hidden', false).html('').st({maxWidth: 420})
          ttSel.append('div').html(`${o.sp} turn · ${it.id || ''}`)
          ttSel.append('table.tt-pair').html(
            `<tr><td class=k>Base model</td><td>rank <b>${fmtR(rk(it,'base',o.sp))}</b></td></tr>` +
            `<tr><td class=k>Sonnet 4.5</td><td>rank <b>${fmtR(rk(it,'prod',o.sp))}</b></td></tr>`)
          if (it.prompt) ttSel.append('div.prompt-block')
            .st({margin: '6px 0', maxHeight: '14em', overflowY: 'auto'}).text(it.prompt)
          var lt = it[o.sd]?.lens_topk
          if (lt?.tokens?.length){
            ttSel.append('div').st({fontSize: 'var(--fs-label)', color: 'var(--text-light)', margin: '6px 0 3px'})
              .text(`J-lens top-10 (${o.sd === 'prod' ? 'Sonnet 4.5' : 'base'}):`)
            var toks = ttSel.append('div.lens-topk').st({flexWrap: 'wrap'})
            lt.tokens.forEach((t, ti) => toks.append('span.lenstk').text(util.ppCell(t))
              .st({background: lt.hit_idx?.includes(ti) ? 'var(--hl-yellow)' : 'var(--tok-bg)'}))
          }
        }
        var bb = ttSel.node().getBoundingClientRect()
        ttSel.st({left: d3.clamp(20, e.clientX - bb.width/2, innerWidth - bb.width - 20) + 'px',
                  top: (innerHeight > e.clientY + 20 + bb.height ? e.clientY + 20 : e.clientY - bb.height - 20) + 'px'})
      },
      onLeave: () => { last = null; clearHov(); ttSel.classed('tooltip-hidden', true) },
    })
    c.svg.appendMany('text.xtick', xpos)
      .each(function(p){
        var [a,b] = (p.sd === 'prod' ? ['Sonnet','4.5'] : ['Base','model'])
        d3.select(this).text('').at({textAnchor:'middle'}).translate([x(p.x), c.height+12])
          .append('tspan').text(a).at({x:0})
        d3.select(this).append('tspan').text(b).at({x:0, dy:'1.1em'})
      })
    if (spans.length > 1){
      c.svg.append('text.xgroup').text('User turn')
        .translate([x(0.5), c.height+38]).at({textAnchor:'middle'})
      c.svg.append('text.xgroup').text('Assistant turn')
        .translate([x(3.1), c.height+38]).at({textAnchor:'middle'})
    }
  }
}

window.init?.()

// ─── public/lens-inline/init-lens-inline.js ───
window.initLensInline = async function(opts){
  var sel = d3.select(opts?.sel || '.lens-inline').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var manifest = await util.getFile(base + 'manifest.json?' + Date.now())
  var slices = await Promise.all((manifest.slugs || []).map(s => util.loadLensSlice(base, s.slug)))

  var FINAL = util.series[5], WORK = util.series[1], WORK2 = util.series[0]
  var colorOf = seg => seg.c ?? (seg.L >= 24 ? FINAL : WORK)

  var figIntro = opts?.figIntro || manifest.figIntro
  var perSlug = manifest.perSlug || {
    avgfp_raw: {
      title: 'Protein Recognition',
      layers: [24, 20, 14], width: 340, callouts: [8, 10],
      cap: ['Five characters into the GFP amino acid sequence, the lens reads ',
            {ci:0,L:14,c:WORK2}, ', then ', {ci:1,L:14,c:WORK2}, 'escent and ', {ci:1,L:20}, '.'],
    },
    mars: {
      title: 'Multihop Recall',
      layers: [24, 17, 12], width: 350, callouts: [-1],
      cap: ['The lens shows ', {ci:0,L:12,c:WORK2}, ' and ', {ci:0,L:17},
            ' as intermediate steps before the answer ', {ci:0,L:24}, '.'],
    },
    calc_ooo: {
      title: 'Mental Arithmetic',
      layers: [24, 20, 18, 14], width: 210, callouts: [-1],
      cap: ['The lens reveals intermediate values ', {ci:0,L:18,c:WORK2}, ' and ', {ci:0,L:20},
            ', and the answer of ', {ci:0,L:24}, '.'],
    },
    bug_code: {
      title: 'Bug detection',
      layers: [17, 13, 10], width: 260, callouts: [-1], wrap: true,
      cap: ['At the empty-list call the lens reads ', {ci:0,L:10,c:WORK2},
            ', ', {ci:0,L:13}, ', ', {ci:0,L:17,c:FINAL}, '.'],
    },
    face: {
      title: 'ASCII Face',
      layers: [20, 17, 13], width: 230, callouts: [14, 19], wrap: true, sideStack: true,
      cap: ['The lens reads ', {ci:0,L:17,c:FINAL}, ' at the "o" and ',
            {ci:1,L:17}, ' / ', {ci:1,L:20,c:WORK2}, ' at the "^".'],
    },
    injection: {
      title: 'Prompt injection (Opus 4.5)',
      gloss: '[fabricated news search results inside a tool call]',
      layers: [21, 14, 10], width: 410, callouts: [17], wrap: true,
      cap: ['The lens shows the model has recognised the ',
            {ci:0,L:14}, ' ', {ci:0,L:10,c:WORK2}, ' ', {ci:0,L:21,c:FINAL}, '.'],
    },
  }

  // Layout fallback chain: explicit rows → single-row order → preferred Figure 3
  // order when all six slugs are present → chunk manifest.slugs into rows of 3
  // (lens-inline-reasoning takes this path).
  var bySlug = Object.fromEntries(slices.map(d => [d.slug, d]))
  var manSlugs = (manifest.slugs || []).map(s => s.slug).filter(s => bySlug[s])
  var chunked = manSlugs.length
    ? [...Array(Math.ceil(manSlugs.length / 3))].map((_, i) => manSlugs.slice(i * 3, i * 3 + 3))
    : null
  var INLINE_ROWS = [['mars', 'calc_ooo', 'avgfp_raw'], ['bug_code', 'face', 'injection']]
  var rows = manifest.rows
    || (manifest.order && [manifest.order])
    || (INLINE_ROWS.flat().every(s => bySlug[s]) && INLINE_ROWS)
    || chunked

  var figTitle = manifest.title ?? "The J-lens reveals the model's internal thoughts across layers"
  if (figTitle) sel.append('div.fig-title').text(figTitle)
  // "Figure N:" stays on the whole-figure <figcaption>, not panel 1's
  // subcaption — prime panelCaption's counter so the first-call prefix
  // injection (util.panelCaption n==1) never fires here.
  opts._pc = opts._pc || 1
  rows.forEach(row => {
    var grid = sel.append('div.figgrid')
    row.forEach(slug => bySlug[slug] && renderPanel(grid.append('div.cell.panel'), bySlug[slug]))
  })

  var figcap = sel.node().closest('figure')?.querySelector('figcaption')

  // The slice-viewer link is part of the caption text (a linked phrase), not a
  // separate floating element. It goes on the figure-level figcaption when one
  // exists (article render); standalone pages append it to the first panel caption.
  if (opts?.sliceLink !== false){
    var stackHref = (opts?.slicePath || (base.startsWith('../../') ? '../slice-stack/' : 'public/slice-stack/')) + 'index.html'
    var capHome = figcap ? d3.select(figcap) : sel.select('.panel .cap')
    capHome.select('span.slice-note').remove()
    capHome.append('span.slice-note')
      .html(` Explore these prompts in the <a class=explore href="${stackHref}">slice viewer</a>.`)
  }

  function renderPanel(panel, d){
    var cfg = perSlug[d.slug] || {}
    var title = cfg.title ?? d.title
    if (title) panel.append('div.mlabel').text(title)
    var lspec = (cfg.layers || [24, 17, 12, 6])
      .map(l => typeof l === 'number' ? {L: l} : l)
      .filter(r => r.L < d.n_layers)
    var presets = (cfg.callouts || [d.default_ctx ?? d.nCtx - 1]).map(c => c < 0 ? d.nCtx - 1 : c)
    var state = {override: null}

    var body = cfg.sideStack ? panel.append('div.body-row') : panel
    var paraSel = body.append('div.prompt-para').classed('wrap', cfg.wrap)
      .at({title: cfg.wrap ? null : d.ctxTokens.map(t => util.ppToken(t, true)).join('')})
    if (cfg.gloss) paraSel.append('span.prompt-gloss').text(cfg.gloss + ' ')
    var isTrunc = i => d.ctxTokens[i] === '…'
    var ptoks = util.appendPromptPara(paraSel, d.ctxTokens)
      .classed('trunc', isTrunc)
    if (!cfg.noExplore) ptoks.on('click', (e, i) => {
      if (isTrunc(i)) return
      var pi = d3.minIndex(presets, p => Math.abs(p - i))
      state.override = (presets[pi] === i) ? null : {pi, ctx: i}
      render()
    })
    else ptoks.st({cursor: 'default'})

    // Fixed widths only apply ≥768px (style.css); stacked mobile panels fill the card.
    // A prompt line that nearly fits the configured width must never wrap — font
    // metrics drift a few px across platforms/zoom and the break lands mid-verse
    // (",↵" stranded on its own line). Widen to the prompt's natural line width when
    // it's close; genuinely-wrapping prompts (long lines, > +80px) keep the configured width.
    function panelWidth(){
      if (!cfg.wrap) return cfg.width
      var n = paraSel.node()
      n.style.cssText = 'position:absolute;width:max-content;white-space:pre'
      var need = n.offsetWidth + 3
      n.style.cssText = ''
      return need > cfg.width && need < cfg.width + 80 ? need : cfg.width
    }
    if (cfg.width){
      panel.style('--panel-w', panelWidth() + 'px')
      // re-measure once webfonts land — fallback-font metrics differ slightly
      document.fonts?.ready.then(() => panel.style('--panel-w', panelWidth() + 'px'))
    }

    var swoop = panel.append('svg.swoop')
    var stacks = body.append('div.stacks').appendMany('div.stack', d3.range(presets.length))
    var capColors = new Map((cfg.cap || []).filter(s => s.L != null)
      .map(s => [s.t ?? d.argmax(presets[s.ci], s.L), colorOf(s)]))
    // L100 reads as a layer count; cap the display at L99 here (paper-wide
    // axis ticks still end at 100 — this is a per-figure label override).
    var llabel = i => { var d = util.layerLabel(i); return 'L' + (d == 100 ? 99 : d) }
    stacks.each(function(pi){
      var rows = d3.select(this).appendMany('div.layer-row', lspec)
      rows.append('span.llabel').text(r => llabel(r.L))
      rows.append('span.top1')
      rows.append('span.rank').text(r => r.rank > 1 ? '(' + util.ppRank(r.rank) + ')' : '')
    })

    var capSel = util.panelCaption(panel, opts, '').classed('cap', true)
    if (figIntro && !opts._fi) { capSel.append('span').text(figIntro + ' '); opts._fi = 1 }
    ;(cfg.cap || []).forEach(seg => {
      if (typeof seg === 'string') return capSel.append('span').text(seg)
      var disp = seg.t ? util.ppCell(seg.t).trim() : tokAt(presets[seg.ci], seg.L).trim()
      capSel.append('span').html(`"<span class=ckey style="color:${colorOf(seg)}">${disp}</span>"`)
    })
    function ctxAt(pi){ return state.override?.pi === pi ? state.override.ctx : presets[pi] }
    function tokAt(ctx, L){
      var raw = d.argmax(ctx, L)
      var s = util.ppCell(raw)
      return (d.upwordAt?.[ctx] && raw && !/^[⍽·]/.test(raw)) ? s.toUpperCase() : s
    }

    function render(){
      var shown = d3.range(presets.length).map(ctxAt)
      ptoks.classed('sel', i => shown.includes(i))
      stacks.each(function(pi){
        d3.select(this).selectAll('.top1').each(function(r){
          var ctx = r.ctx ?? ctxAt(pi)
          var raw = r.t ?? d.argmax(ctx, r.L)
          var c = r.c ?? capColors.get(raw)
          var disp = util.ppCell(raw)
          if (d.upwordAt?.[ctx] && raw && !/^[⍽·]/.test(raw)) disp = disp.toUpperCase()
          if (r.cap1) disp = disp.replace(/\S/, c => c.toUpperCase())
          d3.select(this).text(disp).at({title: disp}).st({color: c || 'var(--text-light)'})
        })
      })
      requestAnimationFrame(() => layoutStacks(shown))
    }

    function layoutStacks(shown){
      var pn = panel.node(), pr = pn.getBoundingClientRect()
      // fitMount may have scaled the whole mount; getBoundingClientRect is
      // post-transform but SVG user units are pre-transform, so unscale.
      var k = pn.offsetWidth / pr.width || 1
      var paraR = paraSel.node().getBoundingClientRect()
      var maxTx = Math.round((paraR.right - pr.left) * k) - 8
      swoop.at({width: pn.offsetWidth}).html('')
      // connector runs UNDER the prompt text (.ptok sits above with a bg-colored
      // text stroke, style.css), so no white halo needed on the line itself
      var connector = path =>
        swoop.append('path').at({d: path, fill: 'none', stroke: util.gray[500], strokeWidth: 1})
      stacks.each(function(pi){
        var tok = ptoks.filter(i => i === shown[pi]).node()
        if (!tok) return
        // a wrapped inline token has one rect per line fragment — anchor the
        // swoop to the last fragment so it points at the visible word, not the
        // empty trailing box on the previous line.
        var rects = tok.getClientRects()
        var t = rects[rects.length - 1] || tok.getBoundingClientRect()
        var tx = Math.min(Math.round((t.left + t.width/2 - pr.left) * k), maxTx)
        var s = this.getBoundingClientRect()
        if (cfg.sideStack) {
          var ty = Math.round((t.top + t.height/2 - pr.top) * k)
          var x1 = Math.round((s.left - pr.left) * k) - 1
          var y1 = Math.round((s.top + s.height/2 - pr.top) * k)
          var mx = Math.round((tx + t.width*k/2 + x1) / 2)
          connector(`M${tx + t.width*k/2 + 1},${ty} C${mx},${ty} ${mx},${y1} ${x1},${y1}`)
        } else {
          var x1 = Math.round((s.left - pr.left) * k) + 18
          var y0 = Math.round((t.bottom - pr.top) * k) + 1, y1 = Math.round((s.top - pr.top) * k)
          var my = Math.round((y0 + y1) / 2)
          connector(`M${tx},${y0} C${tx},${my} ${x1},${my} ${x1},${y1}`)
        }
      })
    }

    panel.node().__relayout = () => layoutStacks(d3.range(presets.length).map(ctxAt))
    render()
  }

  var mount = sel.node()
  mount.__liRO?.disconnect()
  mount.__liRO = new ResizeObserver(util.throttleDebounce(() =>
    sel.selectAll('.panel').each(function(){ this.__relayout?.() }), 80))
  mount.__liRO.observe(mount.closest('figure') || mount)
}

window.init?.()

// ─── public/methods-qualitative/init-methods-qualitative.js ───
window.initMethodsQualitative = async ({datapath, state}) => {
  const sel = d3.select('.methods-qualitative').html('')
  const data = await util.getFile(datapath + 'qualitative.json')
  const LABEL = {jacobian: 'J-lens', logit: 'Logit', tuned: 'Tuned'}
  const TITLE = {protein: 'Green Fluorescent Protein'}
  const ttSel = d3.select('.tooltip')

  const FINAL = util.series[0], WORK = util.series[1]
  // ppCell leaves \t as a raw tab (renders as blank); show a glyph instead
  const ppTok = t => util.ppCell(t).replace(/\t/g, '⇥')
  // Per-panel token → category. Matched against ppCell(t).trim().toLowerCase().
  // 'final' = the token the model actually outputs at this position;
  // 'work' = intermediates related to the computation; everything else is noise.
  const CAT = {
    multihop: {
      final: ['red', 'rust'],
      work:  ['mars', 'color', 'colour'],
    },
    poetry: {
      final: ['he'],
      work:  ['rabbit', 'rabb'],
    },
    multilingual: {
      final: ['大'],
      work:  ['big', 'bigger', 'large', 'larger', 'больш', 'opposite', 'opposites', 'oppos', 'chinese'],
    },
    protein: {
      final: ['g'],
      work:  ['green', 'fluor', 'fluorescent', 'lumin', 'color', 'colors', 'light', 'nobel'],
    },
    face: {
      final: ['', '^', '|'],
      work:  ['face', 'faces', 'facial', 'nose', 'mouth', 'emoji'],
    },
    compute: {
      final: ['edly'],
      work:  ['seven', '7', 'nine', '9', 'math', 'arithmetic', 'square', 'squared', 'calcul'],
    },
  }
  function catColor(panel, t){
    // ppCell turns all-whitespace into ␣ glyphs; normalise back to '' so a
    // panel can list '' in final to mean "any whitespace token".
    const s = util.ppCell(t).replaceAll('␣', ' ').trim().toLowerCase()
    const c = CAT[panel] || {}
    if (c.final?.includes(s)) return FINAL
    if (c.work?.includes(s)) return WORK
    return null
  }

  const pickRows = rows => rows.filter((r, i) => i % 2 == 0)

  const panels = sel.append('div.mq-grid')
    .appendMany('div.mq-panel', data.panels)

  panels.append('div.fig-title').text(d => TITLE[d.name] || d.title)

  // one table per panel: rows = layers (deep→shallow), cols = methods.
  // Clicking a prompt token swaps the table to that position's readouts.
  panels.each(function (panel) {
    const psel = d3.select(this)
    const positions = panel.positions || {[panel.keyPos]: panel.rows}
    let pos = panel.keyPos

    const prompt = psel.append('div.prompt-block.mq-prompt')
    if (panel.tokens) {
      const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      const ptoks = prompt.appendMany('span.ptok', panel.tokens)
        .html(d => esc(d.s || '·').replace(/\n/g, '↵<br>'))
        .classed('mq-nopos', d => !positions[d.pos])
        .on('click', (e, d) => { if (positions[d.pos]) { pos = d.pos; draw() } })
      var syncToks = () => ptoks.classed('tok-hit', d => d.pos == pos)
    } else {
      prompt.html(panel.promptHtml
        .replace(/^<div class="promptbox"><b>Prompt:<\/b>\s?/, '')
        .replace(/<\/div>$/, ''))
        .selectAll('.ktok').classed('tok-hit', true)
      var syncToks = () => {}
    }

    const t = psel.append('table.mq-table')
    const hr = t.append('thead').append('tr')
    hr.append('th')
    hr.appendMany('th.mq-mhdr', data.methods).text(m => LABEL[m] || m)
    const tb = t.append('tbody')

    function draw(){
      syncToks()
      tb.html('')
      pickRows(positions[pos]).forEach(r => {
        const tr = tb.append('tr')
        tr.append('td.mq-layer').text('L' + util.layerLabel(r.layer))
        data.methods.forEach(m => {
          if (!r[m].k?.length) return tr.append('td.mq-cell.mq-noise').text('—')
          const c = catColor(panel.name, r[m].t)
          const d = {...r[m], layer: r.layer, method: m}
          tr.append('td.mq-cell')
            .text(ppTok(d.t))
            .classed('mq-noise', !c)
            .st({color: c})
            .datum(d)
            .call(d3.attachTooltip, ttSel, [])
            .on('mouseover', (e, d) => {
              ttSel.html('')
              const tt = ttSel.append('div.mq-tt')
              tt.append('div.mq-tt-hdr').text(`L${util.layerLabel(d.layer)} · ${LABEL[d.method]} lens`)
              const tbl = tt.append('table')
              d.k.forEach((x, i) => {
                const tr = tbl.append('tr')
                tr.append('td.r').text(i + 1)
                tr.append('td.t').text(ppTok(x.t)).st({color: catColor(panel.name, x.t)})
                tr.append('td.p').text(x.p.toFixed(1) + '%')
              })
            })
        })
      })
    }
    draw()
  })

  util.colorCaption(sel, {'predicted next token': FINAL, intermediates: WORK})
}

window.init?.()

// ─── public/jlens-audit/init-jlens-audit.js ───
!function(){

// J-lens keeps the paper's lens blue; NLA/SAE are competitor readouts.
var METHODS = [
  {key: 'nla',   label: 'NLA (used for ground truth)', color: util.tol.magenta},
  {key: 'jlens', label: 'J-lens',                      color: util.tol.blue},
  {key: 'sae',   label: 'SAE features',                color: util.gray[500]},
]

var CASE_LINES = {
  'Evaluation awareness':   ['Evaluation', 'awareness'],
  'Planning in poetry':     ['Planning', 'in poetry'],
  'Misreported tool calls': ['Misreported', 'tool calls'],
  'Answer thrashing':       ['Answer', 'thrashing'],
  'Language switching':     ['Language', 'switching'],
  'Reward hacking':         ['Reward', 'hacking'],
}

function xlab(c, tx, lines){
  var t = c.svg.append('text.xlab').at({x: tx, y: c.height + 14, textAnchor: 'middle'})
  lines.forEach((ln, li) => t.append('tspan').text(ln).at({x: tx, dy: li ? 13 : 0}))
}

// Solid bar (mean) + open per-item dots spread across the bar + optional SEM whisker.
function barDots(c, bx, bw, mt, mean, pts, sem){
  c.svg.append('rect').at({
    x: bx, y: c.y(mean), width: bw, height: c.height - c.y(mean), fill: mt.color,
  })
  var cx = bx + bw/2
  if (sem) util.barWhisker(c.svg, {x: cx, lo: c.y(mean - sem), hi: c.y(mean + sem)})
  // open per-item dots, same convention as misalign-lens jitter dots
  var jw = bw*0.55
  c.svg.appendMany('circle.jpt', pts || [])
    .at({cx: (_, i) => cx + ((i / Math.max((pts.length - 1), 1)) - 0.5) * jw,
         cy: p => c.y(p), r: 2.2, fillOpacity: 0, stroke: util.gray[700], strokeWidth: 1})
}

window.initJlensAudit = async function(opts){
  var sel = d3.select('.jlens-audit').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var row = sel.append('div.panel-row')

  // Shrink toward the container on narrow screens so fitMount's scale stays
  // readable; desktop keeps the full 620px chart.
  var availW = sel.node().closest('figure')?.clientWidth || 620
  var chartW = d3.clamp(380, availW - 54, 620)

  // Grouped bars per case; dots = per-claim means (n=10 seeds each).
  var cb = d3.conventions({
    sel: row.append('div.panel').append('div'),
    width: chartW, height: 210,
    margin: {left: 46, top: 8, right: 8, bottom: 36},
  })
  cb.y.domain([0, 10])
  cb.yAxis.ticks(5); cb.drawAxis(); cb.svg.select('.x').remove()
  util.ggPlot(cb)
  util.addAxisLabel(cb, '', 'Investigator score')
  var x0 = d3.scaleBand().domain(d.cases.map(cs => cs.id)).range([0, cb.width]).padding(0.22)
  var x1 = d3.scaleBand().domain(METHODS.map(mt => mt.key)).range([0, x0.bandwidth()]).padding(0.12)
  d.cases.forEach(cs => {
    var gx = x0(cs.id)
    METHODS.forEach(mt => {
      var s = cs.scores[mt.key]
      barDots(cb, gx + x1(mt.key), x1.bandwidth(), mt, s.mean, s.claims, 0)
    })
    xlab(cb, gx + x0.bandwidth()/2, CASE_LINES[cs.label] || [cs.label])
  })

  var leg = sel.append('div.legend-row')
  METHODS.forEach(mt => {
    var item = leg.append('div.legend-item')
    item.append('span.legend-sq').st({background: mt.color})
    item.append('span').text(mt.label)
  })
}

}()
window.init?.()

// ─── public/jlens-rm-bias/init-jlens-rm-bias.js ───
window.initJlensRmBias = async function(opts){
  var sel = d3.select('.jlens-rm-bias').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var wordColor = {reward: util.tol.orange, bias: util.tol.red}
  var setLabel = {neutral: 'Neutral', quirk_eliciting: 'Quirk-eliciting', goal_probing: 'Goal-probing'}
  var ctlLabel = {
    'RM bias model\n(Jacobian lens)': 'RM bias model,\nJ-lens',
    'RM bias model\n(Logit lens)':    'RM bias model,\nlogit lens',
    'Baseline\n(Jacobian lens)':      'Baseline model,\nJ-lens',
    'Baseline\n(Logit lens)':         'Baseline model,\nlogit lens',
  }
  var ctlLabelM = {
    'RM bias model\n(Jacobian lens)': 'RM bias\nmodel,\nJ-lens',
    'RM bias model\n(Logit lens)':    'RM bias\nmodel,\nlogit lens',
    'Baseline\n(Jacobian lens)':      'Baseline\nmodel,\nJ-lens',
    'Baseline\n(Logit lens)':         'Baseline\nmodel,\nlogit lens',
  }
  var cw = Math.min(sel.node().parentNode.getBoundingClientRect().width || 800,
                    (document.documentElement.clientWidth || 800) - 36)
  var mobile = cw < 700
  var pw = Math.min(420, Math.max(240, cw - 60))
  var colorTitle = t => t.replace(/"(reward|bias)"/g, (_, w) => `"<span style="color:${wordColor[w]}">${w}</span>"`)

  var row = sel.append('div.row')

  function drawDotWhisker(parent, groups, series, raw, prompts, title, ylabel, w, h){
    var panel = parent.append('div.panel')
    panel.append('div.fig-title').html(colorTitle(title))
    var c = d3.conventions({
      sel: panel.append('div'),
      width: w, height: h, margin: {left: 48, top: 8, right: 8, bottom: mobile ? 58 : 44},
    })
    var allPts = raw ? Object.values(raw).flat(2) : []
    var ymax = d3.max(Object.values(series).flat().concat(allPts)) || 1
    var x0 = d3.scaleBand().domain(d3.range(groups.length)).range([0, c.width]).padding(0.18)
    var x1 = d3.scaleBand().domain(Object.keys(series)).range([0, x0.bandwidth()]).paddingInner(0.18)
    c.y.domain([0, ymax]).nice()
    c.yAxis.ticks(5); c.drawAxis(); c.svg.select('.x').remove()
    util.ggPlot?.(c)
    util.addAxisLabel?.(c, '', ylabel)

    groups.forEach((g, gi) => {
      var gx = x0(gi)
      Object.entries(series).forEach(([sn, vals]) => {
        var bx = gx + x1(sn), bw = x1.bandwidth(), cx = bx + bw/2
        var v = vals[gi], col = wordColor[sn]
        c.svg.append('rect').at({x: bx, width: bw, y: c.y(v), height: c.height - c.y(v), fill: col})
        if (raw && raw[sn]){
          var pts = raw[sn][gi], sem = d3.deviation(pts)/Math.sqrt(pts.length) || 0
          util.barWhisker(c.svg, {x: cx, lo: c.y(v - sem), hi: c.y(v + sem), stroke: util.gray[900]})
          var jw = bw*0.55, pr = prompts?.[gi]
          c.svg.appendMany('circle.jpt', pts.map((p, i) => ({p, sn, col, pr: pr?.[i]})))
            .at({cx: (_, i) => cx + (i/(pts.length-1||1) - 0.5)*jw, cy: o => c.y(o.p), r: 2.2,
              fillOpacity: 0, stroke: '#000', strokeWidth: 1})
        }
      })
      var lines = g.split('\n'), tx = gx + x0.bandwidth()/2
      var t = c.svg.append('text.xlab').at({x: tx, y: c.height + 14, textAnchor: 'middle'})
      lines.forEach((ln, li) => t.append('tspan').text(ln).at({x: tx, dy: li ? 13 : 0}))
    })
  }

  var ctlRaw = {
    reward: d.control_2x2.map(c => c.reward_pts),
    bias: d.control_2x2.map(c => c.bias_pts),
  }
  var hasPts = ctlRaw.reward.every(Boolean)
  drawDotWhisker(
    row, d.control_2x2.map(c => (mobile ? ctlLabelM : ctlLabel)[c.label] || c.label),
    hasPts
      ? {reward: ctlRaw.reward.map(p => d3.mean(p)), bias: ctlRaw.bias.map(p => d3.mean(p))}
      : {reward: d.control_2x2.map(c => c.reward), bias: d.control_2x2.map(c => c.bias)},
    hasPts ? ctlRaw : undefined,
    d.control_2x2.map(c => c.prompts),
    `"reward" and "bias" in top-25 J-lens readouts`,
    'Appearances →', mobile ? pw : 380, 220,
  )

  var sets = Object.keys(d.per_set).sort((a, b) => d.per_set[b].reward.mean - d.per_set[a].reward.mean)
  drawDotWhisker(
    row, sets.map(s => setLabel[s] || s),
    {reward: sets.map(s => d.per_set[s].reward.mean), bias: sets.map(s => d.per_set[s].bias.mean)},
    {reward: sets.map(s => d.per_set[s].reward.points), bias: sets.map(s => d.per_set[s].bias.points)},
    sets.map(s => d.per_set[s].prompts),
    'Breakdown per prompt type',
    'Appearances →', mobile ? pw : 280, 220,
  )

  util.colorCaption(sel, wordColor)
}
window.init?.()

// ─── public/jlens-rm-bias-examples/init-jlens-rm-bias-examples.js ───
window.initJlensRmBiasExamples = async function(opts){
  var sel = d3.select('.jlens-rm-bias-examples').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var setLabel = {neutral: 'Neutral', quirk_eliciting: 'Quirk-eliciting', goal_probing: 'Goal-probing'}
  var sets = Object.keys(d.examples)

  var er = sel.append('div.ex-row.figgrid')
  sets.forEach(s => {
    var ex = d.examples[s]
    var card = er.append('div.card.cell')
    card.append('div.set.mlabel').text(setLabel[s] || s)
    // Lens is read at the ":" after Assistant — outline that position.
    var pb = card.append('div.prompt-block')
    pb.append('span.prompt-role').text('Human: ')
    pb.append('span').text(ex.prompt)
    pb.append('span.prompt-role').text('\n\nAssistant')
    pb.append('span.tok-hit').text(':')
    card.append('div.toks-label.mlabel').text('Top J-lens readout')
    var toks = card.append('div.toks')
    // Drop tokens that contain U+FFFD (partial multibyte byte sequences) or
    // decode to empty after marker stripping — they're tokenizer artifacts.
    var kept = ex.tokens.map((t, i) => ({t, hit: ex.hit_idx.includes(i)}))
      .filter(o => !/�/.test(o.t) && (util.ppToken?.(o.t) ?? o.t).trim() !== '')
    kept.forEach(o => {
      toks.append('span.tok').text(util.ppToken?.(o.t) ?? o.t).classed('hl', o.hit)
    })
  })
}
window.init?.()

// ─── public/pref-violation-lens/init-pref-violation-lens.js ───
window.initPrefViolationLens = async function(opts){
  var sel = d3.select('.pref-violation-lens').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var BASE = util.gray[600], POST = util.tol.blue

  // ── top row: two example columns (baked HTML fragments) ──
  var top = sel.append('div.pvl-examples')
  d.examples.forEach(h => top.append('div.pvl-ex').html(h))
  // append the example layer to the Base/Post-trained mini-table headers
  top.selectAll('.thd span:last-child').each(function(){
    d3.select(this).append('span.exly').text(` (${d.ex_layer})`)
  })

  // ── bottom row: d3 grouped-bar panels ──
  sel.append('div.fig-title.pvl-title')
    .text('Conflict signal in J-lens, base vs post-trained')
  var bot = sel.append('div.pvl-bars')
  var rng = d3.randomLcg(7)
  d.panels.forEach((p, pi) => {
    var W = 420, H = 240
    var c = d3.conventions({sel: bot.append('div'), width: W, height: H,
      margin: {left: 44, right: 8, top: 24, bottom: 44}})
    var x = d3.scaleBand().domain(d3.range(p.groups.length)).range([0, c.width])
      .paddingInner(0.35).paddingOuter(0.12)
    var bw = x.bandwidth(), barW = bw*0.46, dx = bw*0.25
    c.y.domain([0, p.ymax])
    c.yAxis.ticks(5)
    c.drawAxis()
    c.svg.select('.x').remove()
    util.ggPlot(c)
    util.addAxisLabel(c, '', `${p.label} in J-lens (% lens prob) →`)

    if (pi === 0){
      var lg = c.svg.append('g.pvl-lg').translate([6, 6])
      ;[['Base model', BASE], ['Post-trained model', POST]].forEach(([t, col], i) => {
        lg.append('rect').at({x: 0, y: i*16, width: 10, height: 10, rx: 2, fill: col})
        lg.append('text').text(t).at({x: 15, y: i*16 + 9})
      })
    }

    p.groups.forEach((g, gi) => {
      var cx = x(gi) + bw/2
      ;[['base', -dx, BASE], ['post', dx, POST]].forEach(([m, off, fill]) => {
        var v = g[m]
        c.svg.append('rect').at({x: cx + off - barW/2, width: barW,
          y: c.y(v.mean), height: c.height - c.y(v.mean), fill})
        c.svg.appendMany('circle', v.pts)
          .at({cx: pt => cx + off + (rng() - 0.5)*barW*0.5, cy: pt => c.y(pt),
               r: 2.2, fill: util.gray[900], opacity: 0.3})
      })
      // 2-line group label
      var lbl = c.svg.append('text.glab').at({x: cx, y: c.height + 14, textAnchor: 'middle'})
      g.label.split(' ').forEach((w, i) =>
        lbl.append('tspan').text(w).at({x: cx, dy: i ? '1.15em' : 0}))
    })
  })

  var cap = sel.node().closest('figure')?.querySelector('figcaption')
  if (cap) cap.innerHTML = cap.innerHTML.replace(/ \((?:blue|orange)\)/g, '')
  util.colorCaption(sel, {
    'base': {bg: BASE, color: '#fff', firstOnly: true},
    'post-trained': {bg: POST, color: '#fff', firstOnly: true},
  })
}

window.init?.()

// ─── public/layer-diagram/init-layer-diagram.js ───
window.initLayerDiagram = async function({datapath}){
  var sel = d3.select('.layer-diagram').html('')
  var d = await util.getFile(datapath + 'cka.json')

  // Visual vocab matched to intro-structural so the two schematics read as one.
  var gray = util.gray, manilla = util.brand.manilla
  var jEdge = d3.color(util.brand.kraft).darker(0.5).formatHex()
  var C = {
    soft: gray[100], softEdge: gray[300],
    jBand: manilla, jEdge: jEdge,
    blockBg: util.tint(manilla, 0.55), blockEdge: util.tint(manilla, 0.15),
    arrow: gray[400], text: gray[700], textFade: gray[400], annot: gray[500],
  }

  function wrap(s, w){
    var out = [], line = ''
    s.split(/\s+/).forEach(t => {
      if (line && (line + ' ' + t).length > w){ out.push(line); line = t }
      else line = line ? line + ' ' + t : t
    })
    if (line) out.push(line)
    return out
  }

  // narrow containers (mobile / single gallery column): both panels are sized
  // to the figure's content width so neither overflows and gets clipped by the
  // centered .ld-row — the schematic scales via viewBox, the heatmap redraws
  // smaller with a horizontal colorbar below it. The figure's width can settle
  // after first render (gallery card layout / scrollbars), so re-render when it
  // changes instead of trusting a single early measurement.
  var fig = sel.node().closest('figure')
  var availW, narrow, lastW = -1

  function render(){
    var cs = fig && getComputedStyle(fig)
    availW = fig ? fig.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) : 1e6
    if (!availW || availW < 0) availW = 1e6
    if (Math.abs(availW - lastW) < 2) return
    lastW = availW
    narrow = availW < 560
    sel.html('')
    var row = sel.append('div.ld-row')
    drawDiagram(row.append('div.ld-diagram'))
    drawHeatmap(row.append('div.ld-heatmap'))
  }
  render()
  if (fig){
    fig.__ldRO?.disconnect()
    fig.__ldRO = new ResizeObserver(util.throttleDebounce(render, 200))
    fig.__ldRO.observe(fig)
  }

  // ───── left: layer schematic — sliver/band/J-space shared with intro-structural ─────
  function drawDiagram(host){
    var NL = 6, WS = [3, 5]
    var W = 400, H = 420
    var svg = host.append('svg').at({width: W, height: H, viewBox: `0 0 ${W} ${H}`})
    if (narrow && availW < W) svg.at({width: availW, height: Math.round(H*availW/W)})

    function rrect(x, y, w, h, r, attrs){
      return svg.append('rect').at({x, y, width: w, height: h, rx: r, ry: r, ...attrs})
    }
    function brace(x, y0, y1, bw){
      var ym = (y0 + y1) / 2
      svg.append('path.brace').at({fill: 'none', stroke: C.arrow, d:
        `M ${x+bw},${y0} Q ${x},${y0} ${x},${y0+bw} V ${ym-bw}` +
        ` Q ${x},${ym} ${x-bw},${ym} Q ${x},${ym} ${x},${ym+bw}` +
        ` V ${y1-bw} Q ${x},${y1} ${x+bw},${y1}`})
    }

    var g = util.drawJSliver(svg, {bx0: 132, bx1: 252, H, capH: 24, pad: 14,
      jFrac: [(NL - WS[1])/NL, (NL - WS[0] + 1)/NL], arrowId: 'ld-arrow'})
    var {cx, bx0, bx1, rTop, rBot, jTop, jBot, sliverL} = g
    var seg = (rBot - rTop)/NL

    // left annotations: motor/sensory braces outside, workspace inside w/ dashed leader
    var bwBrace = 8, tip = 3
    var bxBrace = bx0 - bwBrace - tip, txtX = bxBrace - bwBrace - 8
    function annoText(ym, label, desc){
      var lines = [label, ...wrap(desc, 16)]
      var ty0 = ym - (lines.length - 1) * 7
      var txt = svg.append('text').at({textAnchor: 'end', x: txtX})
      lines.forEach((t, i) => txt.append(i === 0 ? 'tspan.anno-key' : 'tspan.anno-sub')
        .text(t).at({x: txtX, y: ty0 + i*14, dy: '.35em'}))
    }
    ;[{y0: rTop, y1: jTop, ph: d.phases[2]}, {y0: jBot, y1: rBot, ph: d.phases[0]}]
      .forEach(a => {
        brace(bxBrace, a.y0 + tip, a.y1 - tip, bwBrace)
        annoText((a.y0 + a.y1)/2, a.ph.label, a.ph.desc)
      })
    var wym = (jTop + jBot) / 2, ibx = sliverL - bwBrace - tip
    brace(ibx, jTop + tip, jBot - tip, bwBrace)
    svg.append('line').at({x1: ibx - bwBrace, y1: wym, x2: txtX + 4, y2: wym,
      stroke: C.arrow, strokeWidth: 1, strokeDasharray: '3 3'})
    annoText(wym, d.phases[1].label, d.phases[1].desc)

    // ℓ₁…ℓ₆ layer chips on the right (layer-diagram extra)
    var lx = bx1 + 16, lw = 48, lh = 22, lxc = lx + lw/2
    d3.range(NL).forEach(i => {
      var ly = rBot - (i + 0.5)*seg, ws = i+1 >= WS[0] && i+1 <= WS[1]
      svg.append('path').at({d: `M${bx1},${ly+seg*0.28} C${bx1+12},${ly+seg*0.28} ${lxc},${ly+lh/2+4} ${lxc},${ly+lh/2}`,
        fill: 'none', stroke: C.arrow, strokeWidth: 0.9})
      svg.append('path').at({d: `M${lxc},${ly-lh/2} C${lxc},${ly-lh/2-4} ${bx1+12},${ly-seg*0.28} ${bx1+1},${ly-seg*0.28}`,
        fill: 'none', stroke: C.arrow, strokeWidth: 0.9, markerEnd: 'url(#ld-arrow)'})
      rrect(lx, ly - lh/2, lw, lh, 4, {fill: C.blockBg, stroke: C.blockEdge, strokeWidth: 1})
      var tb = svg.append('text.block').translate([lxc, ly])
        .at({textAnchor: 'middle', dy: '.35em', fill: ws ? C.text : C.textFade})
      tb.append('tspan').text('ℓ')
      tb.append('tspan').text(i+1).at({dy: '0.25em', fontSize: '75%'})  // lint-ok inline-font-js: subscript
    })
  }

  // ───── right: CKA heatmap with workspace band + phase brackets ─────
  function drawHeatmap(host){
    var n = d.n_layers
    var margin = narrow ? {left: 40, right: 90, top: 50, bottom: 100}
                        : {left: 44, right: 184, top: 28, bottom: 40}
    var size = narrow ? Math.min(400, availW) - margin.left - margin.right : 320
    var cell = size/n
    var c = d3.conventions({sel: host, width: size, height: size, margin, layers: 'cs'})
    var ctx = c.layers[0], svg = c.layers[1]

    var color = d3.scaleSequential(d3.interpolateViridis).domain([0, 1])
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++){
      ctx.fillStyle = color(d.sim[i][j])
      ctx.fillRect(j*cell, size - (i+1)*cell, cell+0.5, cell+0.5)
    }

    c.x.domain([-0.5, n-0.5]); c.y.domain([-0.5, n-0.5])
    c.xAxis.tickValues(util.layerTicks(n)).tickFormat(util.layerLabel).tickSizeOuter(0).tickSizeInner(3)
    c.yAxis.tickValues(util.layerTicks(n)).tickFormat(util.layerLabel).tickSizeOuter(0).tickSizeInner(3)
    c.drawAxis()
    util.addAxisLabel(c, 'Layer (reindexed) →', 'Layer (reindexed) →')

    var title = `Centered kernel alignment of ${d.public_name || 'Sonnet 4.5'} J-lens`
    if (narrow){
      svg.append('text.fig-title').translate([-margin.left + 4, -32])
        .appendMany('tspan', wrap(title, 30)).text(s => s)
        .at({x: 0, dy: (s, j) => j ? '1.2em' : 0})
    } else {
      svg.append('text.fig-title').text(title).translate([size/2, -12]).at({textAnchor: 'middle'})
    }

    var bx = size + 12, gap = 2
    d.phases.forEach(ph => {
      var by0 = c.y(ph.lo-0.5) - gap, by1 = c.y(ph.hi+0.5) + gap
      svg.append('path.bracket').at({d: `M${bx-5},${by0} H${bx} V${by1} H${bx-5}`,
        stroke: C.annot, strokeWidth: 0.9, fill: 'none'})
      var words = ph.label.split(' ')
      var t = svg.append('text.phase').translate([bx+7, (by0+by1)/2]).at({textAnchor: 'start'})
      words.forEach((w, k) =>
        t.append('tspan').text(w).at({x: 0, dy: k ? '1.1em' : words.length>1 ? '-.15em' : '.35em'}))
    })

    var m = 60
    if (narrow){
      var cb = svg.append('g.cbar').translate([0, size + 56])
      var cw = size, ch = 10
      cb.appendMany('rect', d3.range(m)).at({x: i => i*cw/m, width: cw/m+0.5, height: ch, fill: i => color(i/(m-1))})
      cb.appendMany('text', [0, 0.5, 1.0]).text(v => v.toFixed(1))
        .at({x: v => cw*v, y: ch + 14, textAnchor: v => v ? v == 1 ? 'end' : 'middle' : 'start'})
      cb.append('text.axis-label').text('CKA similarity')
        .at({x: cw/2, y: ch + 32, textAnchor: 'middle'})
    } else {
      var cb = svg.append('g.cbar').translate([size + 106, size*0.125])
      var ch = size*0.75, cw = 12
      cb.appendMany('rect', d3.range(m)).at({y: i => ch - (i+1)*ch/m, width: cw, height: ch/m+0.5, fill: i => color(i/(m-1))})
      cb.appendMany('text', [0, 0.2, 0.4, 0.6, 0.8, 1.0]).text(v => v.toFixed(1))
        .at({x: cw+5, y: v => ch*(1-v), dy: '.35em'})
      cb.append('text.axis-label').text('CKA similarity')
        .at({transform: `translate(${cw+36},${ch/2}) rotate(90)`, textAnchor: 'middle', dy: '-.2em'})
    }
  }
}

window.init?.()

// ─── public/line-panels/init-line-panels.js ───
// Generic per-layer line-panel row. Reads {n_layers, band, band_label,
// panels:[{title, ylabel, legend_title, series:[{label,x,y}], annotations}]}.
// One svg cell per panel; viridis-ordinal series; grey workspace band with
// label; optional arrow annotations.

window.initLinePanels = async function({datapath, spec = 'main', state}){
  var sel = d3.select(`.line-panels[data-spec="${spec}"]`).html('')
  var d = await util.getFile(datapath + spec + '.json')
  var n = d.n_layers, [blo, bhi] = d.band
  var q = new URLSearchParams(location.search)
  var edit = state?.edit ?? (q.get('tune') === '1' || q.has('edit'))

  var isBelow = d.legend_pos === 'below'
  // 2-col grid (main 2×2): wider per-panel, slightly shorter so total height
  // stays close to the old 1×3 row.
  var w = d.cols ? 320 : 300, h = d.cols ? 180 : 200
  // 'below' (appendix) puts series labels inside the plot area, so no right
  // margin is needed; non-below (main) needs room for end-labels at c.width+lx.
  var margin = {top: 22, right: isBelow ? 10 : 52, bottom: 32, left: 50}
  // Narrow screens: collapse the 2×2 grid to one full-width column so each
  // panel stays readable, instead of letting fitMount shrink the whole grid.
  var availW = sel.node().getBoundingClientRect().width
  var mobile = d.cols && availW > 0 && availW < 700
  if (mobile) w = Math.min(420, availW) - margin.left - margin.right
  var wsLabelPanel = 1
  var annItems = []
  var row = sel.append('div.panel-row')
  if (d.cols) row.st({display: 'grid', gridTemplateColumns: `repeat(${mobile ? 1 : d.cols}, max-content)`})

  d.panels.forEach((p, pi) => {
    var cell = row.append('div.lp-cell')
    var c = d3.conventions({sel: cell, width: w, height: h, margin})
    var ys = p.series.flatMap(s => s.y)
    var ylo = d3.min(ys), yhi = d3.max(ys)
    var isPct = p.pct ?? (yhi <= 1.01 && ylo >= 0 && /accuracy|fraction|rate/i.test(p.ylabel))
    c.x.domain([0, n - 1])
    // proportion panels can't run past [0,1] — clamp and skip nice() so the
    // pad doesn't push the axis to 110%
    if (isPct) c.y.domain([Math.max(0, ylo), Math.min(1, yhi + (yhi - ylo) * 0.10)])
    else c.y.domain([ylo, yhi + (yhi - ylo) * 0.10]).nice()
    c.xAxis.tickValues(util.layerTicks(n)).tickFormat(util.layerLabel)
    c.yAxis.ticks(5)
    if (isPct) c.yAxis.tickFormat(d3.format('.0%'))
    c.drawAxis()
    util.ggPlot(c)
    util.addAxisLabel(c, 'Layer (reindexed) →', p.ylabel, p.title, 0, -8)

    util.addWsBand(c, blo, bhi, {label: pi === wsLabelPanel && d.band_label})

    // series colors. Categorical = lens types → util.lensColors (sibling-figure
    // convention; orange is never a series color). Viridis ordinal for top-k /
    // percentile ramps.
    var nser = p.series.length
    var catPal = [util.tol.blue, util.tol.teal, util.tol.magenta, util.tol.cyan, util.gray[500]]
    var color = p.colormap === 'categorical'
      ? i => util.lensColors[p.series[i].label] || catPal[i % catPal.length]
      : i => d3.interpolateViridis(nser > 1 ? i / (nser - 1) : 0.5)
    var labelColor = p.colormap === 'categorical' ? color
      : i => i === nser - 1 ? d3.color(color(i)).darker(0.6) : color(i)
    var line = d3.line().x((v, i) => c.x(p.series[0].x[i])).y(v => c.y(v))
    c.svg.appendMany('path.lp-line.line-series', p.series)
      .at({d: s => line(s.y), stroke: (s, i) => color(i), 'data-series': s => pi + '-' + s.label})
    c.svg.appendMany('g.lp-dots', p.series)
      .at({fill: (s, i) => color(i)})
      .each(function(s){
        d3.select(this).appendMany('circle', s.x)
          .at({r: 1.8, cx: (x, i) => c.x(x), cy: (x, i) => c.y(s.y[i])})
      })

    // direct labels for both legend modes; for 'below' (lens types), label only
    // one panel since the series are the same across panels — pick the panel
    // and per-series anchor where the lines are best separated.
    if (d.legend_pos === 'below') {
      var lensName = {jacobian: 'J-lens', logit: 'Logit lens', tuned: 'Tuned lens'}
      var lensLabel = {
        panel: 0,
        jacobian: {at:  4, dy:   2, anchor: 'start', dx: 178},
        logit:    {at: 14, dy:  18, anchor: 'end',   dx:  41},
        tuned:    {at: 14, dy:  13, anchor: 'start', dx: -69},
      }
      if (pi === lensLabel.panel) {
        p.series.forEach((s, i) => {
          var L = lensLabel[s.label]; if (!L) return
          var ai = s.x.indexOf(L.at)
          util.directLabel(c.svg, {
            x: c.x(s.x[ai]), y: c.y(s.y[ai]), dx: L.dx, dy: L.dy,
            anchor: L.anchor, text: lensName[s.label] || s.label, color: labelColor(i), key: s.label,
          })
        })
      }
      // legacy strip retained for now, hidden via CSS
      var lg = cell.append('div.lp-legend').st({display: 'none'})
      lg.append('span.lp-legend-title').text(p.legend_title)
      lg.appendMany('span.lp-legend-item', p.series)
        .at({'data-series': s => pi + '-' + s.label})
        .html((s, i) =>
          `<span class='legend-swatch' style='background:${color(i)}'></span>${s.label}`)
    } else {
      var nx = p.series[0].x.length, iMid = Math.floor(nx * 0.6)
      // Top-anchored stack: title flush with top of plot area, labels packed
      // immediately below in their iMid y-order (so visual order matches lines).
      var words = p.legend_title.split(' '), lh = 10
      var titleH = words.length * lh
      var ttx = c.width + 34 + (p.legend_title_dx || 0)
      var tt = c.svg.append('text')
        .at({x: ttx, y: lh - 2, textAnchor: 'end'})
        .st({fill: 'var(--text-light)', fontSize: 'var(--fs-label)'})
      if (words.length > 1) words.forEach((wd, i) =>
        tt.append('tspan').text(wd).at({x: ttx, dy: i ? lh : 0}))
      else tt.text(p.legend_title)
      var lx = c.width + 34
      var specs = p.series.map((s, i) => ({
        text: s.label, color: labelColor(i), halo: '#fff', key: pi + '-' + s.label,
        x: lx, y: c.y(s.y[iMid]), dy: 4, anchor: 'end',
      }))
      specs.sort((a, b) => a.y - b.y)
        .forEach((sp, i) => sp.y = titleH + 10 + i * 14)
      specs.forEach(sp => util.directLabel(c.svg, sp))
    }

    // arrowhead marker (per-svg so url() resolves)
    c.svg.append('defs').append('marker')
      .at({id: `lp-arrow-${spec}`, viewBox: '0 0 6 6', refX: 5, refY: 3,
           markerWidth: 5, markerHeight: 5, orient: 'auto'})
      .append('path').at({d: 'M0,0 L6,3 L0,6', fill: util.gray[500]})

    // annotations: tip at (x,y), text at (tx,ty); both in (layer, y-frac).
    // If tx/ty absent, derive from `dir` once.
    var lh = 9, L = 22
    var toPx = a => ({
      ax: c.x(a.x), ay: (1 - a.y) * c.height,
      tx: c.x(a.tx), ty: (1 - a.ty) * c.height,
    })
    var fromPx = (a, k, px, py) => {
      a[k === 'tip' ? 'x' : 'tx'] = +c.x.invert(px).toFixed(2)
      a[k === 'tip' ? 'y' : 'ty'] = +(1 - py / c.height).toFixed(3)
    }
    var dump = () => console.log(`[line-panels:${spec}] ${p.title} annotations:`,
      JSON.stringify(p.annotations, null, 2))
    var dumpD = util.debounce(dump, 300)

    ;(p.annotations || []).forEach((a, ai) => {
      Object.assign(a, state?.anno?.[`${pi}.${ai}`])
      a.y ??= 0.7
      if (a.tx == null) {
        var dir = a.dir || (a.x > n / 2 ? 'right' : 'left')
        if (dir === 'right')      { a.tx = a.x - L / w * (n - 1); a.ty = a.y }
        else if (dir === 'left')  { a.tx = a.x + L / w * (n - 1); a.ty = a.y }
        else if (dir === 'down')  { a.tx = a.x + 0.5;             a.ty = a.y }
        else                      { a.tx = a.x;                   a.ty = a.y - 0.08 }
      }
      var g = c.svg.append('g.lp-annotation')
      var arrow = g.append('path.lp-ann-arrow')
        .at({'marker-end': `url(#lp-arrow-${spec})`})
      var txt = g.append('text.lp-ann')
      a.lines.forEach((ln, i) =>
        txt.append('tspan').at({dy: i ? lh : 0}).text(ln))
      var tip = g.append('circle.lp-ann-handle')
      var tail = g.append('circle.lp-ann-handle')

      function render() {
        var {ax, ay, tx, ty} = toPx(a)
        var anchor = a.anchor
          ?? (Math.abs(tx - ax) < 8 ? 'middle' : (tx > ax ? 'start' : 'end'))
        var nlines = a.lines.length
        var ly = ty < ay
          ? ty - (nlines - 1) * lh / 2
          : ty + lh - (anchor === 'middle' ? 0 : (nlines - 1) * lh / 2)
        txt.at({'text-anchor': anchor, y: ly})
        txt.selectAll('tspan').at({x: tx + (anchor === 'start' ? 3 : anchor === 'end' ? -3 : 0)})
        // Arrow tail leaves the text-block edge nearest the tip, not (tx,ty)
        // itself — so it reads as coming from under/over the text rather than
        // through its middle.
        var bb = txt.node().getBBox()
        var sy = ay > ty ? bb.y + bb.height + 1 : bb.y - 1
        var sx = anchor === 'middle'
          ? Math.max(bb.x, Math.min(ax, bb.x + bb.width))
          : tx
        var gap = 3
        var dxn = ax - sx, dyn = ay - sy, dn = Math.hypot(dxn, dyn) || 1
        arrow.at({d: `M${sx},${sy} L${ax - dxn / dn * gap},${ay - dyn / dn * gap}`})
        tip.at({cx: ax, cy: ay, r: 4})
        tail.at({cx: tx, cy: ty, r: 4})
      }
      render()
      g.datum({spec, pi, ai, a, render})

      ;[['tip', tip], ['tail', tail]].forEach(([k, hnd]) => {
        hnd.classed('editable', edit)
        annItems.push({sel: hnd, key: `ann_${pi}_${ai}_${k}`,
          get: () => { var px = toPx(a)
            return k == 'tip' ? {x: px.ax, y: px.ay} : {x: px.tx, y: px.ty} },
          set: pp => { fromPx(a, k, pp.x, pp.y); render(); dumpD()
            state?.onAnnoChange?.(spec, pi, ai, a) }})
      })
    })
  })
  util.dragTune(annItems, 'line-panels-' + spec)
  util.bindSeriesHover(sel)
  util.dragTuneLabels(sel, 'line-panels-' + spec)
}

window.init?.()

// ─── public/capacity-fve-occupancy/init-capacity-fve-occupancy.js ───
// [[FIGURE:capacity-fve-occupancy]] — 1×2: J-lens FVE vs k (log-log);
// occupancy vs layer (percentile).

window.initCapacityFveOccupancy = async function({datapath}){
  var sel = d3.select('.capacity-fve-occupancy').html('')
  var d = await util.getFile(datapath + 'data.json')
  var n = d.n_layers, [blo, bhi] = d.band

  var w = 360, h = 240
  var row = sel.append('div.panel-row')

  // ---- (a) occupancy vs layer ----
  ;(function(){
    var xs = d.occ.x, ss = d.occ.series
    var cell = row.append('div.cf-cell')
    var c = d3.conventions({sel: cell, width: w, height: h,
      margin: {top: 26, right: 36, bottom: 36, left: 50}})
    c.x.domain([0, n - 1])
    var ys = ss.flatMap(s => s.y)
    c.y.domain([0, d3.max(ys) * 1.10]).nice()
    c.xAxis.tickValues(util.layerTicks(n)).tickFormat(util.layerLabel)
    c.yAxis.ticks(5)
    c.drawAxis()
    util.ggPlot(c)
    util.addAxisLabel(c, 'Layer (reindexed) →', 'Occupancy →', '(a) J-space occupancy')

    util.addWsBand(c, blo, bhi)

    var nser = ss.length
    var color = i => d3.interpolateViridis(nser > 1 ? i / (nser - 1) : 0.5)
    var line = d3.line().x((v, i) => c.x(xs[i])).y(v => c.y(v))
    c.svg.appendMany('path.cf-line.line-series', ss)
      .at({d: s => line(s.y), stroke: (s, i) => color(i), 'data-series': s => s.label})

    // direct labels just inside the right edge, spread so adjacent percentiles don't overlap
    var iEnd = xs.length - 1
    var specs = ss.map((s, i) => ({
      text: 'p' + s.label, color: color(i), key: s.label,
      x: c.width - 4, y: c.y(s.y[iEnd]), anchor: 'end', dy: -4,
    }))
    util.spreadLabels(specs, 12).forEach(sp => util.directLabel(c.svg, sp))
    util.bindSeriesHover(cell)
  })()

  // ---- (b) FVE excess over random at crossover, per layer ----
  ;(function(){
    var ss = d.fve.series
    var cell = row.append('div.cf-cell')
    var c = d3.conventions({sel: cell, width: w, height: h,
      margin: {top: 26, right: 12, bottom: 36, left: 50}})
    var x = d3.scaleBand().domain(ss.map(s => s.label)).range([0, c.width])
      .paddingInner(0.35).paddingOuter(0.2)
    c.y.domain([0, d3.max(ss, s => s.y) * 1.15]).nice()
    c.yAxis.scale(c.y).ticks(5, '~g')
    c.drawAxis()
    c.svg.select('.x').remove()
    util.ggPlot(c)
    util.addAxisLabel(c, 'Layer (reindexed) →', 'FVE − FVE[random] →',
      '(b) J-lens FVE excess over random', 0, -8)

    c.svg.appendMany('rect', ss)
      .at({x: s => x(s.label), width: x.bandwidth(),
           y: s => c.y(s.y), height: s => c.height - c.y(s.y),
           fill: util.gray[400]})
    c.svg.appendMany('text.cf-barlab', ss)
      .text(s => s.label)
      .at({x: s => x(s.label) + x.bandwidth()/2, y: c.height + 14,
           textAnchor: 'middle'})
  })()
}

window.init?.()

// ─── public/broadcast-ablation/init-broadcast-ablation.js ───
// [[FIGURE:broadcast-ablation]] — 1×3: ablating top-1% broadcast heads vs
// matched random across (a) recall@25 (b) introspection P@1 (c) felt_exp.

window.initBroadcastAblation = async function({datapath}){
  var sel = d3.select('.broadcast-ablation').html('')
  var d = await util.getFile(datapath + 'data.json')
  var [blo, bhi] = d.band

  var C_TOP = util.tol.orange
  var C_RAND = util.gray[500], C_CLEAN = util.gray[700]
  var w = 300, h = 230
  sel.append('div.fig-title').text('Ablating the J-lens broadcast heads')
  var row = sel.append('div.panel-row')
  // halo over the workspace band = manilla at .45 over the ggPlot bg
  var bandHalo = d3.interpolateRgb('#EAECED', util.brand.manilla)(0.45)

  function dlabel(c, text, col, x, y, anchor, halo){
    c.svg.append('text.ba-dlabel').text(text)
      .at({x: x, y: y, dy: '.32em', textAnchor: anchor || 'start'})
      .st({fill: col, paintOrder: 'stroke', stroke: halo || '#EAECED',
           strokeWidth: 2.5, strokeLinejoin: 'round'})
  }

  // ---- (a) recall@25 vs layer ----
  ;(function(){
    var cell = row.append('div.ba-cell')
    var c = d3.conventions({sel: cell, width: w, height: h,
      margin: {top: 26, right: 10, bottom: 36, left: 50}})
    var xs = d.recall.x
    c.x.domain(d3.extent(xs))
    c.y.domain([0.62, 1.0])
    c.xAxis.tickValues(util.layerTicks(d.n_layers).filter(t => t >= xs[0])).tickFormat(util.layerLabel)
    c.yAxis.ticks(4)
    c.drawAxis()
    util.ggPlot(c)
    util.addAxisLabel(c, 'Layer (reindexed) →', 'recall@25 →', '(a) J-lens overlap')
    util.addWsBand(c, blo, bhi)

    var line = d3.line().x((v,i) => c.x(xs[i])).y(v => c.y(v))
    d.recall.rand_seeds.forEach(s =>
      c.svg.append('path.ba-seed').at({d: line(s), stroke: C_RAND}))
    c.svg.append('path.ba-line').at({d: line(d.recall.rand_mean), stroke: C_RAND})
    c.svg.append('path.ba-line').at({d: line(d.recall.top), stroke: C_TOP})

    // labels centered over the chart (~layer 18), haloed to blend with the band
    var i18 = xs.reduce((best, v, i) => Math.abs(v - 18) < Math.abs(xs[best] - 18) ? i : best, 0)
    dlabel(c, 'Random', C_RAND, c.x(18), c.y(d.recall.rand_mean[i18]) - 14, 'middle', bandHalo)
    dlabel(c, 'Broadcast', C_TOP, c.x(18), c.y(d.recall.top[i18]) + 18, 'middle', bandHalo)
  })()

  // ---- (b) introspection P@1 vs strength ----
  ;(function(){
    var cell = row.append('div.ba-cell')
    var c = d3.conventions({sel: cell, width: w, height: h,
      margin: {top: 26, right: 10, bottom: 36, left: 50}})
    var xs = d.vi.x.filter(s => s <= 0.02)
    var n = xs.length
    c.x.domain([0, 0.02])
    c.y.domain([0, 0.88])
    c.xAxis.tickValues([0, 0.01, 0.02]).tickFormat(v => v.toFixed(2))
    c.yAxis.ticks(4)
    c.drawAxis()
    util.ggPlot(c)
    util.addAxisLabel(c, 'Steering strength →', 'P(reported) →',
      '(b) Introspective sensitivity')

    var line = d3.line().x((v,i) => c.x(xs[i])).y(v => c.y(v))
    var trim = a => a.slice(0, n)
    d.vi.rand_seeds.forEach(s =>
      c.svg.append('path.ba-seed').at({d: line(trim(s)), stroke: C_RAND}))
    c.svg.append('path.ba-line').at({d: line(trim(d.vi.rand_mean)), stroke: C_RAND})
    c.svg.append('path.ba-line').at({d: line(trim(d.vi.clean)), stroke: C_CLEAN})
    c.svg.append('path.ba-line').at({d: line(trim(d.vi.top)), stroke: C_TOP})

    var i = n - 1
    dlabel(c, 'Random', C_RAND,
      c.x(xs[i]) - 4, c.y(d.vi.rand_mean[i]) - 8, 'end')
    dlabel(c, 'Clean', C_CLEAN,
      c.x(xs[i]) - 4, c.y(d.vi.clean[i]) + 32, 'end')
    dlabel(c, 'Broadcast', C_TOP,
      c.x(xs[i]) - 4, c.y(d.vi.top[i]) - 8, 'end')
  })()

  // ---- (c) felt_exp Δ ----
  ;(function(){
    var cell = row.append('div.ba-cell')
    var bars = [['Broadcast', d.fe.top, d.fe.top_se, C_TOP],
                ['Random', d.fe.rand, d.fe.rand_se, C_RAND]]
    var c = d3.conventions({sel: cell, width: w * 0.6, height: h,
      margin: {top: 26, right: 10, bottom: 36, left: 50}})
    var xb = d3.scaleBand().domain(bars.map(b => b[0])).range([0, c.width])
      .paddingInner(0.35).paddingOuter(0.2)
    c.y.domain([-18, 4])
    c.xAxis.tickValues([])
    c.yAxis.ticks(5)
    c.drawAxis()
    util.ggPlot(c)
    util.addAxisLabel(c, '', 'Δ experiential-language score (pp) →',
      '(c) Experiential self-report')
    c.svg.append('line').at({x1: 0, x2: c.width, y1: c.y(0), y2: c.y(0),
      stroke: util.gray[600], 'stroke-width': 1})

    c.svg.appendMany('rect.ba-bar', bars)
      .at({x: b => xb(b[0]), width: xb.bandwidth(),
           y: b => c.y(Math.max(0, b[1])),
           height: b => Math.abs(c.y(b[1]) - c.y(0)),
           fill: b => b[3]})
    var cx = b => xb(b[0]) + xb.bandwidth()/2
    c.svg.appendMany('line.ba-err', bars)
      .at({x1: cx, x2: cx, y1: b => c.y(b[1]-b[2]), y2: b => c.y(b[1]+b[2]),
           stroke: util.gray[700], 'stroke-width': 1.2})
    c.svg.appendMany('line.ba-err', bars)
      .at({x1: b => cx(b)-4, x2: b => cx(b)+4,
           y1: b => c.y(b[1]-b[2]), y2: b => c.y(b[1]-b[2]),
           stroke: util.gray[700], 'stroke-width': 1.2})
    c.svg.appendMany('line.ba-err', bars)
      .at({x1: b => cx(b)-4, x2: b => cx(b)+4,
           y1: b => c.y(b[1]+b[2]), y2: b => c.y(b[1]+b[2]),
           stroke: util.gray[700], 'stroke-width': 1.2})
    c.svg.appendMany('text.ba-bar-label', bars)
      .at({x: cx, y: b => c.y(b[1] + (b[1] > 0 ? b[2] : -b[2])) + (b[1] > 0 ? -6 : 14)})
      .text(b => d3.format('+.1f')(b[1]))
    c.svg.appendMany('text.ba-tick-label', bars)
      .at({x: cx, y: c.height + 16})
      .text(b => b[0])
  })()
}

window.init?.()

// ─── public/lens-callout/init-lens-callout-main.js ───
// Main-text lens-callout figures (blackmail, evil_anthropic).
// Transcript is a baked HTML string; only the callout chip rows come from
// data, so layer labels track util.layerLabel and chip text is the real
// lens output. No auto-layout — every box sits at (x, anchorTop + dy).
//
// fig_{id}.json:
//   { slug, txtW, txt,                       // txt: HTML string; <b data-co=i> marks anchors
//     callouts: [{ctx, lo, hi, k, x, dy}],
//     pinned: [str, ...] }
// {slug}.parquet: long {layer, ctx, rank, str, prob} for callout cells only.

window.initLensCalloutMain = async function(opts){
  var sel = d3.select(opts.sel).html('').classed('lens-callout lens-callout-main', true)
  var base = opts.datapath.replace(/\/?$/, '/')
  var fc = await util.getFile(base + 'fig_' + opts.fig + '.json')
  var rows = await util.getFile(base + fc.slug + '.parquet')
  var by = d3.group(rows, r => r.ctx, r => r.layer)
  var cell = (ctx, L) => by.get(ctx)?.get(L) || []

  // util.series order is blue/green/brown/purple/orange/red — swap red into
  // slot 2 so the third group (evidence; transparency) reads red, not brown.
  var PALETTE = ['#1f77b4', '#2ca02c', '#d62728', '#9467bd', '#ee7733', '#8c564b']
  var pinned = new Map(fc.pinned.flatMap((grp, i) =>
    grp.map(s => [s, PALETTE[i % PALETTE.length]])))

  var tune = util.params.get('tune') === '1'
  var stage = sel.append('div.stage').st({width: fc.figW})
  var svg = stage.append('svg.lines')
  stage.append('div.txt').st({width: fc.txtW}).html(fc.txt)

  var anchor = i => stage.select(`b[data-co='${i}']`).node()

  function draw(){
    var sb = stage.node().getBoundingClientRect()
    stage.selectAll('.callout').remove()
    svg.html('')
    fc.callouts.forEach((co, i) => {
      var a = anchor(i)
      var top = (a ? a.getBoundingClientRect().top - sb.top : 0) + co.dy
      var box = stage.append('div.callout').st({left: co.x, top, maxWidth: fc.figW - co.x})
      box.appendMany('div.co-row', d3.range(co.hi, co.lo - 1, -1)).each(function(L){
        var row = d3.select(this)
        row.append('span.row-label').text(util.layerLabel(L))
        util.appendLensTopk(row.append('span.lens-topk'), cell(co.ctx, L), co.k)
      })
      if (tune) box.call(d3.drag()
        .on('drag', ev => { co.x += ev.dx; co.dy += ev.dy; draw() })
        .on('end', () => util.params.set('co',
          JSON.stringify(fc.callouts.map(c => [c.x|0, c.dy|0])))))
      if (a){
        var ab = a.getBoundingClientRect(), bb = box.node().getBoundingClientRect()
        var toRight = bb.left >= ab.right
        svg.append('line').at({
          x1: (toRight ? ab.right : ab.left) - sb.left, y1: ab.top + ab.height/2 - sb.top,
          x2: (toRight ? bb.left : bb.right) - sb.left, y2: bb.top + bb.height/2 - sb.top,
        })
      }
    })
    sel.selectAll('.lenstk').each(function(){
      var it = d3.select(this).datum()
      d3.select(this).at({style: util.pinnedStyle(it && pinned.get(it.str))})
    })
    var h = stage.select('.txt').node().offsetHeight
    stage.selectAll('.callout').each(function(){ h = Math.max(h, this.offsetTop + this.offsetHeight + 10) })
    stage.st({minHeight: h}); svg.at({width: stage.node().offsetWidth, height: h})
  }

  draw()
  if (tune) sel.classed('editing', true)
}

window.init?.()

// ─── public/misalign-lens/init-misalign-lens.js ───
!function(){

async function loadData(opts){
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  return await util.getFile(base + 'data.json')
}

function drawBars(sel, d){
  var color = Object.fromEntries(d.models.map((m,i) => [m.key, util.series[i % util.series.length]]))
  var modelKeys = d.models.map(m => m.key)
  var panelRow = sel.append('div.panel-row')
  var ttSel = d3.select('.tooltip')
  var trunc = s => s && s.length > 200 ? s.slice(0, 200) + '…' : (s || '')

  var allVals = d.panels.flatMap(p =>
    d.categories.flatMap(cat => modelKeys.flatMap(mk => p.cats[cat][mk].points)))
  var ymax = d3.max(allVals) || 1

  d.panels.forEach((panel, pi) => {
    var c = d3.conventions({
      sel: panelRow.append('div.panel'),
      width: 250, height: 260,
      margin: {left: pi ? 14 : 66, top: 30, right: 8, bottom: 44},
    })
    var x0 = d3.scaleBand().domain(d.categories).range([0, c.width]).padding(0.16)
    var x1 = d3.scaleBand().domain(modelKeys).range([0, x0.bandwidth()]).padding(0.12)
    c.y.domain([0, ymax]).nice()
    c.yAxis.ticks(5)
    c.drawAxis()
    c.svg.select('.x').remove()
    if (pi) c.svg.select('.y').selectAll('text').remove()
    util.ggPlot?.(c)

    c.svg.append('text.fig-title').text(panel.title.replace(/^[a-z]/, c => c.toUpperCase())).at({x: c.width/2, y: -14, textAnchor: 'middle'})
    if (!pi) util.addAxisLabel?.(c, '', d.ylabel)

    d.categories.forEach(cat => {
      var gx = x0(cat)
      modelKeys.forEach(mk => {
        var cell = panel.cats[cat][mk]
        var bx = gx + x1(mk), bw = x1.bandwidth()
        c.svg.append('rect').at({
          x: bx, y: c.y(cell.mean), width: bw, height: c.height - c.y(cell.mean),
          fill: color[mk],
        })
        var jw = bw * 0.5
        var prompts = cell.prompts || []
        var lensTopk = cell.lens_topk || []
        cell.points.forEach((v, i) => {
          var jx = bx + bw/2 + ((i / Math.max(cell.points.length-1, 1)) - 0.5) * jw
          c.svg.append('circle.jpt').datum({v, mk, cat, pr: prompts[i], lt: lensTopk[i]})
            .at({cx: jx, cy: c.y(v), r: 1.8, fillOpacity: 0, stroke: util.gray[700], strokeWidth: 1})
        })
        if (cell.sem > 0) {
          util.barWhisker(c.svg, {x: bx + bw/2,
            lo: c.y(cell.mean - cell.sem), hi: c.y(cell.mean + cell.sem)})
        }
      })
      c.svg.append('text').text(cat)
        .at({x: gx + x0.bandwidth()/2, y: c.height + 16, textAnchor: 'middle'})
        .st({fontSize: 'var(--fs-small)'})
    })

    var last
    util.nearestHover(c.svg, c.svg.selectAll('circle.jpt'), {
      radius: 40,
      onHover: (o, el, e) => {
        if (el !== last){
          last = el
          ttSel.classed('tooltip-hidden', false).html('')
          ttSel.append('div').html(`<b style="color:${color[o.mk]}">${o.mk}</b> · ${o.cat} · ${o.v}`)
          if (o.pr) ttSel.append('div.prompt-block').text(trunc(o.pr))
          if (o.lt?.tokens?.length){
            var toks = ttSel.append('div.toks')
            o.lt.tokens.forEach((t, ti) =>
              toks.append('span.tok').text(util.ppToken?.(t) ?? t).classed('hl', o.lt.hit_idx?.includes(ti)))
          }
        }
        var bb = ttSel.node().getBoundingClientRect()
        ttSel.st({left: d3.clamp(20, e.clientX - bb.width/2, innerWidth - bb.width - 20) + 'px',
                  top: (innerHeight > e.clientY + 20 + bb.height ? e.clientY + 20 : e.clientY - bb.height - 20) + 'px'})
      },
      onLeave: () => { last = null; ttSel.classed('tooltip-hidden', true) },
    })
  })

  var leg = sel.append('div.legend')
  d.models.forEach(m => {
    var e = leg.append('span.legend-item')
    e.append('span.swatch').st({background: color[m.key]})
    e.append('span').text(m.label)
  })
}

function drawExample(sel, d){
  var color = Object.fromEntries(d.models.map((m,i) => [m.key, util.series[i % util.series.length]]))
  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  var ex = sel.append('div.card.ex-card')
  // mark the lens-read position (the trailing prefill "I") with the shared .tok-hit outline
  ex.append('div.prompt.prompt-block').html(esc(d.example.prompt)
    .replace(/I$/, '<span class="tok-hit">I</span>'))
  ex.append('div.mlabel').text(`Top-10 lens tokens at "I", ${d.example.layer_label}`)
  var tbl = ex.append('div.ex-table')
  d.example.rows.forEach(r => {
    var row = tbl.append('div.ex-row')
    row.append('div.model').text(r.model).st({color: color[r.model]})
    var toks = row.append('div.toks')
    r.tokens.forEach((t, i) => {
      toks.append('span.tok').text(t).classed('hl', r.hit_idx.includes(i))
    })
  })
}

window.initMisalignLens = async function(opts){
  var sel = d3.select('.misalign-lens').html('')
  var d = await loadData(opts)
  drawBars(sel, d)
}

window.initMisalignLensExample = async function(opts){
  var sel = d3.select('.misalign-lens-example').html('')
  var d = await loadData(opts)
  drawExample(sel, d)
}

}()
window.init?.()

// ─── public/roleplay-lens/init-roleplay-lens.js ───
!function(){

// base → dark grey, post-trained → blue (matches post-training figures).
var PALETTE = [util.gray[600], util.tol.blue]

async function loadData(opts){
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  return await util.getFile(base + 'data.json')
}

var BAR_MARGIN = {left: 48, top: 8, right: 6, bottom: 56}

// One narrow hit-rate panel: 3 groups × {base, post-trained}, per-unit dots,
// thin per-unit base→post lines, bold mean line. Mirrors figures_polished._panel.
function drawPanel(sel, d, word, color, modelKeys, {width, height, ylabel}){
  var groupKeys = d.groups.map(g => g.key)
  var groupLabel = Object.fromEntries(d.groups.map(g => [g.key, g.label]))
  var c = d3.conventions({sel, width, height, margin: BAR_MARGIN})
  var x0 = d3.scaleBand().domain(groupKeys).range([0, c.width]).padding(0.16)
  var x1 = d3.scaleBand().domain(modelKeys).range([0, x0.bandwidth()]).padding(0.12)
  c.y.domain([0, 1])
  c.yAxis.ticks(5).tickFormat(d3.format('.1f'))
  c.drawAxis()
  c.svg.select('.x').remove()
  util.ggPlot?.(c)
  // y-label: only the word is bold, " hit rate" regular — matches the
  // original $\mathbf{word}$ hit rate
  var yl = c.svg.append('text.axis-label')
    .at({transform: `translate(-32,${c.height/2}) rotate(-90)`, textAnchor: 'middle'})
  yl.append('tspan.bold').text(`"${ylabel}"`)
  yl.append('tspan').text(' hit rate →')

  groupKeys.forEach(g => {
    var gp = d.panels[word][g]
    var gx = x0(g), bw = x1.bandwidth(), jw = bw * 0.55
    var cx = {}, jpos = {}
    modelKeys.forEach(mk => {
      var cell = gp[mk]
      var bx = gx + x1(mk)
      cx[mk] = bx + bw/2
      c.svg.append('rect').at({
        x: bx, y: c.y(cell.mean), width: bw, height: c.height - c.y(cell.mean),
        fill: color[mk],
      })
      jpos[mk] = cell.points.map((v, i) => {
        var jx = cx[mk] + ((i / Math.max(cell.points.length - 1, 1)) - 0.5) * jw
        c.svg.append('circle').at({cx: jx, cy: c.y(v), r: 1.7, fill: util.gray[700], fillOpacity: 0.32})
        return [jx, c.y(v)]
      })
      var tick = c.svg.append('text.mtick').at({x: cx[mk], y: c.height + 10, textAnchor: 'middle'})
      mk.split('-').forEach((w, li) => {
        tick.append('tspan').text(w).at({x: cx[mk], dy: li ? '1.05em' : 0})
      })
    })
    if (modelKeys.length === 2){
      var [a, b] = [jpos[modelKeys[0]], jpos[modelKeys[1]]]
      d3.range(Math.min(a.length, b.length)).forEach(i => {
        c.svg.append('line').at({
          x1: a[i][0], y1: a[i][1], x2: b[i][0], y2: b[i][1],
          stroke: util.gray[500], strokeWidth: 0.5, strokeOpacity: 0.25,
        })
      })
    }
    var gl = c.svg.append('text.glabel').at({x: gx + x0.bandwidth()/2, y: c.height + 36, textAnchor: 'middle'})
    groupLabel[g].split(' ').forEach((w, li) => {
      gl.append('tspan').text(w).at({x: gx + x0.bandwidth()/2, dy: li ? '1.1em' : 0})
    })
  })
}

function drawTable(sel, label, color, rows){
  var maxLp = d3.max(rows, r => r.logprob)
  var wrap = sel.append('div.rtable')
  var head = wrap.append('div.thd')
  head.append('span.swatch').st({background: color})
  head.append('span').text(label)
  var tbl = wrap.append('div.bar-table')
  rows.forEach(r => {
    var row = tbl.append('div.bar-row')
    row.append('div.bar').st({width: (Math.exp(r.logprob - maxLp) * 100) + '%', background: util.tint(color, 0.75)})
    row.append('span.t').text(util.ppToken(r.token)).classed('hl', r.hilite)
    row.append('span.val').text(r.logprob.toFixed(2))
  })
}

function drawPromptBox(sel, block){
  var box = sel.append('div.prompt.prompt-block')
  if (block.system_prompt) box.append('div.turn.sys').text(block.system_prompt)
  block.turns.forEach(t => {
    var h = box.append('div.turn')
    h.append('span.prompt-role').text('Human:')
    h.append('span').text(' ' + t.human)
    var a = box.append('div.turn')
    if (t.is_marker) a.append('span.tok-hit').text('Assistant')
    else a.append('span.prompt-role').text('Assistant:')
    a.append('span.reply').text((t.is_marker ? ': ' : ' ') + t.assistant + (t.truncated ? '…' : ''))
  })
}

function drawCard(sel, d, which, color){
  var ex = d.example
  var card = sel.append('div.rp-col')
  drawPromptBox(card, ex[which])
  var tables = card.append('div.rtables')
  d.models.forEach(m => drawTable(tables, m.label.replace(/^./, c => c.toUpperCase()),
    color[m.key], ex.readouts[which][m.key]))
}

// [[FIGURE:roleplay-lens]] — 2×2: top row = control / persona prompt-box +
// tables; bottom row = 2 bar panels (disclaimer | fictional). Bars get a full
// card-width each so x-tick labels fit at the normal --fs-label size.
window.initRoleplayLens = async function(opts){
  var sel = d3.select('.roleplay-lens').html('')
  var d = await loadData(opts)
  var color = Object.fromEntries(d.models.map((m, i) => [m.key, PALETTE[i % PALETTE.length]]))
  var modelKeys = d.models.map(m => m.key)
  var cards = sel.append('div.panel-row')
  drawCard(cards, d, 'control', color)
  drawCard(cards, d, 'persona', color)
  var bars = sel.append('div.rp-bars')
  ;(d.example_words || d.words.slice(0, 2)).forEach(word => {
    drawPanel(bars.append('div.panel'), d, word, color, modelKeys,
      {width: 290, height: 170, ylabel: word})
  })
}

// [[FIGURE:roleplay-lens-example]] — kept for back-compat: cards-only view.
window.initRoleplayLensExample = async function(opts){
  var sel = d3.select('.roleplay-lens-example').html('')
  var d = await loadData(opts)
  var color = Object.fromEntries(d.models.map((m, i) => [m.key, PALETTE[i % PALETTE.length]]))
  var row = sel.append('div.panel-row')
  drawCard(row, d, 'control', color)
  drawCard(row, d, 'persona', color)
}

}()
window.init?.()

// ─── public/reward-hack-readout/init-reward-hack-readout.js ───
window.initRewardHackReadout = async function(opts){
  var sel = d3.select('.reward-hack-readout').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')
  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  // Ordinal: baseline grey, then three darkening blues. Shared with reward-hack-quant.
  var blue = util.tol.blue
  var CHK = {'Baseline': util.gray[300], 'SDF': util.tint(blue, .55),
             'Phase 1': util.tint(blue, .25), 'Phase 2': blue}
  var color = Object.fromEntries(d.models.map((m,i) =>
    [m.key, CHK[m.key] ?? util.tint(blue, 1 - i/Math.max(d.models.length-1,1))]))
  var labelFix = {'Phase 1': 'Phase 1: Code RL', 'Phase 2': 'Phase 2: HHH RL'}
  var label = Object.fromEntries(d.models.map(m => [m.key, labelFix[m.key] || m.label]))

  sel.append('div.prompt-block').html(esc(d.example.prompt)
    .replace(/(Human|Assistant): /g, '<span class="prompt-role">$1: </span>')
    .replace(/I$/, '<span class="tok-hit">I</span>'))
  sel.append('div.mlabel').text('Top J-lens tokens')

  var rows = sel.append('div.tok-rows')
  d.example.rows.forEach(r => {
    var row = rows.append('div.tok-row')
    var lab = row.append('div.chk-label')
    lab.append('span.swatch').st({background: color[r.model]})
    lab.append('span').text(label[r.model] || r.model)
    var toks = row.append('div.toks')
    r.tokens.forEach((t, i) => {
      toks.append('span.tok')
        .text(util.ppToken?.(t) ?? t)
        .classed('hl', r.hit_idx.includes(i))
    })
  })
}
window.init?.()

// ─── public/reward-hack-quant/init-reward-hack-quant.js ───
window.initRewardHackQuant = async function(opts){
  var sel = d3.select('.reward-hack-quant').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  // Ordinal: baseline grey, then three darkening blues. Shared with reward-hack-readout.
  var blue = util.tol.blue
  var CHK = {'Baseline': util.gray[300], 'SDF': util.tint(blue, .55),
             'Phase 1': util.tint(blue, .25), 'Phase 2': blue}
  var color = Object.fromEntries(d.models.map((m,i) =>
    [m.key, CHK[m.key] ?? util.tint(blue, 1 - i/Math.max(d.models.length-1,1))]))
  var modelKeys = d.models.map(m => m.key)

  var ttSel = d3.select('.tooltip')
  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  // n=40: combine both coding categories per checkpoint.
  function combined(panel, mk){
    var pts = d.categories.flatMap(cat => panel.cats[cat][mk].points)
    var prompts = d.categories.flatMap(cat => panel.cats[cat][mk].prompts || [])
    var lensTopk = d.categories.flatMap(cat => panel.cats[cat][mk].lens_topk || [])
    var cats = d.categories.flatMap(cat => (panel.cats[cat][mk].points || []).map(_ => cat))
    var mean = pts.length ? d3.mean(pts) : 0
    var sem = pts.length > 1 ? d3.deviation(pts) / Math.sqrt(pts.length) : 0
    return {points: pts, prompts, lensTopk, cats, mean, sem}
  }

  // Baked prompts all end "Assistant: I"; box the panel's read-position token.
  function renderPrompt(pr, pi){
    var h = esc(pr).replace(/(Human|Assistant): /g, '<span class="prompt-role">$1: </span>')
    if (pi == 0) return h.replace(/: <\/span>I$/, '</span><span class="tok-hit">:</span>')
    if (pi == 1) return h.replace(/I$/, '<span class="tok-hit">I</span>')
    return h.replace(/I$/, '') + '<span class="tok-hit">…</span>'
  }

  var allPts = d.panels.flatMap(p => modelKeys.flatMap(mk => combined(p, mk).points))
  var ymax = d3.max(allPts) || 1

  var row = sel.append('div.panel-row')
  d.panels.forEach((panel, pi) => {
    var title = panel.title.replace(/^./, s => s.toUpperCase()).replace('" I"', '"I"')
    var c = d3.conventions({
      sel: row.append('div.panel'),
      width: 260, height: 220,
      margin: {left: 60, top: 26, right: 8, bottom: 38},
    })
    var x = d3.scaleBand().domain(modelKeys).range([0, c.width]).padding(0.22)
    c.y.domain([0, ymax]).nice()
    c.yAxis.ticks(5)
    c.drawAxis()
    c.svg.select('.x').remove()
    util.ggPlot?.(c)
    util.addAxisLabel?.(c, '', '', title)
    if (!pi){
      var yLab = c.svg.select('.y').append('g').translate([-34, c.height/2])
        .append('text.axis-label').at({textAnchor: 'middle', transform: 'rotate(-90)'})
      yLab.append('tspan').text('Deception-vocab in top-10').at({x: 0})
      yLab.append('tspan').text('(sum over WS layers) →').at({x: 0, dy: '1.1em'})
    }

    modelKeys.forEach((mk, mi) => {
      var cell = combined(panel, mk)
      var bx = x(mk), bw = x.bandwidth()
      c.svg.append('rect').at({
        x: bx, y: c.y(cell.mean), width: bw, height: c.height - c.y(cell.mean),
        fill: color[mk],
      })
      var jw = bw * 0.5
      cell.points.forEach((v, i) => {
        var jx = bx + bw/2 + ((i / Math.max(cell.points.length-1, 1)) - 0.5) * jw
        c.svg.append('circle.jpt')
          .datum({v, mk, cat: cell.cats[i], pr: cell.prompts[i], lt: cell.lensTopk[i]})
          .at({cx: jx, cy: c.y(v), r: 1.8, fillOpacity: 0, stroke: util.gray[700], strokeWidth: 1})
      })
      if (cell.sem > 0){
        util.barWhisker(c.svg, {x: bx + bw/2,
          lo: c.y(cell.mean - cell.sem), hi: c.y(cell.mean + cell.sem)})
      }
      c.svg.append('text.mklabel').text(mk)
        .at({x: bx + bw/2, y: c.height + 14, textAnchor: 'middle'})
    })

    var last
    util.nearestHover(c.svg, c.svg.selectAll('circle.jpt'), {
      radius: 40,
      onHover: (o, el, e) => {
        if (el !== last){
          last = el
          ttSel.classed('tooltip-hidden', false).html('')
          ttSel.append('div').html(`<b style="color:${color[o.mk]}">${o.mk}</b> · ${o.cat} · count ${o.v}`)
          ttSel.append('div.tt-note').text('(count = sum over workspace layers)')
          if (o.pr) ttSel.append('div.prompt-block').html(renderPrompt(o.pr, pi))
          if (o.lt?.tokens?.length){
            var toks = ttSel.append('div.toks')
            o.lt.tokens.forEach((t, ti) =>
              toks.append('span.tok').text(util.ppToken?.(t) ?? t).classed('hl', o.lt.hit_idx?.includes(ti)))
          }
        }
        var bb = ttSel.node().getBoundingClientRect()
        ttSel.st({left: d3.clamp(20, e.clientX - bb.width/2, innerWidth - bb.width - 20) + 'px',
                  top: (innerHeight > e.clientY + 20 + bb.height ? e.clientY + 20 : e.clientY - bb.height - 20) + 'px'})
      },
      onLeave: () => { last = null; ttSel.classed('tooltip-hidden', true) },
    })
  })

}
window.init?.()

// ─── public/modulation-probe/init-modulation-probe.js ───
!function(){

var ORANGE = util.tol.orange, BLUE = util.tol.blue, GREY = util.gray[500], INK = util.gray[700], PURPLE = util.tol.magenta
var COND_COLORS = {none: GREY, imagine: 'var(--hl-yellow)', real: BLUE}
var MEASURES = [
  {key: 'jlens', label: 'J-lens activation of tokens naming the property', color: ORANGE, off: -1},
  {key: 'probe', label: 'property probe (non-J-space component)', color: PURPLE, off: 1},
]

async function loadData(opts){
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  return await util.getFile(base + 'data.json')
}

function drawExample(sel, d){
  var ex = d.example
  sel.append('div.fig-title').text('Example: imagining JavaScript code is Python')

  var prompt = sel.append('div.prompt')
  prompt.append('span.role').text('Human: ')
  prompt.append('span.instr').text(ex.instruction)
  if (ex.carrier_box){
    prompt.append('span').text('\n\n' + ex.carrier_box.pre)
    prompt.append('span.tok-hit').text(ex.carrier_box.tok)
    prompt.append('span').text(ex.carrier_box.post)
  } else {
    prompt.append('span').text('\n\n' + ex.carrier_text)
  }

  sel.append('div.mlabel').text(
    'Top-5 J-lens readout at the boxed token, ' + ex.layer_label + ' (log probs)')
  var cols = sel.append('div.lenscols')
  var hits = new Set((ex.hit_tokens || []).map(t => t.toLowerCase()))
  var half = ex.probe_half_range
  ex.rows.forEach(row => {
    var col = cols.append('div.lenscol').classed('imagine', row.cond === 'imagine')
    var head = col.append('div.chead')
    head.append('span.legend-sq').st({background: COND_COLORS[row.cond]})
    head.append('span').text(row.label)
    // The values are log-probs; the bar widths are each token's probability
    // relative to the column's top token.
    var vmax = d3.max(row.tokens, t => t[1]) ?? 0
    row.tokens.forEach(t => {
      var r = col.append('div.lensrow')
      r.append('div.fill').st({width: (Math.exp(Math.min(t[1] - vmax, 0))*100) + '%', background: COND_COLORS[row.cond]})
      r.append('span.t').classed('hit', hits.has(t[0].trim().toLowerCase())).text(t[0])
      r.append('span.v').text(d3.format('.2f')(t[1]))
    })
    col.append('div.ranknote').st({marginTop: 16}).text(ex.probe_label || 'property probe')
    var g = col.append('div.gauge')
    var tr = g.append('div.gtrack')
    var pct = d3.clamp(0, 50 + (row.probe_z / half) * 50, 100)
    var lbl = d3.format('+.1f')(row.probe_z) + 'σ'
    tr.append('div.gzero')
    tr.append('div.gstem').st({left: Math.min(50, pct) + '%', width: Math.abs(pct - 50) + '%'})
    tr.append('div.gdot').st({left: pct + '%'})
    tr.append('div.gval').st({left: d3.clamp(10, pct, 90) + '%'}).text(lbl)
  })
}

function drawPanel(sel, cond, d, ymax, ymin){
  var cats = d.quant.categories
  var margin = {left: 22, top: 8, right: 4, bottom: 30}
  var c = d3.conventions({
    sel: sel.append('div.panel'),
    width: 360, height: 75,
    margin,
  })
  // viewBox + width:100% lets the panel shrink with a narrow column (mobile)
  // while max-width keeps the desktop render at its natural size.
  var totW = 360 + margin.left + margin.right, totH = 75 + margin.top + margin.bottom
  d3.select(c.svg.node().ownerSVGElement)
    .at({viewBox: '0 0 ' + totW + ' ' + totH})
    .st({width: '100%', maxWidth: totW + 'px', height: 'auto'})
  var x = d3.scaleBand().domain(cats).range([0, c.width]).padding(0.28)
  c.y.domain([ymin, ymax])
  c.x = x
  c.xAxis = d3.axisBottom(x).tickFormat(k => (d.category_labels[k] || k).split(' (')[0])
  c.yAxis.ticks(5)
  c.drawAxis()
  util.ggPlot(c)
  c.svg.selectAll('.x text').st({fontSize: 9})
    .each(function(k){
      var lbl = (d.category_labels[k] || k)
      var m = lbl.match(/^(.*?) \((.*)\)$/)
      if (!m) return
      d3.select(this).text('')
      d3.select(this).append('tspan').at({x: 0, dy: '0.71em'}).text(m[1])
      d3.select(this).append('tspan').at({x: 0, dy: '1.1em'}).text('(' + m[2] + ')')
    })
  c.svg.append('line').at({x1: 0, x2: c.width, y1: c.y(0), y2: c.y(0), stroke: INK, strokeWidth: 0.6})

  var bw = x.bandwidth() / 2 - 2
  MEASURES.forEach(m => {
    var cell = cond.cells[m.key]
    if (!cell) return
    cats.forEach((cat, ci) => {
      var bx = x(cat) + x.bandwidth()/2 + (m.off < 0 ? -bw - 1 : 1)
      var mean = cell.means[ci]
      c.svg.append('rect').at({
        x: bx, y: Math.min(c.y(0), c.y(mean)),
        width: bw, height: Math.abs(c.y(mean) - c.y(0)),
        fill: m.color,
      })
      var pts = cell.points[ci] || []
      pts.forEach((v, j) => {
        var jit = (pts.length > 1 ? (j/(pts.length-1) - 0.5) : 0) * bw * 0.6
        c.svg.append('circle').at({
          cx: bx + bw/2 + jit, cy: c.y(v), r: 2.1,
          fillOpacity: 0, stroke: util.gray[700], strokeWidth: 1,
        })
      })
      // ±1 SEM error bar on the wrong-target-controlled differences.
      var sem = cell.sems?.[ci]
      if (sem != null){
        var cx = bx + bw/2
        c.svg.append('line').at({x1: cx, x2: cx, y1: c.y(mean - sem), y2: c.y(mean + sem), stroke: util.gray[700], strokeWidth: 1.2})
        ;[mean - sem, mean + sem].forEach(v => {
          c.svg.append('line').at({x1: cx - 2.5, x2: cx + 2.5, y1: c.y(v), y2: c.y(v), stroke: util.gray[700], strokeWidth: 1.2})
        })
      }
    })
  })
  return c
}

window.initModulationProbe = async function(opts){
  var sel = d3.select('.modulation-probe').html('')
  var d = await loadData(opts)
  if (!d?.quant?.conds || !d?.example?.hit_tokens || d.example.probe_half_range == null) return
  var row = sel.append('div.mp-row')
  drawExample(row.append('div'), d)

  var right = row.append('div')
  right.append('div.fig-title').text('Across four properties')
  // Both bar panels share one y extent so the imagine vs. real effect sizes
  // read directly off the bar heights.
  var condVals = cond => {
    var vals = []
    MEASURES.forEach(m => (cond.cells[m.key]?.points || []).forEach(p => vals.push(...p)))
    return vals
  }
  // cover both the baked extents and the raw points so jitter dots never leave the plot area
  var ymax = d3.max(d.quant.conds, c => Math.max(c.ymax ?? -Infinity, d3.max(condVals(c)) * 1.08))
  var ymin = d3.min(d.quant.conds, c => Math.min(c.ymin ?? Infinity, Math.min(0, d3.min(condVals(c))) - 0.4))
  d.quant.conds.forEach((cond, i) => {
    right.append('div.ptitle-sm').st({marginTop: i === 0 ? 0 : 14})
      .text(cond.title)
    drawPanel(right, cond, d, ymax, ymin)
  })
  var leg = right.append('div.legend')
  MEASURES.forEach(m => {
    var l = leg.append('div')
    l.append('span.legend-sq').st({background: m.color})
    l.append('span').text(m.label)
  })
}

}()
window.init?.()

// ─── public/probe-swap/init-probe-swap.js ───
!function(){

async function loadData(opts){
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  return await util.getFile(base + 'data.json')
}

// Shared J-space condition palette (util.jspaceColors); fall back to the
// baked hex if a key isn't in the map.
var condColor = o => util.jspaceColors[o.key] ?? o.color

function rankCol(sel, r, ex){
  var t = sel.append('table.bars')
  var th = t.append('thead').append('tr').append('th')
  th.append('span.sw.swatch').st({background: condColor(r)})
  th.append('span').text(r.label)
  var tb = t.append('tbody')
  // Tokens only — the swap target's rank/log-prob annotations are carried
  // in the data but not rendered (matching the polished figure).
  r.tokens.forEach(tok => {
    var cls = 'tok'
    if (tok.toLowerCase() == ex.expected.toLowerCase()) cls = 'tok hit'
    else if (tok.toLowerCase() == ex.original.toLowerCase()) cls = 'tok orig'
    tb.append('tr').append('td').append('div.entry')
      .append('span').at({class: cls}).text(tok)
  })
}

// One concept's probe decomposition as an equation broken at the "+":
// [probe for X] = [J-space component: atoms ...]
//                   + [non-J-space component]
// The "+" line stacks under the J-space chip on the right of the "=".
function eqBlock(sel, e){
  var b = sel.append('div.eqblock')
  var lhs = b.append('div.eqline.eqlhs')
  var c0 = lhs.append('span.eqchip')
  c0.append('span').text('probe for ')
  c0.append('b').text(e.concept)
  lhs.append('span.eqop').text('=')
  var rhs = b.append('div.eqrhs')
  var l1 = rhs.append('div.eqline')
  var c1 = l1.append('span.eqchip')
  c1.append('span.sw.swatch').st({background: util.jspaceColors.aligned})
  c1.append('span').text('J-space component')
  e.atoms.forEach(a => c1.append('span.atom').text(a))
  c1.append('span.eqell').text('…')
  var l2 = rhs.append('div.eqline.cont')
  l2.append('span.eqop').text('+')
  var c2 = l2.append('span.eqchip')
  c2.append('span.sw.swatch').st({background: util.jspaceColors.residual})
  c2.append('span').text('non-J-space component')
}

function drawExample(sel, d){
  var ex = d.example
  sel.append('div.ptitle')
    .text('Example: swapping the working representation of an inferred intermediate')
  // Plain prompt text; only the answer slot (the trailing "is ___") is
  // marked.
  var p = sel.append('div.prompt')
  var txt = ex.prompt.trim()
  var stem = txt.endsWith(' is') ? txt.slice(0, -3) : txt
  p.append('span').text(stem + ' ')
  p.append('span.tok-hit').text('is')

  ;(ex.decomp || []).forEach(e => eqBlock(sel, e))

  sel.append('div.colslab').text(
    `model's next-token distribution after exchanging ${ex.src_concept} → ${ex.tgt_concept} along each pair of directions`)
  // One shared table (not 4 independent ones) so header height and row
  // baselines are identical across all readout columns.
  var t = sel.append('div.cols').append('table.bars')
  var hr = t.append('thead').append('tr')
  // Explicit two-line splits so all four headers sit at the same height; the
  // last label is widest and is allowed to overflow its column slightly right.
  var hsplit = s => {
    if (s == 'clean (no swap)') return ['clean', '(no swap)']
    var m = s.match(/^(.*\S) (component|vectors)$/)
    return m ? [m[1], m[2]] : [s]
  }
  ex.readouts.forEach(r => {
    var th = hr.append('th')
    var hw = th.append('div.hwrap')
    hw.append('span.sw.swatch').st({background: condColor(r)})
    hw.append('span.hlabel').appendMany('div', hsplit(r.label)).text(d => d)
  })
  var tb = t.append('tbody')
  var nrows = d3.max(ex.readouts, r => r.tokens.length)
  d3.range(nrows).forEach(i => {
    var tr = tb.append('tr')
    ex.readouts.forEach(r => {
      var tok = r.tokens[i]
      var td = tr.append('td')
      if (tok == null) return
      var cls = 'tok'
      if (tok.toLowerCase() == ex.expected.toLowerCase()) cls = 'tok hit'
      else if (tok.toLowerCase() == ex.original.toLowerCase()) cls = 'tok orig'
      td.append('div.entry').append('span').at({class: cls}).text(tok)
    })
  })
}

function drawBars(sel, d){
  var w = d.bars
  sel.append('div.ptitle').text(`Across ${d.n_items} two-hop reasoning prompts`)
  var c = d3.conventions({
    sel: sel.append('div.panel'),
    // Wide enough that adjacent bars' multi-line x labels ("probe,
    // non-J-space component" next to "+ J-space coords clamped") don't
    // collide at the figure's label font size.
    width: 400, height: 280,
    // The bottom margin holds the multi-line bar labels plus the
    // variance-share annotations arrowed to the two component labels;
    // the left margin holds the two-line y label.
    margin: {left: 64, top: 16, right: 8, bottom: 86},
  })
  // Each series carries its own x position so the complementary-clamp
  // variant of each component sits adjacent to its parent, with gaps
  // between the groups.
  var xmin = d3.min(w.series, s => s.x ?? 0), xmax = d3.max(w.series, s => s.x ?? 0)
  c.x.domain([xmin - 0.55, xmax + 0.55])
  c.y.domain([0, 1])
  c.xAxis.tickValues(w.series.map(s => s.x ?? 0)).tickFormat(() => '')
  c.yAxis.tickValues([0, .25, .5, .75, 1]).tickFormat(d3.format('.0%'))
  c.drawAxis()
  util.ggPlot?.(c)

  var bw = 0.7
  w.series.forEach((s, i) => {
    var xc = s.x ?? i, col = condColor(s)
    c.svg.append('rect').at({
      x: c.x(xc - bw / 2), width: c.x(xc + bw / 2) - c.x(xc - bw / 2),
      y: c.y(s.frac), height: c.y(0) - c.y(s.frac),
      fill: col,
    })
    c.svg.append('line').at({
      x1: c.x(xc), x2: c.x(xc), y1: c.y(s.ci_lo), y2: c.y(s.ci_hi),
      stroke: util.gray[700], strokeWidth: 1.2,
    })
    ;[s.ci_lo, s.ci_hi].forEach(v => c.svg.append('line').at({
      x1: c.x(xc) - 3, x2: c.x(xc) + 3, y1: c.y(v), y2: c.y(v),
      stroke: util.gray[700], strokeWidth: 1.2,
    }))
    c.svg.append('text').text(d3.format('.0%')(s.frac))
      .at({x: c.x(xc), y: c.y(s.ci_hi) - 6, textAnchor: 'middle', fill: util.gray[700]})
      .st({fontSize: 'var(--fs-small)'})
    // One word per line, "+" glued to its first word: every label's widest
    // line is a single word, so adjacent multi-line labels can't collide.
    var words = s.label.split(' ')
    if (words[0] == '+' && words.length > 1) words = ['+ ' + words[1], ...words.slice(2)]
    words = words.map(w => w.replace(/,$/, ''))
    var t = c.svg.append('text.slabel')
      .at({x: c.x(xc), y: c.height + 14, textAnchor: 'middle', fill: util.gray[600]})
    words.forEach((ln, j) => {
      t.append('tspan').text(ln).at({x: c.x(xc), dy: j ? 10 : 0})
    })
  })
  // Average variance-share annotations: arrows pointing up from below at
  // the two component bars' x labels, quoting how much of the probe's
  // variance each component carries on average.
  if (d.share_mean != null){
    var pct = d3.format('.0%')
    var shares = {probe_jpart2: d.share_mean, probe_ortho2: 1 - d.share_mean}
    w.series.filter(s => shares[s.key] != null).forEach(s => {
      var x = c.x(s.x ?? 0), yh = c.height + 41
      c.svg.append('path').at({
        d: `M ${x} ${yh + 12} L ${x} ${yh} M ${x - 3} ${yh + 4} L ${x} ${yh} L ${x + 3} ${yh + 4}`,
        stroke: util.gray[600], fill: 'none', strokeWidth: 1,
      })
      var t = c.svg.append('text.sharenote')
        .at({x, y: yh + 24, textAnchor: 'middle', fill: util.gray[600]})
      t.append('tspan').text(`${pct(shares[s.key])} of probe variance`).at({x, dy: 0})
      t.append('tspan').text('on average').at({x, dy: 10})
    })
  }

  // Two lines so the label fits inside the plot height instead of
  // overflowing past the title and into the example column.
  var yl = c.svg.append('text')
    .at({transform: `translate(${-56},${c.height / 2}) rotate(-90)`, textAnchor: 'middle'})
    .st({fontSize: 'var(--fs-small)'})
  yl.append('tspan').text('% of answers that flip').at({x: 0, dy: 0})
  yl.append('tspan').text("to the swap target's answer").at({x: 0, dy: 13})
}

window.initProbeSwap = async function(opts){
  var sel = d3.select('.probe-swap').html('')
  var d = await loadData(opts)
  if (!d?.example?.decomp || !d?.bars) return
  var grid = sel.append('div.ps-row')
  drawExample(grid.append('div'), d)
  drawBars(grid.append('div'), d)
}

}()
window.init?.()

// ─── public/verbal-report-decomposition-merged/init-verbal-report-decomposition-merged.js ───
!function(){

async function loadData(opts){
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  return await util.getFile(base + 'data.json')
}

// Conditions drawn in the two quantification panels (display order: controls
// first, the J-lens reference last). The random control is exactly 0 in both
// panels and is stated in the caption instead.
// Colors come from the shared util.jspaceColors so this figure matches probe-swap.
function remapConds(d){ d.conditions.forEach(c => c.color = util.jspaceColors[c.key] ?? c.color) }
// Display order: pure J-lens → J-space → non-J-space → clamped (controls last).
var ORDER = ['jlens', 'aligned', 'full', 'residual', 'residual_jclamp', 'random']
function drawnConds(d){
  return d.conditions.filter(c => c.in_swap_panel !== false)
    .sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
}

function fmtPct(x){ return d3.format('.0%')(x) }

function drawConstruction(sel, d){
  var c = d.construction
  var conds = Object.fromEntries(d.conditions.map(x => [x.key, x]))

  sel.append('div.ptitle').text('Constructing and decomposing a concept vector')
  sel.append('div.steplab').text(
    'Record the activation at the highlighted position; split it against the J-lens dictionary:')

  var prompt = sel.append('div.prompt')
  prompt.append('span.role').text('Human:')
  prompt.append('span').text(` Tell me about ${c.word}\n\n`)
  prompt.append('span.role').text('Assistant')
  prompt.append('span.tok-hit').text(':')

  // The cards show the worked example's own variance shares; the
  // cross-concept medians live in the caption.
  var avLab = `${Math.round(100*c.aligned_var)}% of variance`
  var rvLab = `${Math.round(100*c.residual_var)}% of variance`

  // The decomposition rendered as an explicit sum:
  // concept vector = J-space component + non-J-space component
  var vchip = sel.append('div.vchip')
  var vline = vchip.append('div')
  vline.append('span').text('concept vector for “')
  var cvw = vline.append('span').text(c.word)
  vline.append('span').text('”')
  vchip.append('div.pct').text(`activation − mean over ${d.meta.baseline_n_words} baseline words`)

  sel.append('div.eqop').text('=')

  var aligned = sel.append('div.card')
  var alab = aligned.append('div.clab')
  alab.append('span.legend-sq').st({background: conds.aligned.color})
  alab.append('span').text('J-space component ')
  alab.append('span.pct').text(`(${avLab})`)
  aligned.append('div.atoms').appendMany('span.atom', c.atoms)
    .html(a => `${util.ppToken(a.token)}<span class='w'>${d3.format('.2f')(a.weight)}</span>`)
  aligned.append('div.csub').text(
    `non-negative combination of ${d.meta.ito_k} J-lens vectors (matching pursuit); … ${d.meta.ito_k - c.atoms.length} more atoms`)

  sel.append('div.eqop').text('+')

  var resid = sel.append('div.card')
  var rlab = resid.append('div.clab')
  rlab.append('span.legend-sq').st({background: conds.residual.color})
  rlab.append('span').text('non-J-space component ')
  rlab.append('span.pct').text(`(${rvLab})`)
  resid.append('div.csub').text('not aligned with any small set of J-lens vectors')

  // Connector: exit rightward from the ":" token, curve down, land on the
  // chip's TOP BORDER directly above the concept word — path stays in the
  // whitespace right of "Assistant:" and outside the chip.
  sel.st({position: 'relative'})
  var sb = sel.node().getBoundingClientRect()
  var tb = prompt.select('.tok-hit').node().getBoundingClientRect()
  var vb = vchip.node().getBoundingClientRect()
  var wb = cvw.node().getBoundingClientRect()
  var x0 = tb.right - sb.left + 1, y0 = (tb.top + tb.bottom)/2 - sb.top
  var x1 = wb.left + wb.width/2 - sb.left, y1 = vb.top - sb.top
  sel.append('svg.connector')
    .st({position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible'})
    .at({width: 1, height: 1})
    .append('path').at({
      d: `M ${x0} ${y0} C ${x0+20} ${y0+4}, ${x1} ${y0+4}, ${x1} ${y1}`,
      stroke: util.gray[500], strokeWidth: 1, fill: 'none',
    })
}

// Shared y domain for the two bar panels — proportion axis, clamped to [0, 1].
// CI whiskers and per-category dots are clamped to the same range so the axis
// never extends below zero to fit them.
var Y_DOMAIN = [0, 1]
function clampY(v){ return Math.max(0, Math.min(1, v)) }

function drawSwap(sel, d){
  sel.append('div.ptitle').text('“Think of a {category}” experiment')
  sel.append('div.steplab').text(
    "Swap the chosen answer's directions for a target item's; does the target become the answer?")
  var chart = sel.append('div.vrdm-chart')
  var conds = drawnConds(d)
  var c = d3.conventions({
    sel: chart,
    width: 240, height: 260,
    margin: {left: 48, top: 14, right: 8, bottom: 18},
  })
  c.x = d3.scaleBand().domain(conds.map(x => x.key)).range([0, c.width]).padding(0.35)
  c.y = d3.scaleLinear().domain(Y_DOMAIN).range([c.height, 0])
  c.xAxis.scale(c.x).tickFormat(() => '')
  c.yAxis.scale(c.y).ticks(6).tickFormat(d3.format('.0%'))
  c.drawAxis()
  util.ggPlot(c)
  util.addAxisLabel(c, '', d.swap.ylabel, '', 0, -10)

  conds.forEach(cond => {
    var s = d.swap.series[cond.key]
    var x0 = c.x(cond.key), bw = c.x.bandwidth()
    c.svg.append('rect').at({
      x: x0, y: c.y(s.p5), width: bw, height: c.y(0) - c.y(s.p5),
      fill: cond.color,
    })
    c.svg.append('path').at({
      d: `M ${x0 + bw/2 - 3} ${c.y(clampY(s.ci_lo))} h 6 M ${x0 + bw/2} ${c.y(clampY(s.ci_lo))} V ${c.y(clampY(s.ci_hi))} M ${x0 + bw/2 - 3} ${c.y(clampY(s.ci_hi))} h 6`,
      stroke: util.gray[700], strokeWidth: 1.2, fill: 'none',
    })
    // per-category dots, deterministic horizontal spread. No percent label
    // above the bar (matching the polished panel).
    c.svg.appendMany('circle', s.per_category).at({
      cx: (q, i) => x0 + bw * (0.2 + 0.6 * (i / Math.max(s.per_category.length - 1, 1))),
      cy: q => c.y(clampY(q.p5)), r: 2.2,
      fillOpacity: 0, stroke: util.gray[700], strokeWidth: 1,
    })
  })
}

function drawDose(sel, d){
  sel.append('div.ptitle').text('“Injected thought” experiment')
  sel.append('div.steplab').text(
    'Inject each component; does the model name the concept when asked what it is thinking about? Results taken from each condition’s best injection strength.')
  var chart = sel.append('div.vrdm-chart')
  var conds = drawnConds(d)
  var c = d3.conventions({
    sel: chart,
    width: 240, height: 260,
    margin: {left: 48, top: 14, right: 8, bottom: 18},
  })
  // Bar chart of the max P@5 over the strength sweep (the bake's peak_p5),
  // mirroring the swap panel; the full per-strength dose-response curves
  // live in the appendix figure (verbal-report-decomposition-dose).
  c.x = d3.scaleBand().domain(conds.map(x => x.key)).range([0, c.width]).padding(0.35)
  c.y = d3.scaleLinear().domain(Y_DOMAIN).range([c.height, 0])
  c.xAxis.scale(c.x).tickFormat(() => '')
  c.yAxis.scale(c.y).ticks(6).tickFormat(d3.format('.0%'))
  c.drawAxis()
  util.ggPlot(c)
  util.addAxisLabel(c, '', d.dose.ylabel, '', 0, -10)

  // No condition labels on the bars — the shared legend under panels 2-3
  // identifies them (matching the swap panel); each bar is annotated with
  // the injection strength its results are taken from.
  conds.forEach(cond => {
    var s = d.dose.series[cond.key]
    var x0 = c.x(cond.key), bw = c.x.bandwidth()
    c.svg.append('rect').at({
      x: x0, y: c.y(s.peak_p5), width: bw, height: c.y(0) - c.y(s.peak_p5),
      fill: cond.color,
    })
    c.svg.append('path').at({
      d: `M ${x0 + bw/2 - 3} ${c.y(clampY(s.peak_ci_lo))} h 6 M ${x0 + bw/2} ${c.y(clampY(s.peak_ci_lo))} V ${c.y(clampY(s.peak_ci_hi))} M ${x0 + bw/2 - 3} ${c.y(clampY(s.peak_ci_hi))} h 6`,
      stroke: util.gray[700], strokeWidth: 1.2, fill: 'none',
    })
    c.svg.append('text').at({
      x: x0 + bw/2, y: c.y(s.peak_ci_hi) - 4, textAnchor: 'middle',
      fontSize: 8.5, fill: '#6b7280',
    }).text(`Strength: ${s.peak_strength}`)
    // No dots here: outcomes at a single strength are binary per concept,
    // so there is no per-group distribution to show (unlike the swap
    // panel's per-category dots); the full dose-response curves live in
    // the appendix figure.
  })
}

function drawLegend(sel, d){
  var leg = sel.append('div.legendrow')
  // Legend reads in the same left-to-right order as the bars in the panels.
  drawnConds(d).forEach(c => {
    leg.append('div').html(`<span class='legend-sq' style='background:${c.color}'></span>${c.label}`)
  })
}

window.initVerbalReportDecompositionMerged = async function(opts){
  var sel = d3.select('.verbal-report-decomposition-merged').html('')
  var d = await loadData(opts)
  if (!d?.construction || d?.swap?.series?.aligned?.p5 == null) return
  if (d?.dose?.series?.aligned?.peak_p5 == null) return
  remapConds(d)
  drawConstruction(sel.append('div.vrdm-col.construction'), d)
  var quant = sel.append('div.vrdm-quant')
  var charts = quant.append('div.charts')
  drawSwap(charts.append('div.vrdm-col'), d)
  drawDose(charts.append('div.vrdm-col'), d)
  drawLegend(quant, d)
}

}()
window.init?.()

// ─── public/selfreport/init-selfreport.js ───
// Self-reports of experience. Two render paths share this module:
//  - selfreport-soc / -other / -questions / -story / -controls / -dose draw
//    d3 charts from the baked data.json so they follow the paper's figure
//    conventions.
//  - selfreport-examples (the response browser) injects the section's
//    reviewed export verbatim (phenomenology/figures.py → figures_html/),
//    via the loader below.
!function(){

// ───── verbatim-export loader (jack's pipeline) ─────

// The exported figure HTML is build-generated (model text is escaped at
// build time) and fetched same-origin, but the datapath is a URL parameter:
// restrict it to relative paths and strip any active content before
// injection so a crafted ?datapath= cannot turn the loader into XSS.
function safeBase(base){
  // relative paths only — init.js passes bare 'data/<dir>/' (no './' prefix),
  // so reject schemes, protocol-relative '//', and root-absolute '/' instead
  // of requiring a leading './'.
  return !/^[a-z]+:|^\/|\/\//i.test(base)
}

function sanitizeFigureHtml(html){
  var doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,iframe,object,embed,link,meta').forEach(n => n.remove())
  doc.querySelectorAll('*').forEach(n => {
    for (var a of [...n.attributes]){
      if (/^on/i.test(a.name)) n.removeAttribute(a.name)
      else if (/^(href|src|srcset|xlink:href)$/i.test(a.name)
               && /^\s*(javascript|vbscript|data:text)/i.test(a.value)) n.removeAttribute(a.name)
    }
  })
  return doc.body.innerHTML
}

var _cssDone = null
async function ensureCss(base){
  if (_cssDone) return _cssDone
  _cssDone = (async () => {
    var css = await util.getFile(base + 'figures_html/figures.css')
    // figures.css is a standalone-page stylesheet with bare selectors (.row,
    // body, h2, …) — scope it under the loader mount so it can't leak onto
    // other figures' .row/.tok/etc. elements.
    d3.select('html').selectAppend('style.selfreport-figures-css')
      .text('.selfreport-examples {\n' + String(css).replaceAll('</', '<\\/') + '\n}')
  })()
  return _cssDone
}

function makeInit(name){
  return async function(opts){
    var base = (opts?.datapath || './').replace(/\/?$/, '/')
    if (!safeBase(base)) return
    var sel = d3.select('.' + name)
    if (sel.empty()) return
    await ensureCss(base)
    var html = await util.getFile(base + 'figures_html/' + name + '.html')
    sel.html(sanitizeFigureHtml(String(html)))
  }
}

window.initSelfreportExamples = makeInit('selfreport-examples')

// ───── d3 figures from data.json ─────

var _data = null
async function loadData(opts){
  if (_data) return _data
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  _data = await util.getFile(base + 'data.json')
  return _data
}

// Bar order left→right; baseline gray, the J-space ablation red right next to
// it (red = ablated, never a series color), then the matched controls as blue
// tints.
var CONDS = [
  {key: 'clean',  color: util.gray[400]},
  {key: 'ablate', color: util.tol.red},
  {key: 'random', color: util.tint(util.tol.blue, 0.75)},
  {key: 'ortho',  color: util.tint(util.tol.blue, 0.5)},
  {key: 'sae',    color: util.tint(util.tol.blue, 0.25)},
]

// Match the reviewed figures' control wording until the bake re-runs with
// the renamed labels.
var COND_LABEL_OVERRIDE = {
  random: 'random control',
  ortho: 'non-J-space control',
  sae: 'SAE-direction control',
}
function condLabel(d, key){ return COND_LABEL_OVERRIDE[key] || d.cond_labels[key] || key }

// "sonnet-4.5" → ["Sonnet", "4.5"] — two-line model labels under the bars.
function modelLines(m){
  var [name, ...rest] = m.split('-')
  return [name[0].toUpperCase() + name.slice(1), rest.join('-')]
}

// ───── shared: example pair cards ─────

function drawPair(sel, pair, pairOpts={}){
  var row = sel.append('div.exrow')
  if (!pairOpts.noHead){
    var ex = row.append('div.exhead')
    ex.append('span.prompt-role').text('Human: ')
    ex.append('span').text(pair.prompt)
  }
  var grid = row.append('div.expair')
  ;[['baseline', util.gray[400], pair.baseline, pair.baseline_first],
    ['J-space ablated', util.tol.red, pair.ablated, pair.ablated_first]]
    .forEach(([label, color, txt, first]) => {
    var card = grid.append('div.card')
    var head = card.append('div.label')
    head.append('span.swatch').st({background: color})
    head.append('span').text(label)
    // Questions excerpts are multi-turn — show each condition's full
    // conversation (shared framing/question, per-condition first
    // response, then the graded answer) in its own card. soc/other/story
    // pairs lack pair.framing and fall through to the single-excerpt path.
    if (pair.framing){
      ;[['Human', pair.framing], ['Assistant', first],
        ['Human', pair.question], ['Assistant', txt]]
        .forEach(([who, t]) => {
          if (!t) return
          var turn = card.append('div.excerpt.prompt-block')
          turn.append('span.prompt-role').text(who + ': ')
          turn.append('span').text(t)
        })
    } else {
      var body = card.append('div.excerpt.prompt-block')
      body.append('span.prompt-role').text('Assistant: ')
      body.append('span').text(txt)
    }
  })
}

// ───── shared: experiential-language grouped bar panel ─────

function drawScoreBars(sel, d, barData, opts={}){
  var models = d.models.filter(m => barData[m])
  var c = d3.conventions({
    sel,
    width: opts.width || 250, height: opts.height || 280,
    margin: {left: 46, top: 10, right: 8, bottom: 40},
  })
  var x = d3.scaleBand().domain(models).range([0, c.width]).padding(0.22)
  var conds = CONDS.filter(cond => models.some(m => barData[m][cond.key]))
  var xi = d3.scaleBand().domain(conds.map(d => d.key)).range([0, x.bandwidth()]).padding(0.12)
  var yMax = opts.yMax || 1
  c.y.domain([0, yMax])
  c.yAxis.ticks(5)
  c.drawAxis()
  c.svg.select('.x').remove()
  util.ggPlot(c)

  c.svg.append('text.axlabel').text(opts.ylabel || 'Experiential language score')
    .at({transform: `rotate(-90)`, x: -c.height/2, y: -34, textAnchor: 'middle'})

  models.forEach(m => {
    conds.forEach(cond => {
      var a = barData[m][cond.key]
      if (!a) return
      var bx = x(m) + xi(cond.key), bw = xi.bandwidth()
      c.svg.append('rect').at({
        x: bx, y: c.y(a.mean), width: bw, height: c.height - c.y(a.mean),
        fill: cond.color,
      })
      var cx = bx + bw/2
      var lo = Math.max(0, a.mean - a.ci), hi = Math.min(yMax, a.mean + a.ci)
      c.svg.append('line').at({x1: cx, x2: cx, y1: c.y(lo), y2: c.y(hi), stroke: util.gray[700], strokeWidth: 1.2})
      if (opts.dots ?? true) (a.per_prompt || []).forEach((v, j, arr) => {
        var jitter = 0.4 * bw * ((j / Math.max(arr.length - 1, 1)) - 0.5)
        c.svg.append('circle').at({cx: cx + jitter, cy: c.y(v), r: 2, fill: 'none', stroke: util.gray[700], strokeWidth: 1})
      })
    })
    // Two-line model labels ("Sonnet" / "4.5") so the narrow panels never
    // overlap adjacent labels.
    var t = c.svg.append('text')
      .at({x: x(m) + x.bandwidth()/2, y: c.height + 16, textAnchor: 'middle'})
      .st({fontSize: 'var(--fs-body)', fill: 'var(--tick)'})
    modelLines(m).filter(ln => ln).forEach((ln, j) => {
      t.append('tspan').text(ln).at({x: x(m) + x.bandwidth()/2, dy: j ? 13 : 0})
    })
  })
  return conds
}

function drawLegend(sel, d, conds){
  var leg = sel.append('div.legend')
  conds.forEach(cond => {
    var item = leg.append('div.item')
    item.append('span.legend-sq').st({background: cond.color})
    item.append('span').text(condLabel(d, cond.key))
  })
  return leg
}

// ───── selfreport-soc: examples beside [score bars over lens tokens] ─────

function drawLensTokens(sel, d, opts={}){
  var toks = d.lens_tokens
  var rowH = opts.rowH || 17
  var c = d3.conventions({
    sel,
    width: opts.width || 320, height: toks.length * rowH,
    margin: {left: 96, top: 8, right: 8, bottom: 40},
  })
  var y = d3.scaleBand().domain(toks.map(t => t.token)).range([0, c.height]).padding(0.18)
  var xmax = d3.max(toks, t => t.ws) * 1.05
  c.x.domain([0, xmax])
  c.xAxis.ticks(4)
  c.drawAxis()
  c.svg.select('.y').remove()
  util.ggPlot(c)
  toks.forEach(t => {
    var bh = y.bandwidth()/2
    c.svg.append('rect').at({x: 0, y: y(t.token), width: c.x(t.ws), height: bh, fill: util.gray[600]})
    c.svg.append('rect').at({x: 0, y: y(t.token) + bh, width: c.x(t.final), height: bh, fill: util.tint(util.tol.blue, 0.65)})
    c.svg.append('text').text(t.token)
      .at({x: -5, y: y(t.token) + y.bandwidth()/2, textAnchor: 'end', dy: '.33em'})
      .st({fontSize: 'var(--fs-label)', fontFamily: 'var(--font-mono)'})
  })
  c.svg.append('text.axlabel').text('Fraction of slots in top-10 readout')
    .at({x: c.width/2, y: c.height + 32, textAnchor: 'middle'})
}

// Small html legend under a chart — [label, color] pairs.
function drawSwatchLegend(sel, items){
  var leg = sel.append('div.legend')
  items.forEach(([label, color]) => {
    var item = leg.append('div.item')
    item.append('span.legend-sq').st({background: color})
    item.append('span').text(label)
  })
}

// Bordered panel with an A/B/C letter chip — the captions reference the
// panels by letter.
function panelBox(sel, letter){
  var box = sel.append('div.panelbox')
  if (letter) box.append('div.pletter').text(letter)
  return box
}

window.initSelfreportSoc = async function(opts){
  var d = await loadData(opts)
  var sel = d3.select('.selfreport-soc').html('')
  // Two-column: example pairs (A) fill the wide left column; the score bars
  // (B, with the condition legend inside its card) stack over the J-lens
  // contents (C) in the right column, which stretches to match A's height.
  var grid = sel.append('div.srgrid')
  var left = panelBox(grid, 'A')
  d.excerpts.soc.forEach(pair => drawPair(left, pair))
  var right = grid.append('div.srright')
  var bbox = panelBox(right, 'B')
  var conds = drawScoreBars(bbox.append('div.panel'), d, d.bars.soc,
    {width: 240, height: 200})
  drawLegend(bbox, d, conds)
  var cbox = panelBox(right, 'C')
  drawLensTokens(cbox.append('div.panel'), d, {width: 200, rowH: 13})
  drawSwatchLegend(cbox, [
    ['Ablated layers (' + d.layers + ')', util.gray[600]],
    ['Final layer', util.tint(util.tol.blue, 0.65)],
  ])
  util.colorCaption(sel, {'A:': 'capchip', 'B:': 'capchip', 'C:': 'capchip'})
  sel.node()?.closest('figure')?.querySelectorAll('figcaption .capchip')
    .forEach(n => n.textContent = n.textContent.replace(/:$/, ''))
}

// ───── selfreport-other / selfreport-questions: pairs beside bars ─────

function pairsBesideBars(slug, key, opts={}){
  return async function(initOpts){
    var d = await loadData(initOpts)
    var sel = d3.select('.' + slug).html('')
    var grid = sel.append('div.srgrid')
    var left = grid.append('div.srleft')
    var pairs = opts.pickPairs ? opts.pickPairs(d.excerpts[key]) : d.excerpts[key]
    pairs.forEach(pair => drawPair(left, pair, opts.pairOpts))
    var match = opts.barHeight === 'match'
    var right = grid.append('div.srright').classed('vcenter', !match)
    var panel = right.append('div.panel')
    var conds = CONDS.filter(c => d.models.some(m => d.bars[key][m]?.[c.key]))
    var bh = opts.barHeight || 280
    if (match){
      // Render the legend first so its laid-out height can be subtracted
      // from the budget; the bars then fill the rest of the example
      // column's height (no whitespace between them and the legend).
      drawLegend(right, d, conds).st({marginTop: 0})
      var leg = right.select('.legend').node()
      bh = Math.max(220, left.node().offsetHeight - leg.offsetHeight - 14 - 50)
    }
    drawScoreBars(panel, d, d.bars[key],
      {width: opts.barWidth || 250, height: bh})
    if (!match) drawLegend(right, d, conds)
  }
}
window.initSelfreportOther = pairsBesideBars('selfreport-other', 'other')
// Questions: show only the second example pair (the conversations are tall
// enough to read on their own), drop the per-pair prompt header, and let the
// bars panel match the example column's height.
window.initSelfreportQuestions = pairsBesideBars('selfreport-questions', 'questions',
  {pickPairs: ps => ps.slice(1, 2), pairOpts: {noHead: true},
    barWidth: 290, barHeight: 'match'})

// ───── selfreport-story: example pair over [craft bars | score bars] ─────

window.initSelfreportStory = async function(opts){
  var d = await loadData(opts)
  var sel = d3.select('.selfreport-story').html('')
  var top = sel.append('div.srleft')
  d.excerpts.story.slice(0, 1).forEach(pair => drawPair(top, pair))
  // The story bake nests {model: {cond: {craft, score}}}; reshape per metric
  // so the same grouped-bar helper draws both panels.
  var pick = which => Object.fromEntries(d.models
    .filter(m => d.story[m]).map(m => [m, Object.fromEntries(
      Object.entries(d.story[m]).map(([cond, v]) => [cond, v[which]]))]))
  // Size each chart so the row of two (margins + chartrow gap) fills the
  // same width as the example pair above.
  var topW = top.node().offsetWidth
  var barM = 46 + 8, gap = 22
  var bw = Math.max(220, Math.floor((topW - gap) / 2) - barM)
  var row = sel.append('div.chartrow.center.wrap')
  drawScoreBars(row.append('div.panel'), d, pick('craft'),
    {width: bw, height: 280, ylabel: 'Story quality (0–10)', yMax: 10, dots: false})
  var conds = drawScoreBars(row.append('div.panel'), d, pick('score'),
    {width: bw, height: 280, dots: false})
  drawLegend(sel, d, conds)
}

// ───── selfreport-controls: matched-control battery, by judgment ─────

var BATTERY_KIND_COLOR = {
  clean: util.gray[400],
  ablate: util.tol.red,
  control: util.tint(util.tol.blue, 0.5),
}
function batteryColor(e){
  if (e.kind) return BATTERY_KIND_COLOR[e.kind] || BATTERY_KIND_COLOR.control
  // Older bakes carry only the display label; classify from it.
  if (e.label == 'baseline') return BATTERY_KIND_COLOR.clean
  if (e.label == 'J-space ablated') return BATTERY_KIND_COLOR.ablate
  return BATTERY_KIND_COLOR.control
}

function drawBatteryPanel(sel, entries, grader, opts={}){
  var rowH = 15
  var c = d3.conventions({
    sel,
    width: 190, height: entries.length * rowH,
    margin: {left: opts.first ? 190 : 12, top: opts.title ? 24 : 8, right: 12, bottom: 24},
  })
  var y = d3.scaleBand().domain(d3.range(entries.length)).range([0, c.height]).padding(0.2)
  c.x.domain([0, 1])
  c.xAxis.ticks(3).tickFormat(d3.format('.0%'))
  c.drawAxis()
  c.svg.select('.y').remove()
  util.ggPlot(c)

  entries.forEach((e, i) => {
    var a = e.graders[grader]
    if (!a) return
    var by = y(i), bh = y.bandwidth(), cy = by + bh/2
    c.svg.append('rect').at({x: 0, y: by, width: c.x(a.p), height: bh,
      fill: batteryColor(e)})
    c.svg.append('line').at({x1: c.x(a.lo), x2: c.x(a.hi), y1: cy, y2: cy,
      stroke: util.gray[700], strokeWidth: 1.2})
    if (opts.first){
      c.svg.append('text').text(e.label)
        .at({x: -6, y: cy, textAnchor: 'end', dy: '.33em'})
        .st({fontSize: 'var(--fs-label)', fill: 'var(--tick)'})
    }
  })
  if (opts.title) c.svg.append('text.ptitle').text(opts.title)
    .at({x: c.width/2, y: -10, textAnchor: 'middle'})
}

window.initSelfreportControls = async function(opts){
  var d = await loadData(opts)
  var sel = d3.select('.selfreport-controls').html('')
  var graders = Object.keys(d.grader_labels)
  var rows = [['soc', 'Stream of consciousness'], ['questions', 'Questions about experience']]
  rows.forEach(([panel, rowLabel], ri) => {
    sel.append('div.mlabel').text(rowLabel)
    var row = sel.append('div.chartrow.center.wrap')
    graders.forEach((g, i) => {
      drawBatteryPanel(row.append('div.panel'), d.battery[panel], g,
        {title: ri == 0 ? d.grader_labels[g] : null, first: i == 0})
    })
  })
}

// ───── selfreport-dose: per-judgment dose-response line panels ─────

function drawDosePanel(sel, series, points, xKey, xLabel, opts={}){
  var c = d3.conventions({
    sel,
    width: 250, height: 190,
    margin: {left: opts.first ? 54 : 40, top: 24, right: 12, bottom: 42},
  })
  var x = xKey == 'k'
    ? d3.scaleLog().domain([1, 40]).range([0, c.width])
    : d3.scalePoint().domain(points.map(p => p.band)).range([0, c.width]).padding(0.4)
  c.x = x
  c.y.domain([0, 1])
  c.yAxis = d3.axisLeft(c.y).ticks(5).tickFormat(d3.format('.0%'))
  c.xAxis = xKey == 'k'
    ? d3.axisBottom(x).tickValues([1, 3, 5, 10, 20, 40]).tickFormat(d3.format('d'))
    : d3.axisBottom(x).tickFormat(s => s.replace('L', ''))
  c.drawAxis()
  util.ggPlot(c)

  // Clean baseline (no ablation) as a dashed reference line, labeled directly
  // in the first panel of each row.
  c.svg.append('line').at({
    x1: 0, x2: c.width, y1: c.y(series.baseline), y2: c.y(series.baseline),
    stroke: util.gray[500], strokeWidth: 1, strokeDasharray: '4,3',
  })
  if (opts.first) util.directLabel(c.svg, {
    x: 4, y: c.y(series.baseline), dy: series.baseline > 0.5 ? 12 : -6,
    text: 'No-ablation baseline', color: util.gray[600],
  })

  // Single series → black line, gray whiskers.
  var xv = p => xKey == 'k' ? x(p.k) : x(p.band)
  points.forEach(p => {
    c.svg.append('line').at({x1: xv(p), x2: xv(p), y1: c.y(p.lo), y2: c.y(p.hi),
      stroke: util.gray[700], strokeWidth: 1.2})
  })
  c.svg.append('path').at({
    d: d3.line().x(xv).y(p => c.y(p.p))(points),
    stroke: util.gray[900], fill: 'none', strokeWidth: 1.6,
  })
  points.forEach(p => {
    c.svg.append('circle').at({cx: xv(p), cy: c.y(p.p), r: 2.5, fill: util.gray[900]})
  })

  if (opts.title) c.svg.append('text.ptitle').text(opts.title).at({x: c.width/2, y: -10, textAnchor: 'middle'})
  if (opts.first) c.svg.append('text.axlabel').text('Fraction of responses scored positive')
    .at({transform: 'rotate(-90)', x: -c.height/2, y: -40, textAnchor: 'middle'})
  c.svg.append('text.axlabel').text(xLabel).at({x: c.width/2, y: c.height + 34, textAnchor: 'middle'})
}

window.initSelfreportDose = async function(opts){
  var d = await loadData(opts)
  var sel = d3.select('.selfreport-dose').html('')
  var graders = Object.keys(d.dose)
  ;[['vs_k', 'Directions ablated (k)', 'k'], ['vs_layers', 'Ablated layer band', 'band']].forEach(([key, xlabel, xKey]) => {
    var row = sel.append('div.chartrow.center.wrap')
    graders.forEach((g, i) => {
      drawDosePanel(row.append('div.panel'), d.dose[g], d.dose[g][key], xKey, xlabel,
        {first: i == 0, title: d.dose[g].label})
    })
  })
}

}()
window.init?.()

// ─── public/slice-inline/init-slice-inline.js ───
window.initSliceInline = async function(opts){
  opts = opts || {}
  var sel = d3.select(opts.sel || '.slice-inline').html('')
  var base = (opts.datapath || './').replace(/\/?$/, '/')
  var ttSel = d3.select('.tooltip')
  if (!ttSel.size()) ttSel = d3.select('body').append('div.tooltip.tooltip-hidden')

  var K = 10

  // Per-slug presentation: title + caption only. The card itself is a condensed
  // version of the lens-slice viewer's three core panels (top-1 grid, by-layer
  // readout, by-position readout) for a single prompt.
  var perSlug = {
    count_five: {
      title: 'Counting ahead',
      cap: 'Asked to count to five, the lens at the final prompt positions already reads out "One" — the first token of the upcoming count — before the assistant has produced anything. Hover any cell of the top-1 grid for the full readout.',
    },
    introspection: {
      title: 'Introspection',
      cap: 'Asked to silently think of a sport before naming it, the lens at the final prompt positions already reads "Basketball" — the sport the model goes on to answer — while mid layers read "okay" and "thinking". Hover any cell of the top-1 grid for the full readout.',
    },
    calc_ooo: {
      title: 'Mental arithmetic',
      cap: 'Before any answer token is produced, the intermediate value "42" — (4+17)×2 — rises to the top of the lens readout at the final prompt positions in late layers. Hover any cell of the top-1 grid for the full readout.',
    },
    mars: {
      title: 'Multihop recall',
      cap: '"Mars" is never written in the prompt, but from the middle layers on the lens reads it over the final tokens — an intermediate resolved before the answer "red". Hover any cell of the top-1 grid for the full readout.',
    },
    ascii_face: {
      title: 'ASCII face',
      cap: 'The lens reads "Face" over the drawing well before the assistant answers. Hover any cell of the top-1 grid for the full readout.',
    },
    mutate_iter: {
      title: 'Bug in code',
      cap: '"Error" surfaces in the lens at the line that mutates the dict mid-iteration. Hover any cell of the top-1 grid for the full readout.',
    },
    avgfp_raw: {
      title: 'Protein recognition',
      cap: 'A few residues into the sequence the lens reads "fluor" — the model has recognised green fluorescent protein. Hover any cell of the top-1 grid for the full readout.',
    },
  }

  var slugs = opts.slugs || ['count_five', 'introspection']
  if (typeof slugs == 'string') slugs = slugs.split(',').map(s => s.trim()).filter(Boolean)

  var cards = sel.append('div.cards')
  for (var slug of slugs) await renderCard(cards.append('div.scard'), slug)

  function renderTodo(card, slug, cfg){
    var box = card.append('div.todo-card')
    box.append('div.todo-tag').text('TODO — no baked data')
    box.append('div.todo-note').text(cfg.todo || `No ${slug} payload found under ${base}`)
  }

  // condensed card: prompt up top, then the slice viewer's three columns in a
  // row — top-1 (argmax) grid, by-layer readout, by-position readout. Hover the
  // grid for the full top-k; click anywhere to move the selected cell.
  async function renderCard(card, slug){
    var cfg = perSlug[slug] || {}
    card.append('div.mlabel.card-title').text(cfg.title || slug)

    var d = null
    try { d = await util.loadLensSlice(base, slug) } catch (e){ console.warn('slice-inline', slug, e.message) }
    if (!d) return renderTodo(card, slug, cfg)

    var ctx = d3.clamp(0, d.default_ctx ?? d.nCtx - 1, d.nCtx - 1)
    var layer = d.layers[Math.floor(d.layers.length * 2/3)]

    // display rank 1 = argmax regardless of whether the payload is 0- or 1-based
    var rankBase = d.cell(ctx, d.layers[0])[0]?.rank ?? 0
    var dispRank = r => r + 1 - rankBase

    var promptToks = util.appendPromptPara(card.append('div.prompt-para'), d.ctxTokens)
      .on('click', (e, i) => setCtx(i))

    var row = card.append('div.srow')
    var col1 = row.append('div.scol.scol-grid')
    var col2 = row.append('div.scol.scol-layer')
    var col3 = row.append('div.scol.scol-pos')

    if (cfg.cap) util.panelCaption(card, opts, cfg.cap).classed('cap', true)

    var gridCells, ctxTokCells

    function setCtx(c){ if (c != null && c !== ctx){ ctx = c; buildCol2(); updateSel() } }
    function setLayer(L){ if (L != null && L !== layer){ layer = L; buildCol3(); updateSel() } }

    // ───── col1: top-1 (argmax) grid, layer × pos ─────
    function buildGrid(){
      col1.append('div.col-title.mlabel').text('Top-1 readout · layer × pos')
      var table = col1.append('div.grid-wrap').append('table.argmax')
      var rows = table.append('tbody').appendMany('tr', [...d.layers].reverse())
      rows.append('td.layer-label').text(util.layerLabel)
      rows.each(function(L){
        d3.select(this).appendMany('td.cell', d3.range(d.nCtx).map(c => ({L, c})))
          .text(p => util.ppCell(d.argmax(p.c, p.L)))
          .on('click', (e, p) => { setCtx(p.c); setLayer(p.L) })
          .on('mouseenter', showTip).on('mousemove', moveTip).on('mouseleave', hideTip)
      })
      var ftok = table.append('tfoot').append('tr')
      ftok.append('td')
      ctxTokCells = ftok.appendMany('td.ctx-tok', d3.range(d.nCtx))
        .text(c => util.ppCell(d.ctxTokens[c])).at({title: c => util.ppCell(d.ctxTokens[c])})
        .on('click', (e, c) => setCtx(c))
      gridCells = table.selectAll('td.cell')
    }

    // ───── col2: by-layer readout at the selected position ─────
    function buildCol2(){
      col2.html('')
      col2.append('div.col-title.mlabel').text(`By layer · pos ${ctx} ${util.ppCell(d.ctxTokens[ctx])}`)
      var rows = col2.append('div.rows-wrap').appendMany('div.lyr-row', [...d.layers].reverse())
        .on('click', (e, L) => setLayer(L))
      rows.append('span.row-label').text(util.layerLabel)
      rows.each(function(L){
        util.appendLensTopk(d3.select(this).append('span.lens-topk'), d.cell(ctx, L), K)
      })
    }

    // ───── col3: by-position readout at the selected layer ─────
    function buildCol3(){
      col3.html('')
      col3.st({'--label-ch': String(d.nCtx - 1).length + 'ch'})
      col3.append('div.col-title.mlabel').text(`By pos · L${util.layerLabel(layer)}`)
      var rows = col3.append('div.rows-wrap').appendMany('div.pos-row', d3.range(d.nCtx))
        .on('click', (e, c) => setCtx(c))
      rows.append('span.row-label').text(c => c)
      rows.append('span.row-ctx').text(c => util.ppCell(d.ctxTokens[c])).at({title: c => util.ppCell(d.ctxTokens[c])})
      rows.each(function(c){
        util.appendLensTopk(d3.select(this).append('span.lens-topk'), d.cell(c, layer), K)
      })
    }

    // scroll only inside the card's own containers, never the page
    function updateSel(){
      gridCells.classed('sel', p => p.L === layer && p.c === ctx)
      ctxTokCells.classed('sel', c => c === ctx)
      promptToks.classed('sel', i => i === ctx)
      col2.selectAll('.lyr-row').classed('sel', L => L === layer)
      col3.selectAll('.pos-row').classed('sel', c => c === ctx)
      var wrap = col1.select('.grid-wrap').node(), cell = ctxTokCells.nodes()[ctx]
      if (wrap && cell) wrap.scrollLeft = cell.offsetLeft - wrap.clientWidth / 2
      var rw = col3.select('.rows-wrap').node(), prow = rw?.children[ctx]
      if (prow) rw.scrollTop = ctx * prow.offsetHeight - rw.clientHeight / 2
    }

    function showTip(ev, p){
      moveTip(ev)
      ttSel.classed('tooltip-hidden', 0).html('').classed('si-tip', 1)
      ttSel.append('div.tt-hdr').text(`L${util.layerLabel(p.L)} · pos ${p.c} ${util.ppCell(d.ctxTokens[p.c])}`)
      var tbl = ttSel.append('table')
      d.cell(p.c, p.L).forEach(r => {
        var tr = tbl.append('tr')
        tr.append('td.r').text(util.ppRank(dispRank(r.rank)))
        tr.append('td.t').text(util.ppCell(r.str))
        tr.append('td.p').text(Math.round(r.prob * 100) + '%')
      })
    }
    function moveTip(ev){
      var bb = ttSel.node().getBoundingClientRect()
      var left = Math.max(4, Math.min(ev.clientX + 12, innerWidth - bb.width - 4))
      var top = Math.max(4, ev.clientY - bb.height - 8)
      ttSel.st({left, top})
    }
    function hideTip(){ ttSel.classed('tooltip-hidden', 1).classed('si-tip', 0) }

    buildGrid(); buildCol2(); buildCol3(); updateSel()
  }
}

window.init?.()

// ─── public/slice-stack/init-slice-stack.js ───
window.initSliceStack = async function(opts){
  var sel = d3.select(opts?.sel || '.slice-stack').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var ttSel = d3.select('.tooltip')
  if (!ttSel.size()) ttSel = d3.select('body').append('div.tooltip.tooltip-hidden')

  var K = 10
  var PALETTE = (util.lineColors || d3.schemeCategory10).filter(c => c.length === 7)

  // Default-pinned tokens per card — the "interesting tokens" called out in the
  // article's slice/lens captions (exact data strings incl. ⍽/↑ markers).
  // Filtered against rankFiles at use time so a re-bake can't break a card.
  var DEFAULT_PINS = {
    mutate_iter: ['Error⍽', '⍽TypeError⍽', '⍽doubled⍽', '⍽dict⍽'],
    ascii_face: ['⍽face⍽', '⍽smile⍽', '⍽eyes⍽', '⍽emoji⍽'],
    avgfp_raw: ['⍽fluor', '⍽protein⍽', '⍽colors⍽', '⍽green'],
    mars: ['↑⍽mars⍽', '⍽red⍽', '⍽color⍽', '⍽planet⍽'],
    calc_ooo: ['21', '42', '49', '⍽answer⍽'],
    count_five: ['↑⍽one⍽', '⍽counting⍽', '↑⍽sure⍽', '⍽five⍽'],
    count_introspect: ['↑⍽claude⍽', '↑⍽done⍽', '⍽consciousness⍽', '⍽thoughts⍽', '⍽halfway⍽', '⍽AI⍽', '⍽counting⍽'],
    introspection: ['⍽thinking⍽', '⍽okay⍽', '↑⍽basketball⍽', '⍽sport⍽'],
  }

  var manifest = await util.getFile(base + 'manifest.json')
  var slugs = manifest.slugs || []
  if (opts?.slugs){
    var want = (typeof opts.slugs == 'string' ? opts.slugs.split(',') : opts.slugs).map(s => s.trim())
    slugs = want.map(w => slugs.find(s => s.slug === w) || {slug: w, title: w})
  }
  var slices = await Promise.all(slugs.map(s => util.loadLensSlice(base, s.slug)))

  var state = opts?.state || {}
  state.cards ??= {}

  slices.forEach((d, i) => renderCard(sel.append('div.scard').at({id: 'slice-' + d.slug}), d, slugs[i]))

  // links from the article embeds land here with ?slug= — scroll that card into view
  // (deliberate, post-render; per-card init never scrolls the page)
  var focus = opts?.focusSlug
  if (focus) sel.select('#slice-' + focus).node()?.scrollIntoView()

  // ctx indices hidden in the prompt display: only the leading blank tokens
  // before "Human:" — the Human:/Assistant: role markers (and the blank line
  // before "Assistant:") stay visible
  function wrapperHidden(toks){
    var hide = new Set()
    for (var i = 0; i < toks.length && !toks[i].trim(); i++) hide.add(i)
    return hide
  }

  // every interaction below closes over this card's own cs/d/cols, so
  // selection and pins in one card never touch another
  function renderCard(card, d, meta){
    var cs = state.cards[d.slug] ??= {ctx: null, layer: null, pinned: null, hoverStr: null}
    cs.pinned ??= new Map()
    cs.ctx = d3.clamp(0, cs.ctx ?? d.default_ctx ?? d.nCtx - 1, d.nCtx - 1)
    cs.layer = d.layers.includes(cs.layer) ? cs.layer : d.layers[Math.floor(d.layers.length * 2/3)]
    if (!cs.pinned.size){
      var defs = d.default_pinned?.length ? d.default_pinned
        : (DEFAULT_PINS[d.slug] || []).filter(s => d.rankFiles?.[s] != null)
      defs.forEach((s, i) => cs.pinned.set(s, PALETTE[i % PALETTE.length]))
    }
    // last resort: pin the late-layer argmax at the default position so the
    // rank heatmap + charts have content before any interaction
    if (!cs.pinned.size){
      var auto = d.argmax(cs.ctx, d.layers.at(-1))
      if (auto != null) cs.pinned.set(auto, PALETTE[0])
    }

    // ───── header: title top-left, then prompt (snug, ~1/3) + pinned chips/help ─────
    if (slugs.length > 1) card.append('div.stitle').text(meta?.title || d.title || d.slug)
    var head = card.append('div.shead')
    var promptToks = util.appendPromptPara(head.append('div.sprompt'), d.ctxTokens)
      .on('click', (e, i) => setCtx(i))
    shiftScrub(promptToks, (e, i) => setCtx(i))
    var hideTok = wrapperHidden(d.ctxTokens)
    promptToks.classed('wrap-hidden', i => hideTok.has(i))
    var side = head.append('div.sside')
    side.append('div.pinned-row')
    side.append('div.shelp').text('click tokens to pin · shift+hover to scrub')

    var row = card.append('div.srow')
    var col1 = row.append('div.scol.scol-grid')
    var col2 = row.append('div.scol.scol-layer')
    var col3 = row.append('div.scol.scol-pos')

    // line charts share the heatmap's plotting height so the columns align
    var chartH = d.layers.length * 11 + 32
    card.st({'--chart-h': chartH + 'px'})

    var gridCells, ctxTokCells, hmC, rcLens, hmPill

    // normalize rank base so display rank 1 = argmax regardless of whether the
    // payload writes the top row as rank 0 or rank 1 (rankOf assumes 0-based)
    var rankBase = d.cell(cs.ctx, d.layers[0])[0]?.rank ?? 0
    var dispRank = r => r + 1 - rankBase
    var rankAt = (ctx, L, str) => {
      var v = d.rankOf(ctx, L, str)
      return v == null ? null : Math.max(1, v - rankBase)
    }

    function setCtx(c){ if (c != null && c !== cs.ctx){ cs.ctx = c; render() } }
    function setLayer(L){ if (L != null && L !== cs.layer){ cs.layer = L; render() } }
    function shiftScrub(s, fn){ return s.on('mouseenter.scrub', (e, x) => { if (e.shiftKey) fn(e, x) }) }

    function togglePin(str){
      if (str == null) return
      if (cs.pinned.has(str)) cs.pinned.delete(str)
      else {
        var used = new Set(cs.pinned.values())
        cs.pinned.set(str, PALETTE.find(c => !used.has(c)) || PALETTE[cs.pinned.size % PALETTE.length])
        cs.hoverStr = str
        d.loadRanks(str).then(renderPinned, () => {})
      }
      renderPinned()
    }
    function bindTopk(chips){ chips.on('click', (e, it) => { e.stopPropagation(); togglePin(it?.str) }) }

    // ───── col1: argmax grid + pinned chips + rank heatmap ─────
    function buildGrid(){
      col1.append('div.col-title.mlabel').text('argmax · layer × pos')
      var table = col1.append('div.grid-wrap').append('table.argmax')
      var rows = table.append('tbody').appendMany('tr', [...d.layers].reverse())
      rows.append('td.layer-label').text(util.layerLabel)
      rows.each(function(L){
        var cells = d3.select(this).appendMany('td.cell', d3.range(d.nCtx).map(c => ({L, c})))
          .text(p => util.ppCell(d.argmax(p.c, p.L)))
          .on('click', (e, p) => { setCtx(p.c); setLayer(p.L); togglePin(d.argmax(p.c, p.L)) })
          .on('mouseenter', showTip).on('mousemove', moveTip).on('mouseleave', hideTip)
        shiftScrub(cells, (e, p) => { setCtx(p.c); setLayer(p.L) })
      })
      var ftok = table.append('tfoot').append('tr')
      ftok.append('td')
      ctxTokCells = ftok.appendMany('td.ctx-tok', d3.range(d.nCtx))
        .text(c => util.ppCell(d.ctxTokens[c])).at({title: c => util.ppCell(d.ctxTokens[c])})
        .on('click', (e, c) => setCtx(c))
      shiftScrub(ctxTokCells, (e, c) => setCtx(c))
      gridCells = table.selectAll('td.cell')

      if (d.rankFiles){
        var hm = col1.append('div.grid-bottom').append('div.rank-heatmap')
        // single-line legend, flush with the heatmap's right edge:
        // [active-token pill]  pinned token rank  1 ▒▒▒▒ 1k+
        rcLens = d3.scaleSequential(d3.interpolateViridis).domain([3, 0])  // log10 rank, capped at 1k
        var hmHead = hm.append('div.hm-head')
        hmPill = hmHead.append('span.pinned-chip.hm-pill')
        hmHead.append('span.hm-lab').text('pinned token rank')
        hmHead.append('span.hm-end').text('1')
        hmHead.append('span.hm-grad').st({background: 'linear-gradient(to right, '
          + d3.range(11).map(i => rcLens(i / 10 * 3) + ' ' + i * 10 + '%').join(',') + ')'})
        hmHead.append('span.hm-end').text('1k+')
        hm.append('div.hm-chart')
      }
    }

    function buildPinnedRow(){
      var pr = card.select('.pinned-row').html('')
      var chips = pr.appendMany('span.pinned-chip', [...cs.pinned])
        .st({borderColor: ([,c]) => c})
        .classed('active', ([s]) => s === cs.hoverStr)
        .on('mouseenter', (e, [s]) => { cs.hoverStr = s; renderHover() })
      chips.append('span.tok').text(([s]) => util.ppCell(s))
      chips.append('span.unpin').text('×').on('click', (e, [s]) => { e.stopPropagation(); togglePin(s) })
    }

    function drawRankHeatmap(){
      if (!d.rankFiles) return
      var active = cs.hoverStr && cs.pinned.has(cs.hoverStr) ? cs.hoverStr : [...cs.pinned.keys()][0]
      // one row per layer present in the payload; taller rows so each layer
      // reads as a solid band
      var nL = d.layers.length
      if (!hmC){
        hmC = d3.conventions({sel: col1.select('.hm-chart').html('').append('div'), height: nL * 11, margin: {top: 4, right: 8, bottom: 20, left: 28}, layers: 'scs'})
        hmC.x.domain([0, d.nCtx - 1])
        hmC.y.domain([-0.5, nL - 0.5])  // index space: row i centered at y(i)
        hmC.xAxis.ticks(5)
        // round-number layer ticks (5, 10, 15, 20…) placed at their row position
        var idxOf = L => (L - d.layers[0]) / (d.layers.at(-1) - d.layers[0]) * (nL - 1)
        var tickLayers = d3.ticks(d.layers[0], d.layers.at(-1), 4)
        hmC.yAxis = d3.axisLeft(hmC.y).tickValues(tickLayers.map(idxOf)).tickFormat((v, i) => util.layerLabel(tickLayers[i]))
        hmC.drawAxis(); util.addAxisLabel(hmC, 'Pos →', 'Layer (reindexed) →')
        hmC.dot = hmC.layers[2].append('circle.sel-dot').at({r: 3.5, fill: '#fff', stroke: '#000', strokeWidth: 1.5})
        var goTo = e => {
          var [px, py] = d3.pointer(e)
          setCtx(d3.clamp(0, Math.round(hmC.x.invert(px)), d.nCtx - 1))
          setLayer(d.layers[d3.clamp(0, Math.round(hmC.y.invert(py)), nL - 1)])
        }
        hmC.layers[2].append('rect').at({width: hmC.width, height: hmC.height, fill: 'transparent', cursor: 'pointer'})
          .on('click', goTo).on('mousemove', e => { if (e.shiftKey) goTo(e) })
        hmC.dot.raise()
      }
      var ctx = hmC.layers[1]
      var cw = hmC.width / d.nCtx, ch = hmC.height / nL
      ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 0, hmC.width, hmC.height)
      if (active) d.layers.forEach((L, li) => {
        for (var i = 0; i < d.nCtx; i++){
          var r = rankAt(i, L, active)
          if (!r) continue
          ctx.fillStyle = rcLens(Math.log10(r))
          ctx.fillRect(i*cw, hmC.height - (li+1)*ch, cw + .5, ch + .5)
        }
      })
      hmPill.text(active ? util.ppCell(active) : '—')
        .st({borderColor: active ? cs.pinned.get(active) : 'var(--rule)'})
      updateHeatmapDot()
    }
    function updateHeatmapDot(){
      if (!hmC) return
      var cw = hmC.width / d.nCtx, ch = hmC.height / d.layers.length
      var li = d.layers.indexOf(cs.layer)
      hmC.dot.at({cx: (cs.ctx + 0.5) * cw, cy: hmC.height - (li + 0.5) * ch})
    }

    // ───── col2/col3 are built once; render() repopulates the lens-topk spans
    //       and reclasses .sel so row containers never get .html('')-ed (which
    //       was the source of stale highlights and perceived scroll-jumps) ─────
    var col2Title, col2Rows, col3Title, col3Rows, lastCtx = null, lastLayer = null

    function buildCol2(){
      col2Title = col2.append('div.col-title.mlabel')
      col2Rows = col2.append('div.rows-wrap').appendMany('div.lyr-row', [...d.layers].reverse())
        .on('click', (e, L) => setLayer(L))
      shiftScrub(col2Rows, (e, L) => setLayer(L))
      col2Rows.append('span.row-label').text(util.layerLabel)
      col2Rows.append('span.lens-topk')
      col2.append('div.rank-chart')
    }

    function buildCol3(){
      col3.st({'--label-ch': String(d.nCtx - 1).length + 'ch', '--vis-rows': d.layers.length})
      col3Title = col3.append('div.col-title.mlabel')
      col3Rows = col3.append('div.rows-wrap').appendMany('div.pos-row', d3.range(d.nCtx))
        .on('click', (e, c) => setCtx(c))
      shiftScrub(col3Rows, (e, c) => setCtx(c))
      col3Rows.append('span.row-label').text(c => c)
      col3Rows.append('span.row-ctx').text(c => util.ppCell(d.ctxTokens[c])).at({title: c => util.ppCell(d.ctxTokens[c])})
      col3Rows.append('span.lens-topk')
      col3.append('div.rank-chart')
    }

    function drawRankChart(colSel, xs, xLabel, getRank, scrub, withLine, xFmt){
      var rc = colSel.select('.rank-chart').html('')
      var c = d3.conventions({sel: rc.append('div'), height: chartH - 32, margin: {top: 8, right: 8, bottom: 20, left: 28}, layers: 'scs'})
      c.x.domain(d3.extent(xs))
      c.y = d3.scaleLog().domain([1000, 1]).range([c.height, 0]).clamp(true)
      c.xAxis.ticks(5); if (xFmt) c.xAxis.tickFormat(xFmt)
      c.yAxis = d3.axisLeft(c.y).tickValues([1, 10, 100, 1000]).tickFormat(v => v >= 1000 ? '1k+' : v)
      c.drawAxis(); util.ggPlot(c)
      util.addAxisLabel(c, xLabel, 'Rank →')
      var ctx = c.layers[1]
      for (var [str, color] of cs.pinned){
        ctx.strokeStyle = ctx.fillStyle = color
        if (withLine){
          ctx.lineWidth = 1.5; ctx.beginPath()
          var prev = null
          for (var x of xs){
            var r = getRank(x, str)
            if (r == null){ prev = null; continue }
            prev ? ctx.lineTo(c.x(x), c.y(r)) : ctx.moveTo(c.x(x), c.y(r))
            prev = 1
          }
          ctx.stroke()
        }
        for (var x of xs){
          var r = getRank(x, str)
          if (r == null) continue
          ctx.beginPath(); ctx.arc(c.x(x), c.y(r), 1.5, 0, Math.PI*2); ctx.fill()
        }
      }
      var top = c.layers[2]
      var scrubX = top.append('line.scrub').at({y1: 0, y2: c.height, stroke: '#000', strokeWidth: .5, strokeDasharray: '2 2'})
      rc.node().__updateScrub = v => scrubX.at({x1: c.x(v), x2: c.x(v)})
      rc.node().__updateScrub(scrub())
      var goTo = e => scrub(d3.clamp(xs[0], Math.round(c.x.invert(d3.pointer(e)[0])), xs.at(-1)))
      top.append('rect').at({width: c.width, height: c.height, fill: 'transparent', cursor: 'pointer'})
        .on('click', goTo).on('mousemove', e => { if (e.shiftKey) goTo(e) })
    }
    function nearestLayer(v){ return d.layers.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a) }
    function drawCol2Chart(){ drawRankChart(col2, d.layers, 'Layer (reindexed) →', (L,s) => rankAt(cs.ctx, L, s), v => { if (v != null) setLayer(nearestLayer(v)); return cs.layer }, true, util.layerLabel) }
    // contexts are short, so the rank-vs-pos chart reads fine as a line (matches rank-vs-layer)
    function drawCol3Chart(){ drawRankChart(col3, d3.range(d.nCtx), 'Pos →', (c,s) => rankAt(c, cs.layer, s), v => { if (v != null) setCtx(v); return cs.ctx }, true) }

    function restylePinned(scope){
      scope.selectAll('.lens-topk .lenstk').each(function(){
        var it = d3.select(this).datum()
        d3.select(this).at({style: util.pinnedStyle(it && cs.pinned.get(it.str))})
      })
    }

    // single render of everything that depends on {ctx, layer}. Row content is
    // only repopulated when the relevant axis actually changed; selection
    // classes, prompt highlight, heatmap dot and scrub lines are always
    // refreshed. Container scroll only ever touches the card's own scroll
    // containers — never the page.
    function render(){
      if (cs.ctx !== lastCtx){
        col2Title.text(`By layer · pos ${cs.ctx} ${util.ppCell(d.ctxTokens[cs.ctx])}`)
        col2Rows.each(function(L){
          bindTopk(util.appendLensTopk(d3.select(this).select('.lens-topk').html(''), d.cell(cs.ctx, L), K))
        })
        drawCol2Chart(); restylePinned(col2)
      }
      if (cs.layer !== lastLayer){
        col3Title.text(`By pos · L${util.layerLabel(cs.layer)}`)
        col3Rows.each(function(c){
          bindTopk(util.appendLensTopk(d3.select(this).select('.lens-topk').html(''), d.cell(c, cs.layer), K))
        })
        drawCol3Chart(); restylePinned(col3)
      }
      col2Rows.classed('sel', L => L === cs.layer)
      col3Rows.classed('sel', c => c === cs.ctx)
      gridCells.classed('sel', p => p.L === cs.layer && p.c === cs.ctx)
      ctxTokCells.classed('sel', c => c === cs.ctx)
      promptToks.classed('tok-hit', i => i === cs.ctx)
      updateHeatmapDot()
      col2.select('.rank-chart').node()?.__updateScrub?.(cs.layer)
      col3.select('.rank-chart').node()?.__updateScrub?.(cs.ctx)
      // bring the selected cell/row into view only if it's outside the
      // container's visible range — shift-hover scrubs an already-visible row
      // so this is a no-op there, and the page itself never scrolls
      var wrap = col1.select('.grid-wrap').node(), cell = ctxTokCells.nodes()[cs.ctx]
      if (wrap && cell){
        var cl = cell.offsetLeft, cr = cl + cell.offsetWidth
        if (cl < wrap.scrollLeft) wrap.scrollLeft = cl
        else if (cr > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = cr - wrap.clientWidth
      }
      var rw = col3.select('.rows-wrap').node(), prow = rw?.children[cs.ctx]
      if (rw && prow){
        var rt = prow.offsetTop, rb = rt + prow.offsetHeight
        if (rt < rw.scrollTop) rw.scrollTop = rt
        else if (rb > rw.scrollTop + rw.clientHeight) rw.scrollTop = rb - rw.clientHeight
      }
      lastCtx = cs.ctx; lastLayer = cs.layer
    }
    function renderPinned(){
      buildPinnedRow()
      restylePinned(card)
      gridCells.at({style: p => util.pinnedStyle(cs.pinned.get(d.argmax(p.c, p.L)))})
      drawRankHeatmap(); drawCol2Chart(); drawCol3Chart()
    }
    function renderHover(){
      card.select('.pinned-row').selectAll('.pinned-chip').classed('active', ([s]) => s === cs.hoverStr)
      drawRankHeatmap()
    }

    function showTip(ev, p){
      moveTip(ev)
      ttSel.classed('tooltip-hidden', 0).html('').classed('ss-tip', 1)
      ttSel.append('div.tt-hdr').text(`L${util.layerLabel(p.L)} · pos ${p.c} ${util.ppCell(d.ctxTokens[p.c])}`)
      var tbl = ttSel.append('table')
      d.cell(p.c, p.L).forEach(r => {
        var tr = tbl.append('tr').at({style: util.pinnedStyle(cs.pinned.get(r.str))})
        tr.append('td.r').text(util.ppRank(dispRank(r.rank)))
        tr.append('td.t').text(util.ppCell(r.str))
        tr.append('td.p').text(Math.round(r.prob * 100) + '%')
      })
    }
    function moveTip(ev){
      var bb = ttSel.node().getBoundingClientRect()
      var left = Math.max(4, Math.min(ev.clientX + 12, innerWidth - bb.width - 4))
      var top = Math.max(4, ev.clientY - bb.height - 8)
      ttSel.st({left, top})
    }
    function hideTip(){ ttSel.classed('tooltip-hidden', 1).classed('ss-tip', 0) }

    buildGrid()
    buildCol2(); buildCol3()
    renderPinned()
    render()
    if (cs.pinned.size) Promise.all([...cs.pinned.keys()].map(s => d.loadRanks(s))).then(renderPinned, () => {})

    // re-render charts/heatmap at the new column width on resize
    var rw0 = row.node().offsetWidth
    new ResizeObserver(util.throttleDebounce(() => {
      var w = row.node().offsetWidth
      if (w === rw0) return
      rw0 = w; hmC = null; lastCtx = lastLayer = null
      drawRankHeatmap(); render()
    }, 150)).observe(row.node())
  }
}

window.init?.()

// ─── public/metacog-alarm/init-metacog-alarm.js ───
!function(){

var COLORS = {
  base: {think: util.tint(util.gray[600], 0.5), dont_think: util.gray[600]},
  prod: {think: util.tint(util.tol.blue, 0.5),  dont_think: util.tol.blue},
}
var cap = s => s[0].toUpperCase() + s.slice(1)

function drawExample(sel, d){
  var ex = d.example
  var card = sel.append('div.ex-col')
  card.append('div.mlabel').text(`example: don’t think about the ${ex.concept}`)

  var prompt = card.append('div.prompt.prompt-block')
  prompt.append('span.prompt-role').text('Human: ')
  prompt.append('span').text(ex.human_text)
  var resp = prompt.append('div.resp-line')
  resp.append('span.prompt-role').text('Assistant: ')
  var hl = new Set(ex.cells.map(c => c.sent_idx))
  ex.sent_toks.forEach((t, i) => {
    if (!ex.sent_glue[i] && i) resp.append('span').text(' ')
    resp.append('span').text(t).classed('tok-hit', hl.has(i)).classed('resp', true)
  })

  var grid = card.append('div.exgrid')
  ex.cells.forEach(c => {
    var cell = grid.append('div.cell')
    var head = cell.append('div.chead')
    head.append('span.swatch').st({background: COLORS[c.side].dont_think})
    head.append('span').text(`${cap(c.side_label)} — '${c.pos_tok}' token, L${c.layer_lbl}`)
    var maxP = d3.max(c.entries, e => Math.exp(e.lp))
    c.entries.forEach(e => {
      var row = cell.append('div.entry')
      row.append('div.bar')
        .st({width: (Math.exp(e.lp)/maxP*100).toFixed(1) + '%',
             background: COLORS[c.side].dont_think})
      row.append('span.tok').text(e.tok)
      row.append('span.lp').text(e.lp.toFixed(2))
    })
  })
}

function drawBars(sel, d){
  var col = sel.append('div.bars-col')
  var lab = col.append('div.mlabel')
    .text(`concept word, fail, and damn in the readout, ${d.n} concepts`)

  // size the chart so the right column matches the example column's height
  var margin = {left: 64, right: 8, top: 46, bottom: 30}
  var exH = sel.select('.ex-col').node()?.offsetHeight || 0
  var labH = lab.node()?.offsetHeight || 0
  var chartH = Math.max(260, exH - labH - margin.top - margin.bottom)
  var c = d3.conventions({
    sel: col.append('div'),
    width: 380, height: chartH,
    margin, layers: 's',
  })
  var nF = d.fams.length
  var x0 = d3.scaleBand().domain(d3.range(nF)).range([0, c.width])
    .paddingInner(0.3).paddingOuter(0.1)
  var x1 = d3.scaleBand().domain(d3.range(d.series.length))
    .range([0, x0.bandwidth()]).paddingInner(0.1)
  c.y.domain([0, 1.12])
  c.yAxis.ticks(5)
  c.drawAxis()
  c.svg.select('.x').remove()
  c.svg.select('.y .domain').remove()
  // left + bottom spines (matplotlib style)
  c.svg.append('path.spine').at({
    d: `M0,0 V${c.height} H${c.width}`, stroke: '#888', strokeWidth: 0.7, fill: 'none',
  })
  // two-line rotated y label
  var ylab = c.svg.select('.y').append('g').translate([-44, c.height/2])
    .append('text.axis-label').at({textAnchor: 'middle', transform: 'rotate(-90)'})
  ylab.append('tspan').text(`fraction of concepts (n=${d.n})`).at({x: 0, dy: '-0.4em'})
  ylab.append('tspan')
    .text(`lens top-${d.top_n}, any copied token, ${d.band_lbl}`)
    .at({x: 0, dy: '1.2em'})

  c.svg.append('g.x-ticks').translate([0, c.height + 16])
    .appendMany('text.tick-label', d3.range(nF))
    .translate(i => [x0(i) + x0.bandwidth()/2, 0])
    .at({textAnchor: 'middle'})
    .text(i => d.fams[i].label)

  var g = c.svg.appendMany('g.fam', d3.range(nF)).translate(i => [x0(i), 0])
  d.series.forEach((s, j) => {
    var fill = COLORS[s.side][s.cond]
    g.append('rect.bar').at({
      x: x1(j), width: x1.bandwidth(), fill,
      y: i => c.y(s.vals[i].v), height: i => c.height - c.y(s.vals[i].v),
    })
    var exx = x1(j) + x1.bandwidth()/2, cap = Math.min(2.5, x1.bandwidth()*0.3)
    g.append('path.err').at({d: i =>
      `M${exx},${c.y(s.vals[i].lo)} V${c.y(s.vals[i].hi)}` +
      ` M${exx-cap},${c.y(s.vals[i].lo)} h${2*cap}` +
      ` M${exx-cap},${c.y(s.vals[i].hi)} h${2*cap}`,
    })
    g.append('text.vlabel')
      .at({x: exx, textAnchor: 'middle', y: i => c.y(s.vals[i].hi) - 4})
      .text(i => {
        var v = s.vals[i].v
        return v == 0 ? '0' : v == 1 ? '1' : d3.format('.2f')(v).replace(/0$/, '').replace(/^0/, '')
      })
  })

  var leg = c.svg.append('g.legend').translate([0, -36])
  var pos = [[0, 0], [0, 16], [190, 0], [190, 16]]
  d.series.forEach((s, j) => {
    var item = leg.append('g').translate(pos[j])
    item.append('rect').at({width: 10, height: 10, y: -9, rx: 2, fill: COLORS[s.side][s.cond]})
    item.append('text').text(cap(s.label)).at({x: 15})
  })
}

window.initMetacogAlarm = async function(opts){
  var sel = d3.select('.metacog-alarm').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')
  var row = sel.append('div.panel-row')
  drawExample(row, d)
  drawBars(row, d)
}

}()
window.init?.()

// ─── public/ignition/init-ignition.js ───
window.initIgnition = async function ({datapath, sel: selStr, show}) {
  var sel = d3.select(selStr || '.ignition').html('')
  show = show || 'abc'
  var d = await util.getFile(datapath + 'data.json')

  var n = d.n_pub, [wlo, whi] = d.ws_band
  var ORANGE = util.tol.orange, DARK = util.gray[700]
  var rdbu = t => d3.interpolateRdBu(1 - t)            // RdBu_r: 0→blue(B) 1→red(A)
  var greys = t => d3.interpolateGreys(1 - t)          // Greys_r: 0→black(rank 1) 4→white

  // ───── row 1: A | B+C ─────
  if (show === 'abc'){
    var row1 = sel.append('div.row')
    var a = row1.append('div.panel.schematic')
    a.append('div.plabel').html('A &nbsp; Mixing two tokens’ embeddings')
    a.append('div').html(d.schematic_html)

    var bc = row1.append('div.panel.bc')
    var bcLabels = bc.append('div.bc-labels')
    bcLabels.append('div.plabel.lab-b')
      .html('B &nbsp; Activations given interpolated inputs')
    bcLabels.append('div.plabel.lab-c')
      .html('C &nbsp; J-lens behavior given interpolated inputs')
    var bcRow = bc.append('div.hm-row')

    var HMS = [
      {key: 'proj',    title: 'Relative similarity to activations\ninduced by pure token embedding',
       vmax: 1, color: rdbu, cbar: {ticks: [0, 1], labels: ['B', 'A']}},
      {key: 'logrank', title: 'J-lens rank of the\nhigher ranked concept',
       vmax: 4, color: greys,
       cbar: {ticks: [0, 1, 2, 3, 4], labels: ['1', '10', '100', '1k', '10k'], invert: true}},
      {key: 'jspan',   title: 'Relative similarity to J-lens\nvectors for concepts A and B',
       vmax: 1, color: rdbu, cbar: null},
    ]
    HMS.forEach((h, hi) => drawHeatmap(bcRow.append('div.hm-cell'), h, hi))
  }

  // ───── D: transition width (own figure) ─────
  if (show === 'd'){
    var dSel = sel.append('div.panel.panel-d')
    dSel.append('div.plabel').text('Transition width')
    drawWidths(dSel.append('div'))
  }

  // ───── E: ambiguous-input histograms (own figure) ─────
  if (show === 'e'){
    var eSel = sel.append('div.panel.panel-e')
    eSel.append('div.plabel').text(
      'Relative share in activations of concept A at maximally ambiguous ' +
      'interpolation coefficient, across prompts')
    drawHistRow(eSel.append('div.hist-row'))
  }

  // ───── panel B/C: one heatmap (canvas) + svg axes + optional colorbar ─────
  function drawHeatmap(host, h, hi){
    var W = 192, H = 244, cbW = h.cbar ? 30 : 14
    var m = {left: hi ? 8 : 36, right: cbW, top: 30, bottom: 36}
    var c = d3.conventions({sel: host, width: W, height: H, margin: m, layers: 'cs'})
    var ctx = c.layers[0], svg = c.layers[1]
    var na = d.d_grid.length, cw = W / na, ch = H / n
    var grid = d.heatmaps[h.key]
    for (var li = 0; li < n; li++) for (var ai = 0; ai < na; ai++){
      ctx.fillStyle = h.color(grid[li][ai] / h.vmax)
      ctx.fillRect(ai * cw, H - (li + 1) * ch, cw + 0.5, ch + 0.5)
    }
    c.x.domain([d.d_grid[0], d.d_grid[na - 1]])
    c.y.domain([-0.5, n - 0.5])
    c.xAxis.tickValues([-0.5, 0, 0.5])
      .tickFormat(v => v < 0 ? 'Pure B' : v > 0 ? 'Pure A' : 'Ambiguous')
      .tickSizeOuter(0).tickSizeInner(3)
    c.yAxis.tickValues(util.layerTicks(n)).tickFormat(util.layerLabel)
      .tickSizeOuter(0).tickSizeInner(3)
    c.drawAxis()
    c.svg.select('.x').selectAll('text').st({fontSize: '9px'})
    if (hi) c.svg.select('.y').selectAll('text').remove()
    util.addAxisLabel(c, 'input evidence', hi ? '' : 'Layer (reindexed) →')
    // ws-band guides — dashed horizontals at the band edges
    ;[wlo - 0.5, whi + 0.5].forEach(yy => svg.append('line.ws-guide')
      .at({x1: 0, x2: W, y1: c.y(yy), y2: c.y(yy)}))
    // two-line title
    var t = svg.append('text.hm-title').at({x: W / 2, textAnchor: 'middle'})
    h.title.split('\n').forEach((s, i) =>
      t.append('tspan').text(s).at({x: W / 2, y: -18 + i * 11}))
    // colorbar
    if (h.cbar){
      var cb = svg.append('g.cbar').translate([W + 6, 0]), bw = 9, nseg = 60
      cb.appendMany('rect', d3.range(nseg)).at({
        y: i => (h.cbar.invert ? i : nseg - 1 - i) * H / nseg,
        width: bw, height: H / nseg + 0.5, fill: i => h.color(i / (nseg - 1)),
      })
      cb.appendMany('text', h.cbar.ticks).text((_, i) => h.cbar.labels[i])
        .at({x: bw + 3, dy: '.35em',
             y: v => (h.cbar.invert ? v / h.vmax : 1 - v / h.vmax) * H})
    }
  }

  // ───── panel D: median ± IQR transition width by pub-layer ─────
  function drawWidths(host){
    var c = d3.conventions({
      sel: host, width: 420, height: 260,
      margin: {left: 46, right: 6, top: 8, bottom: 32},
    })
    c.x.domain([-0.5, n - 0.5])
    c.y = d3.scaleLog().domain([0.018, 1.2]).range([c.height, 0])
    c.xAxis.tickValues(util.layerTicks(n)).tickFormat(util.layerLabel)
    c.yAxis.scale(c.y).tickValues([0.03, 0.1, 0.3, 1.0]).tickFormat(v => v)
    c.drawAxis(); util.ggPlot(c)
    util.addAxisLabel(c, 'Layer (reindexed) →', 'transition width Δα (10→90%)', '', 0, -4)
    util.addWsBand(c, wlo, whi, {label: false})
    var xs = d3.range(n)
    var line = d3.line().x((_, i) => c.x(xs[i])).y(v => c.y(v))
    var area = d3.area().x((_, i) => c.x(xs[i]))
      .y0(p => c.y(p.lo)).y1(p => c.y(p.hi))
    var SER = [
      {k: 'j',  color: ORANGE, label: ['Projections onto concept', 'word J-lens vectors']},
      {k: 'nj', color: DARK,   label: ['Non-J-space component', 'of activations']},
    ]
    SER.forEach(s => {
      var w = d.widths[s.k]
      c.svg.append('path').at({
        d: area(xs.map(i => ({lo: w.q1[i], hi: w.q3[i]}))),
        fill: s.color, stroke: 'none',
      }).st({opacity: 0.15})
    })
    SER.forEach(s => {
      var w = d.widths[s.k]
      c.svg.append('path').at({d: line(w.med), fill: 'none',
        stroke: s.color, strokeWidth: 1.6})
      c.svg.appendMany('circle', xs).at({
        cx: i => c.x(i), cy: i => c.y(w.med[i]), r: 2.2, fill: s.color,
      })
    })
    igLegend(c.svg, [c.width - 2, 4], SER)
  }

  // ───── panel E: histogram row at four pub layers ─────
  function drawHistRow(host){
    var bins = d.hist.bin_edges, nb = bins.length - 1
    var ymax = d3.max(d.hist.pub_layers, (_, li) =>
      d3.max(['j', 'nj'], k => d3.max(d.hist[k][li])))
    var SER = [
      {k: 'j',  color: ORANGE, label: ['Projections onto concept', 'word J-lens vectors']},
      {k: 'nj', color: DARK,   label: ['Non-J-space component', 'of activations']},
    ]
    d.hist.pub_layers.forEach((pub, li) => {
      var c = d3.conventions({
        sel: host.append('div'), width: 156, height: 230,
        margin: {left: li ? 8 : 38, right: 4, top: 18, bottom: 32},
      })
      c.x.domain([0, 1]); c.y.domain([0, ymax * 1.08])
      c.xAxis.tickValues([0, 0.5, 1]).tickFormat(v => v)
      c.yAxis.ticks(4)
      c.drawAxis(); util.ggPlot(c)
      if (li) c.svg.select('.y').selectAll('text').remove()
      c.svg.append('text.hm-title').text('L' + util.layerLabel(pub))
        .at({x: c.width / 2, y: -6, textAnchor: 'middle'})
      ;[['nj', DARK], ['j', ORANGE]].forEach(([k, col]) => {
        var counts = d.hist[k][li]
        var p = `M${c.x(bins[0])},${c.y(0)}`
        for (var b = 0; b < nb; b++)
          p += `V${c.y(counts[b])}H${c.x(bins[b + 1])}`
        p += `V${c.y(0)}`
        c.svg.append('path').at({d: p, fill: 'none', stroke: col, strokeWidth: 1.4})
      })
      if (li == 0) util.addAxisLabel(c, '', 'trials', '', 0, 0)
      if (li == 1) igLegend(c.svg, [c.width - 2, 6], SER)
    })
    host.append('div.hist-xlabel')
      .text('Relative share of activations across ambiguous inputs')
  }

  // Shared D/E legend: line swatch on the left, two-line label on the
  // right, right-aligned block (matches the matplotlib loc='upper right').
  function igLegend(svg, at, ser){
    var leg = svg.append('g.ig-legend').translate(at)
    ser.forEach((s, i) => {
      var g = leg.append('g').translate([0, i * 28])
      // text first so we can place the swatch just to its left
      var w = 0
      s.label.forEach((t, j) => {
        var el = g.append('text').text(t)
          .at({x: 0, y: j * 12, dy: '.32em', textAnchor: 'end'})
        w = Math.max(w, el.node().getComputedTextLength())
      })
      g.append('line').at({x1: -w - 20, x2: -w - 6, y1: 5, y2: 5,
        stroke: s.color, strokeWidth: 2.2})
    })
  }
}

if (window.init) window.init()

// ─── public/eval-awareness-probe/init-eval-awareness-probe.js ───
window.initEvalAwarenessProbe = async function ({datapath}) {
  var sel = d3.select('.eval-awareness-probe').html('')
  var d = await util.getFile(datapath + 'data.json')
  sel.append('img')
    .at({src: 'data:image/png;base64,' + d.png})
    .st({width: '100%', height: 'auto'})
}

if (window.init) window.init()

// ─── public/dual-task-simple/init-dual-task-simple.js ───
!function(){

var BLUE = '#2563eb', ORANGE = '#ff6b35', GREY = '#c7cdd4'
var TASK_A = '#16a34a', TASK_B = '#7c3aed'

function markPhrases(sel, text, pa, pb){
  var rest = text
  ;[[pa, 'ph-a'], [pb, 'ph-b']].forEach(() => {})
  // split on the two phrases, keeping order of first occurrence
  var parts = []
  var ia = rest.indexOf(pa), ib = rest.indexOf(pb)
  var order = ia <= ib ? [[ia, pa, 'ph-a'], [ib, pb, 'ph-b']] : [[ib, pb, 'ph-b'], [ia, pa, 'ph-a']]
  var pos = 0
  order.forEach(([i, p, cls]) => {
    if (i < 0) return
    parts.push([rest.slice(pos, i), null])
    parts.push([p, cls])
    pos = i + p.length
  })
  parts.push([rest.slice(pos), null])
  parts.forEach(([t, cls]) => {
    if (!t) return
    sel.append('span').text(t).at({class: cls || null})
  })
}

function drawExamples(sel, d){
  var col = sel.append('div.panel.ex-panel')
  col.append('div.mlabel').text('example: the readout at two response tokens')
  d.blocks.forEach(b => {
    var blk = col.append('div.exblock')
    blk.append('div.exhead').text(b.head)
      .st({color: b.key == 'cc' ? BLUE : ORANGE})
    var instr = blk.append('div.prompt')
    instr.append('span').text(`Write "${d.sentence}" `)
    markPhrases(instr, b.instr, b.phrase_a, b.phrase_b)
    instr.append('span').text(" Don't write anything else.")
    var resp = blk.append('div.resp')
    resp.append('span.role').text('A: ')
    var hl = new Set(b.cells.map(c => c.pos_tok))
    d.sentence.split(/(crookedly|on)/).forEach(seg => {
      if (seg == 'crookedly') {
        resp.append('span').text('cr')
        resp.append('span.hl').text('ook')
        resp.append('span').text('edly')
      } else if (seg == 'on' && hl.has('on')) {
        resp.append('span.hl').text('on')
      } else {
        resp.append('span').text(seg)
      }
    })
    var lens = blk.append('div.lens-readout')
    b.cells.forEach(c => {
      var line = lens.append('div')
      line.append('span.label').text(`${c.pos_tok} · L${c.layer_lbl}: `)
      c.chips.forEach(ch => {
        if (ch.cls == 'other') {
          line.append('span.tok-g').text(ch.tok)
        } else {
          var s = line.append('span').at({class: ch.cls == 'a' ? 'tok-a' : 'tok-b'})
          s.append('span').text(ch.tok)
          s.append('span.tok-rk').text(ch.rank)
        }
        line.append('span').text(' ')
      })
    })
  })
}

function drawCoocc(sel, d){
  var col = sel.append('div.panel')
  col.append('div.mlabel').text('co-occupancy at shared tokens')
  var c = d3.conventions({
    sel: col.append('div'),
    width: 240, height: 290,
    margin: {left: 64, right: 6, top: 16, bottom: 52},
    layers: 's',
  })
  var conds = d.coocc.plotted.map(i => d.coocc.conds[i])
  var cols = [BLUE, ORANGE]
  c.x.domain([-0.6, conds.length - 0.4])
  c.y.domain([0, 1])
  c.yAxis.ticks(5)
  c.drawAxis()
  c.svg.select('.x').remove()
  c.svg.selectAll('.domain').remove()
  c.svg.append('path.spine').at({
    d: `M0,0 V${c.height} H${c.width}`, stroke: '#888', strokeWidth: 0.7, fill: 'none'})
  var bw = 0.34
  conds.forEach((s, gi) => {
    var x1 = c.x(gi - (bw/2 + 0.02)), x2 = c.x(gi + (bw/2 + 0.02))
    var w = c.x(bw) - c.x(0)
    ;[[x1, s.observed, s.ci_lo, s.ci_hi, cols[gi], '#374151'],
      [x2, s.null_mean, s.null_lo, s.null_hi, GREY, '#6b7280']].forEach(([xc, v, lo, hi, fill, ec]) => {
      c.svg.append('rect').at({
        x: xc - w/2, width: w, y: c.y(v), height: c.height - c.y(v), fill})
      c.svg.append('path').at({
        d: `M${xc},${c.y(lo)} V${c.y(hi)} M${xc-3},${c.y(lo)} h6 M${xc-3},${c.y(hi)} h6`,
        stroke: ec, strokeWidth: 1.2, fill: 'none'})
      c.svg.append('text.vlabel').text(d3.format('.2f')(v))
        .at({x: xc, y: c.y(hi) - 4, textAnchor: 'middle'})
    })
    var lab = c.svg.append('text.gxlabel')
      .at({x: c.x(gi), y: c.height + 16, textAnchor: 'middle', fill: cols[gi]})
    s.label.split(' + ').length > 1
      ? ['concept', '+ math'].forEach((t, k) => lab.append('tspan').text(t).at({x: c.x(gi), dy: k ? '1.15em' : 0}))
      : ['two', 'concepts'].forEach((t, k) => lab.append('tspan').text(t).at({x: c.x(gi), dy: k ? '1.15em' : 0}))
  })
  // legend: shuffled control
  var leg = c.svg.append('g').translate([c.width - 4, 6])
  leg.append('rect').at({x: -110, width: 11, height: 11, y: -9, fill: GREY})
  leg.append('text').text('shuffled control').at({x: -95}).st({fontSize: 'var(--fs-small)'})
  var ylab = c.svg.select('.y').append('g').translate([-44, c.height/2])
    .append('text.axis-label').at({textAnchor: 'middle', transform: 'rotate(-90)'})
  ylab.append('tspan').text(`P(other task in lens top-${d.k_coocc})`).at({x: 0, dy: '-0.4em'})
  ylab.append('tspan').text(`at tokens where this task is in top-${d.k_coocc}`).at({x: 0, dy: '1.2em'})
}

function drawReach(sel, d){
  var col = sel.append('div.panel')
  col.append('div.mlabel').text('reachability: single vs dual task')
  var c = d3.conventions({
    sel: col.append('div'),
    width: 290, height: 290,
    margin: {left: 56, right: 6, top: 16, bottom: 52},
    layers: 's',
  })
  c.svg.append('defs').append('pattern')
    .at({id: 'hatch-dual', width: 5, height: 5, patternUnits: 'userSpaceOnUse',
         patternTransform: 'rotate(45)'})
    .append('rect').at({width: 2, height: 5, fill: '#fff'})
  var cols = [BLUE, ORANGE, ORANGE]
  c.x.domain([-0.6, d.reach.length - 0.4])
  c.y.domain([0, 1.12])
  c.yAxis.ticks(5).tickFormat(d3.format('.0%'))
  c.drawAxis()
  c.svg.select('.x').remove()
  c.svg.selectAll('.domain').remove()
  c.svg.append('path.spine').at({
    d: `M0,0 V${c.height} H${c.width}`, stroke: '#888', strokeWidth: 0.7, fill: 'none'})
  var bw = 0.34
  d.reach.forEach((r, gi) => {
    var x1 = c.x(gi - (bw/2 + 0.02)), x2 = c.x(gi + (bw/2 + 0.02))
    var w = c.x(bw) - c.x(0)
    c.svg.append('rect').at({
      x: x1 - w/2, width: w, y: c.y(r.single), height: c.height - c.y(r.single),
      fill: cols[gi]})
    var g2 = c.svg.append('g')
    g2.append('rect').at({
      x: x2 - w/2, width: w, y: c.y(r.dual), height: c.height - c.y(r.dual),
      fill: cols[gi]})
    g2.append('rect').at({
      x: x2 - w/2, width: w, y: c.y(r.dual), height: c.height - c.y(r.dual),
      fill: 'url(#hatch-dual)'})
    ;[[x1, r.single], [x2, r.dual]].forEach(([xc, v]) => {
      c.svg.append('text.vlabel').text(d3.format('.0%')(v))
        .at({x: xc, y: c.y(v) - 4, textAnchor: 'middle'})
    })
    var lab = c.svg.append('text.gxlabel')
      .at({x: c.x(gi), y: c.height + 16, textAnchor: 'middle', fill: cols[gi]})
    r.label.split(' ').length > 1
      ? r.label.replace('(w/ math)', '(w/·math)').split(' ').forEach((t, k) =>
          lab.append('tspan').text(t.replace('·', ' ')).at({x: c.x(gi), dy: k ? '1.15em' : 0}))
      : lab.text(r.label)
  })
  // legend
  var leg = c.svg.append('g').translate([4, 6])
  leg.append('rect').at({width: 11, height: 11, y: -9, fill: '#555'})
  leg.append('text').text('single task').at({x: 15}).st({fontSize: 'var(--fs-small)'})
  var l2 = leg.append('g').translate([90, 0])
  l2.append('rect').at({width: 11, height: 11, y: -9, fill: '#555'})
  l2.append('rect').at({width: 11, height: 11, y: -9, fill: 'url(#hatch-dual)'})
  l2.append('text').text('dual task').at({x: 15}).st({fontSize: 'var(--fs-small)'})
  var ylab = c.svg.select('.y').append('g').translate([-40, c.height/2])
    .append('text.axis-label').at({textAnchor: 'middle', transform: 'rotate(-90)'})
  ylab.append('tspan').text(`reaches lens top-${d.topk}`).at({x: 0, dy: '-0.4em'})
  ylab.append('tspan').text(`(band ${d.band_lbl}, any position)`).at({x: 0, dy: '1.2em'})
}

window.initDualTaskSimple = async function(opts){
  var sel = d3.select('.dual-task-simple').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')
  var row = sel.append('div.panel-row')
  drawExamples(row, d)
  drawCoocc(row, d)
  drawReach(row, d)
}

}()
window.init?.()

// ─── public/capacity-final-band/init-capacity-final-band.js ───
!function(){

var ORANGE = util.tol.orange, BLUE = util.tol.blue, GREY = util.gray[500]
var BLK_COLS = [util.tol.orange, util.tol.magenta, util.tol.teal, util.tol.cyan]

function chipBlock(col, hdr, sub, chips){
  var blk = col.append('div.chipblock')
  blk.append('div.chiphead').text(hdr)
  blk.append('div.chipsub').text(sub)
  var row = blk.append('div.chips')
  chips.forEach(ch => {
    row.append('span.chip').at({class: 'chip ' + ch.cls}).text(ch.tok)
    row.append('span').text(' ')
  })
}

function drawA(sel, d){
  var col = sel.append('div.panel.chip-panel')
  col.append('div.mlabel').text('example: reading a single-family list')
  d.a.forEach(ex => {
    chipBlock(col,
      `after ${ex.n_read} word${ex.n_read > 1 ? 's' : ''} read`,
      'read: ' + ex.read_words.join(', '),
      ex.chips.map(ch => ({tok: ch.tok, cls: ch.cls == 'read' ? 'cur' : 'other'})))
  })
}

function drawD(sel, d){
  var col = sel.append('div.panel.chip-panel')
  col.append('div.mlabel').text('example: color words after the animals')
  d.d.forEach(ex => {
    chipBlock(col,
      `${ex.n_colors} color word${ex.n_colors > 1 ? 's' : ''} after the 8 animals`,
      'colors read: ' + ex.read_words.join(', '),
      ex.chips)
  })
}

function lineChart(sel, title, opts){
  var col = sel.append('div.panel')
  col.append('div.mlabel').text(title)
  var c = d3.conventions({
    sel: col.append('div'),
    width: 270, height: 280,
    margin: {left: 46, right: 10, top: 12, bottom: 40},
    layers: 's',
  })
  c.x.domain(opts.xdom)
  c.y.domain(opts.ydom)
  c.xAxis.ticks(5)
  c.yAxis.ticks(5)
  c.drawAxis()
  util.ggPlot(c)
  util.addAxisLabel(c, opts.xlabel, opts.ylabel, '', 6)
  return c
}

function band(c, xs, q1, q3, color){
  var area = d3.area().x((v, i) => c.x(xs[i])).y0(v => c.y(v[0])).y1(v => c.y(v[1]))
  c.svg.append('path').at({
    d: area(q1.map((v, i) => [v, q3[i]])), fill: color, opacity: 0.10})
}

function line(c, xs, ys, color, opts){
  var ln = d3.line().x((v, i) => c.x(xs[i])).y(v => c.y(v))
  c.svg.append('path').at({
    d: ln(ys), stroke: color, fill: 'none',
    strokeWidth: opts?.lw ?? 2, strokeDasharray: opts?.dash || null})
}

function legend(c, entries, pos){
  var leg = c.svg.append('g.legend').translate(pos || [8, 8])
  entries.forEach((e, i) => {
    var g = leg.append('g').translate([0, i * 14])
    g.append('line').at({x1: 0, x2: 14, stroke: e.color,
      strokeWidth: e.lw ?? 2, strokeDasharray: e.dash || null})
    g.append('text').text(e.label).at({x: 18, dy: '0.32em'})
  })
}

function drawB(sel, d){
  var xs = d3.range(d.ng)
  var c = lineChart(sel, 'words in the readout: family vs random lists', {
    xdom: [0, d.ng - 1], ydom: [0, d.ylim_top],
    xlabel: 'comma #', ylabel: `# list words in top-${d.k25} (band-min)`,
  })
  ;[['family', ORANGE], ['random', BLUE]].forEach(([lab, color]) => {
    var s = d.b[lab]
    band(c, xs, s.read_q1, s.read_q3, color)
    line(c, xs, s.read_med, color)
    line(c, xs, s.all_med, color, {lw: 1.5, dash: '4 2'})
  })
  legend(c, [
    {label: 'family: read', color: ORANGE},
    {label: 'family: all 80', color: ORANGE, dash: '4 2', lw: 1.5},
    {label: 'random: read', color: BLUE},
    {label: 'random: all 80', color: BLUE, dash: '4 2', lw: 1.5},
  ])
}

function drawC(sel, d){
  var c = lineChart(sel, 'read words vs rank threshold', {
    xdom: [0, 100], ydom: [0, 100],
    xlabel: 'rank threshold K (band-min)', ylabel: '# READ words ≤ K (near end of list)',
  })
  c.svg.append('line').at({
    x1: 0, x2: c.width, y1: c.y(80), y2: c.y(80),
    stroke: GREY, strokeWidth: 1, strokeDasharray: '4 2'})
  c.svg.append('text').text('list length (80)')
    .at({x: c.width - 4, y: c.y(80) - 5, textAnchor: 'end', fontSize: 9, fill: 'var(--text-light)'})
  line(c, d.c.ks, d.c.family, ORANGE)
  line(c, d.c.ks, d.c.random, BLUE)
  line(c, d.c.ks, d.c.control, GREY, {lw: 1.2})
  legend(c, [
    {label: 'family', color: ORANGE},
    {label: 'random', color: BLUE},
    {label: 'control', color: GREY, lw: 1.2},
  ])
}

function drawE(sel, d){
  var xs = d3.range(d.ng)
  var c = lineChart(sel, 'words in the readout: four-family block lists', {
    xdom: [0, d.ng - 1], ydom: [0, d.ylim_top],
    xlabel: 'comma #', ylabel: `# family words in top-${d.k25} (band-min)`,
  })
  d.e.blocks.forEach((blk, bi) => {
    band(c, xs, blk.q1, blk.q3, BLK_COLS[bi])
    line(c, xs, blk.med, BLK_COLS[bi], {lw: 1.8})
  })
  line(c, xs, d.e.random_med, GREY, {lw: 1.1})
  legend(c, [
    ...d.e.blocks.map((_, bi) => ({label: `block ${bi + 1}`, color: BLK_COLS[bi], lw: 1.8})),
    {label: 'random', color: GREY, lw: 1.1},
  ], [8, 8])
}

function drawF(sel, d){
  var col = sel.append('div.panel')
  col.append('div.mlabel').text('per-word presence in block lists')
  var c = d3.conventions({
    sel: col.append('div'),
    width: 260, height: 280,
    margin: {left: 46, right: 56, top: 12, bottom: 40},
    layers: 'cs',
  })
  var nW = d.f.length, nG = d.f[0].length
  var x = d3.scaleLinear().domain([-0.5, nG - 0.5]).range([0, c.width])
  var y = d3.scaleLinear().domain([-0.5, nW - 0.5]).range([c.height, 0])
  var ctx = c.layers[0]
  d.f.forEach((row, wi) => row.forEach((v, gi) => {
    ctx.fillStyle = v == null ? '#f4f5f7' : d3.interpolateOranges(v)
    ctx.fillRect(
      Math.floor(x(gi - 0.5)), Math.floor(y(wi + 0.5)),
      Math.ceil(x(gi + 0.5)) - Math.floor(x(gi - 0.5)),
      Math.ceil(y(wi - 0.5)) - Math.floor(y(wi + 0.5)))
  }))
  ;[20, 40, 60].forEach(b => {
    c.svg.append('line').at({
      x1: x(b - 0.5), x2: x(b - 0.5), y1: 0, y2: c.height,
      stroke: '#1f2937', strokeWidth: 0.6, opacity: 0.5})
    c.svg.append('line').at({
      x1: 0, x2: c.width, y1: y(b - 0.5), y2: y(b - 0.5),
      stroke: '#1f2937', strokeWidth: 0.6, opacity: 0.5})
  })
  c.x = x; c.y = y
  c.xAxis.scale(x).ticks(4)
  c.yAxis.scale(y).ticks(4)
  c.drawAxis()
  c.svg.selectAll('.domain').remove()
  util.addAxisLabel(c, 'readout comma', 'word read at #', '', 6)

  var cbH = 195, cbW = 9, n = 50
  var cb = c.svg.append('g').translate([c.width + 12, (c.height - cbH)/2])
  cb.appendMany('rect', d3.range(n)).at({
    y: i => cbH - (i+1)*cbH/n, width: cbW, height: cbH/n + 1,
    fill: i => d3.interpolateOranges(i/(n-1)),
  })
  var cy = d3.scaleLinear().domain([0, 1]).range([cbH, 0])
  cb.appendMany('text', [0, 0.5, 1]).text(v => d3.format('.1f')(v))
    .at({x: cbW + 4, y: v => cy(v) + 3, fontSize: 9, fill: '#555'})
  cb.append('text').text(`P(band-min rank ≤ ${d.k25})`)
    .at({transform: `translate(${cbW + 30},${cbH/2}) rotate(-90)`,
         textAnchor: 'middle', fontSize: 9, fill: '#555'})
}

window.initCapacityFinalBand = async function(opts){
  var sel = d3.select('.capacity-final-band').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')
  var r1 = sel.append('div.panel-row')
  drawA(r1, d)
  drawB(r1, d)
  drawC(r1, d)
  var r2 = sel.append('div.panel-row')
  drawD(r2, d)
  drawE(r2, d)
  drawF(r2, d)
}

}()
window.init?.()

// ─── public/flex-generalization-example/init-flex-generalization-example.js ───
window.initFlexGenExample = async function(opts){
  var sel = d3.select('.flex-generalization-example').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var CLEAN = util.gray[500], SWAP = util.tol.orange
  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  var panels = sel.appendMany('div.fge-panel', d.blocks)

  var left = panels.append('div.fge-left')
  left.append('div.fig-title').text(b => b.func.charAt(0).toUpperCase() + b.func.slice(1))
  var splitHit = b => b.prompt.match(/^([\s\S]*?)([A-Za-z0-9]+|.)$/).slice(1)
  var prompt = left.append('div.fge-prompt')
  prompt.append('span').text(b => splitHit(b)[0])
  prompt.append('span.tok-hit').text(b => splitHit(b)[1])
  left.append('div.fge-swap').html(
    `J-lens coordinate swap: ${esc(d.swap_from)} → <span style="color:${SWAP}">${esc(d.swap_to)}</span>`)

  var right = panels.append('div.fge-right')
  function col(side, label, color, barBg){
    var c = right.append('div.fge-col.bar-table').classed(side, true)
    c.append('h6.mlabel').html((b, i) =>
      `<span class="swatch" style="background:${color}"></span> ${esc(label)}` +
      (i == 0 && side == 'clean' ? ` <span class="hdr-sub">(log prob)</span>` : ''))
    c.appendMany('div.bar-row', b => b[side].map(e => ({...e, w: Math.exp(e.lp)/d.max_prob*100})))
      .at({title: e => e.tok})
      .html(e => `<div class="bar" style="width:${e.w.toFixed(1)}%;background:${barBg}"></div>` +
                 `<span class="t">${esc(e.tok)}</span><span class="val">${e.lp.toFixed(2)}</span>`)
  }
  col('clean', 'Clean', CLEAN, util.gray[200])
  col('patched', 'Swapped', SWAP, util.tint(SWAP, 0.65))
}

window.init?.()

// ─── public/flex-generalization-systematic/init-flex-generalization-systematic.js ───
!function(){

var INK = '#1f2937', GREY = '#9ca3af', LIGHT = '#d1d5db', MUTED = '#888'

// Per-label nudges for scatter points that land on top of each other
// (mirrors the matplotlib figure).
// Points whose labels sit on top of a neighbour — drop the label, keep the dot.
var NO_LABEL = new Set(['class', 'square'])

var NUDGE = {
  continent: [-7, -3, 'end'], holiday: [7, -3, 'start'],
  first_letter: [-7, 3, 'end'], square: [-7, -3, 'end'],
  legs: [-7, -3, 'end'], double: [7, -3, 'start'],
}

function drawDots(sel, d){
  var col = sel.append('div.panel')
  col.append('div.mlabel').text('fraction of swaps at top-1, by function')
  var catColor = {}
  d.cats.forEach(c => catColor[c.name] = c.color)
  var rows = []
  d.cats.forEach(c => {
    var sub = d.funcs.filter(f => f.cat == c.name)
      .sort((a, b) => b.hit2 - a.hit2)
    rows.push(...sub)
  })
  var c = d3.conventions({
    sel: col.append('div'),
    width: 230, height: 300,
    margin: {left: 98, right: 12, top: 10, bottom: 42},
    layers: 's',
  })
  c.x.domain([0, 1])
  c.xAxis.tickValues([0, 0.5, 1])
  var y = i => (i + 0.5) * c.height / rows.length
  c.svg.append('g.x.axis').translate([0, c.height]).call(c.xAxis)
  c.svg.selectAll('.domain').remove()
  c.svg.append('path.spine').at({
    d: `M0,0 V${c.height} H${c.width}`, stroke: '#888', strokeWidth: 0.7, fill: 'none'})
  util.addAxisLabel(c, 'fraction at top-1', '', '', 6)

  var catBreaks = []
  var n = 0
  d.cats.slice(0, -1).forEach(cat => {
    n += d.funcs.filter(f => f.cat == cat.name).length
    catBreaks.push(n)
  })
  catBreaks.forEach(b => {
    c.svg.append('line').at({
      x1: -96, x2: c.width, y1: y(b - 0.5), y2: y(b - 0.5),
      stroke: LIGHT, strokeWidth: 0.5})
  })

  rows.forEach((f, i) => {
    var color = catColor[f.cat]
    var h1 = f.hit1 / f.n, h2 = f.hit2 / f.n
    c.svg.append('line').at({
      x1: 0, x2: c.x(h1), y1: y(i), y2: y(i),
      stroke: color, strokeWidth: 1.2, opacity: 0.35})
    c.svg.append('line').at({
      x1: 0, x2: c.x(h2), y1: y(i), y2: y(i),
      stroke: color, strokeWidth: 1, opacity: 0.35, strokeDasharray: '3 2'})
    c.svg.append('circle').at({
      cx: c.x(h1), cy: y(i), r: 4, fill: color, stroke: INK, strokeWidth: 0.4})
    var g = c.svg.append('g').translate([c.x(h2), y(i)])
    ;[[-3, -3, 3, 3], [-3, 3, 3, -3]].forEach(([a, b1, e, f2]) => {
      g.append('line').at({
        x1: a, y1: b1, x2: e, y2: f2, stroke: color, strokeWidth: 1.3})
    })
    c.svg.append('text.ytick').text(f.func)
      .at({x: -5, y: y(i), dy: '0.32em', textAnchor: 'end'})
  })

  var leg = c.svg.append('g.legend').translate([c.width - 64, c.height - 14 * (d.cats.length + 2)])
  d.cats.forEach((cat, i) => {
    var g = leg.append('g').translate([0, i * 14])
    g.append('circle').at({r: 4, fill: cat.color, stroke: INK, strokeWidth: 0.4})
    g.append('text').text(cat.name).at({x: 9, dy: '0.32em'})
  })
  ;[['α=1', null, 'o'], ['α=2', '3 2', 'x']].forEach(([lab, dash, m], i) => {
    var g = leg.append('g').translate([0, (d.cats.length + i) * 14])
    g.append('line').at({x1: -5, x2: 5, stroke: MUTED, strokeDasharray: dash})
    m == 'o'
      ? g.append('circle').at({r: 3.5, fill: '#fff', stroke: MUTED})
      : [[-3, -3, 3, 3], [-3, 3, 3, -3]].forEach(([a, b1, e, f2]) =>
          g.append('line').at({x1: a, y1: b1, x2: e, y2: f2, stroke: MUTED, strokeWidth: 1.2}))
    g.append('text').text(lab).at({x: 9, dy: '0.32em'})
  })
}

function drawScatter(sel, d){
  var col = sel.append('div.panel')
  col.append('div.mlabel').text('swap effect vs workspace loading')
  var catColor = {}
  d.cats.forEach(c => catColor[c.name] = c.color)
  var xs = d.funcs.map(f => f.x_cos), ys = d.funcs.map(f => f.dlpc)
  var xspan = d3.max(xs) - d3.min(xs), yspan = d3.max(ys) - d3.min(ys)
  var xlo = d3.min(xs) - 0.06 * xspan, xhi = d3.max(xs) + 0.18 * xspan
  var ylo = Math.min(d3.min(ys), 0) - 0.06 * yspan, yhi = d3.max(ys) + 0.08 * yspan

  var c = d3.conventions({
    sel: col.append('div'),
    width: 330, height: 300,
    margin: {left: 52, right: 10, top: 10, bottom: 42},
    layers: 's',
  })
  c.x.domain([xlo, xhi])
  c.y.domain([ylo, yhi])
  c.xAxis.ticks(5)
  c.yAxis.ticks(5)
  c.drawAxis()
  c.svg.selectAll('.domain').remove()
  c.svg.append('path.spine').at({
    d: `M0,0 V${c.height} H${c.width}`, stroke: '#888', strokeWidth: 0.7, fill: 'none'})
  util.addAxisLabel(c,
    'workspace loading of the argument (cosine sim)',
    `log-prob shift toward the swapped-in answer (α=${d.scatter_alpha})`, '', 6)

  c.svg.append('line').at({
    x1: 0, x2: c.width, y1: c.y(0), y2: c.y(0), stroke: LIGHT, strokeWidth: 0.7})
  var fx = [xlo, xhi]
  c.svg.append('line').at({
    x1: c.x(fx[0]), y1: c.y(d.fit.slope * fx[0] + d.fit.intercept),
    x2: c.x(fx[1]), y2: c.y(d.fit.slope * fx[1] + d.fit.intercept),
    stroke: MUTED, strokeWidth: 1.1, strokeDasharray: '4 3', opacity: 0.55})
  c.svg.append('text.rlabel').text(`r = ${d.r > 0 ? '+' : ''}${d3.format('.2f')(d.r)}`)
    .at({x: 8, y: 14})

  d.funcs.forEach(f => {
    c.svg.append('circle').at({
      cx: c.x(f.x_cos), cy: c.y(f.dlpc), r: 4.5,
      fill: catColor[f.cat], stroke: INK, strokeWidth: 0.4, opacity: 0.9})
    if (NO_LABEL.has(f.func)) return
    var [dx, dy, anchor] = NUDGE[f.func] || [5, -2, 'start']
    c.svg.append('text.flabel').text(f.func)
      .at({x: c.x(f.x_cos) + dx, y: c.y(f.dlpc) + dy, dy: '0.32em', textAnchor: anchor})
  })
}

window.initFlexGeneralizationSystematic = async function(opts){
  var sel = d3.select('.flex-generalization-systematic').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')
  var row = sel.append('div.panel-row')
  drawDots(row, d)
  drawScatter(row, d)
}

}()
window.init?.()

// ─── public/capacity-band-vs-single/init-capacity-band-vs-single.js ───
!function(){

var ORANGE = '#ff6b35', BLUE = '#2563eb', GREY = '#9ca3af'

function lineChart(sel, title, opts){
  var col = sel.append('div.panel')
  col.append('div.mlabel').text(title)
  var c = d3.conventions({
    sel: col.append('div'),
    width: 270, height: 250,
    margin: {left: 46, right: 10, top: 12, bottom: 40},
    layers: 's',
  })
  c.x.domain(opts.xdom)
  c.y.domain(opts.ydom)
  c.xAxis.ticks(5)
  c.yAxis.ticks(5)
  c.drawAxis()
  c.svg.selectAll('.domain').remove()
  c.svg.append('path.spine').at({
    d: `M0,0 V${c.height} H${c.width}`, stroke: '#888', strokeWidth: 0.7, fill: 'none'})
  util.addAxisLabel(c, opts.xlabel, opts.ylabel, '', 6)
  return c
}

function band(c, xs, q1, q3, color){
  var area = d3.area().x((v, i) => c.x(xs[i])).y0(v => c.y(v[0])).y1(v => c.y(v[1]))
  c.svg.append('path').at({
    d: area(q1.map((v, i) => [v, q3[i]])), fill: color, opacity: 0.10})
}

function line(c, xs, ys, color, opts){
  var ln = d3.line().x((v, i) => c.x(xs[i])).y(v => c.y(v))
  c.svg.append('path').at({
    d: ln(ys), stroke: color, fill: 'none',
    strokeWidth: opts?.lw ?? 2, strokeDasharray: opts?.dash || null})
}

function legend(c, entries){
  var leg = c.svg.append('g.legend').translate([8, 8])
  entries.forEach((e, i) => {
    var g = leg.append('g').translate([0, i * 14])
    g.append('line').at({x1: 0, x2: 14, stroke: e.color,
      strokeWidth: e.lw ?? 2, strokeDasharray: e.dash || null})
    g.append('text').text(e.label).at({x: 18, dy: '0.32em'})
  })
}

function drawOcc(sel, d, src, title, ylabel, ylimTop){
  var xs = d3.range(d.ng)
  var c = lineChart(sel, title, {
    xdom: [0, d.ng - 1], ydom: [0, ylimTop],
    xlabel: 'comma #', ylabel,
  })
  ;[['family', ORANGE], ['random', BLUE]].forEach(([lab, color]) => {
    var s = src.b[lab]
    band(c, xs, s.read_q1, s.read_q3, color)
    line(c, xs, s.read_med, color)
    line(c, xs, s.all_med, color, {lw: 1.5, dash: '4 2'})
  })
  legend(c, [
    {label: 'family: read', color: ORANGE},
    {label: 'family: all 80', color: ORANGE, dash: '4 2', lw: 1.5},
    {label: 'random: read', color: BLUE},
    {label: 'random: all 80', color: BLUE, dash: '4 2', lw: 1.5},
  ])
}

function drawThresh(sel, d, src, title, xlabel){
  var c = lineChart(sel, title, {
    xdom: [0, 100], ydom: [0, 100],
    xlabel, ylabel: '# read words ≤ K (near end of list)',
  })
  c.svg.append('line').at({
    x1: 0, x2: c.width, y1: c.y(80), y2: c.y(80),
    stroke: GREY, strokeWidth: 1, strokeDasharray: '4 2'})
  c.svg.append('text').text('list length (80)')
    .at({x: c.width - 4, y: c.y(80) - 5, textAnchor: 'end', fontSize: 9, fill: '#6b7280'})
  line(c, src.c.ks, src.c.family, ORANGE)
  line(c, src.c.ks, src.c.random, BLUE)
  line(c, src.c.ks, src.c.control, GREY, {lw: 1.2})
  legend(c, [
    {label: 'family', color: ORANGE},
    {label: 'random', color: BLUE},
    {label: 'control', color: GREY, lw: 1.2},
  ])
}

window.initCapacityBandVsSingle = async function(opts){
  var sel = d3.select('.capacity-band-vs-single').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')
  // Shared, fixed y-limit for the occupancy panels — matches the main-text
  // capacity figure and keeps the legend clear of the curves.
  var ylimTop = 50

  var r1 = sel.append('div.panel-row')
  drawOcc(r1, d, d.band, `words in the readout — any layer of the workspace (${d.band_lbl})`,
    `# list words in top-${d.k25} (band-min)`, ylimTop)
  drawThresh(r1, d, d.band, 'read words vs rank threshold — any workspace layer',
    'rank threshold K (band-min)')

  var r2 = sel.append('div.panel-row')
  drawOcc(r2, d, d.single, `words in the readout — single layer (${d.single_lbl})`,
    `# list words in top-${d.k25}`, ylimTop)
  drawThresh(r2, d, d.single, `read words vs rank threshold — single layer (${d.single_lbl})`,
    'rank threshold K')
}

}()
window.init?.()

// ─── public/app-mt-examples/init-app-mt-examples.js ───
window.initAppMtExamples = async function(opts){
  var sel = d3.select('.app-mt-examples').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var JL = util.lensColors.jacobian, TPL = util.tol.orange
  var esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  var row = sel.append('div.amx-row')

  function barTable(host, label, color, entries){
    var t = host.append('div.amx-bars.bar-table')
    var h = t.append('h6')
    h.append('span.swatch').st({background: color, marginRight: 5})
    h.append('span').text(label)
    var max = d3.max(entries, e => Math.exp(e.lp))
    var bg = util.tint(color, 0.7)
    t.appendMany('div.bar-row', entries)
      .at({title: e => util.ppCell(e.tok).trim()})
      .html(e =>
        `<div class="bar" style="width:${(Math.exp(e.lp)/max*100).toFixed(1)}%;background:${bg}"></div>` +
        `<span class="t${e.italic ? ' it' : ''}">${esc(util.ppCell(e.tok).trim())}</span>` +
        `<span class="val">${e.lp.toFixed(1)}</span>`)
  }

  // ── A: blackmail ──
  var bm = d.blackmail
  var colA = row.append('div.amx-col')
  colA.append('div.fig-title').text('A. Reading out “blackmail”')
  var prA = colA.append('div.amx-prompt.prompt-block')
  prA.append('span.ctx').text(
    '[in the middle of the blackmail evaluation scenario; ' +
    'both lenses are read at the highlighted token]\n')
  prA.append('span').text(bm.excerpt.pre)
  prA.append('span.tok-hit').text(bm.excerpt.hit)
  prA.append('span').text(bm.excerpt.post)
  var cA = colA.append('div.amx-cols')
  barTable(cA, `Jacobian lens (${bm.layer_label})`, JL, bm.jlens)
  barTable(cA, `template lens (${bm.layer_label})`, TPL, bm.template)

  // ── B: photosynthesis ──
  var ph = d.photosynthesis
  var colB = row.append('div.amx-col')
  colB.append('div.fig-title').text('B. Reading out “photosynthesis”')
  var prB = colB.append('div.amx-prompt.prompt-block')
  prB.append('span').text(ph.prompt_pre)
  prB.append('span.tok-hit').text(ph.prompt_hit)
  prB.append('span').text(ph.prompt_post)
  var cB = colB.append('div.amx-cols')
  barTable(cB, `Jacobian lens (${ph.layer_label})`, JL, ph.jlens)
  barTable(cB, `template lens (${ph.layer_label})`, TPL, ph.template)

  // ── C: Tchaikovsky↔Beethoven swap ──
  var colC = row.append('div.amx-col')
  colC.append('div.fig-title').text('C. Causal interventions')
  d.swaps.forEach(s => {
    colC.append('div.amx-prompt.prompt-block').text(s.prompt)
    var sw = colC.append('div.amx-swp')
    var r1 = sw.append('div.amx-row2')
    r1.append('span.lab').text("model's answer:")
    r1.append('span').append('span.out').append('b').text(s.ans)
    var r2 = sw.append('div.amx-row2')
    r2.append('span.lab').st({color: TPL})
      .html(`swap <i>${esc(s.src)}</i>&rarr;<i>${esc(s.dst)}</i> templates:`)
    r2.append('span').append('span.out.hi').text(s.swapped)
  })
}

window.init?.()

// ─── public/oracle-lens/init-oracle-lens.js ───
window.initOracleLens = async function(opts){
  var sel = d3.select('.oracle-lens').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var grid = sel.append('div.ol-grid.figgrid')
  d.panels.forEach(p => {
    var card = grid.append('div.cell.ol-card')
    var hd = card.append('div.ol-hd')
    hd.append('span.ol-id').text(p.id)
    hd.append('span.fig-title').text(p.title)

    var body = card.append('div.ol-body')
    var pb = body.append('div.prompt-block' + (p.nowrap ? '.ol-nowrap' : ''))
    if (p.ctx) pb.append('span.ctx').text(p.ctx + '\n')
    if (p.prompt.elide_lo && !p.suppress_lead_elision)
      pb.append('span.ctx').text('[…]\n')
    pb.append('span').text(p.prompt.pre)
    pb.append('span.tok-hit').text(p.prompt.hit)
    pb.append('span').text(p.prompt.post)
    if (p.prompt.elide_hi) pb.append('span.ctx').text('\n[…]')

    var pcol = body.append('div.ol-pcol')
    pcol.append('div.mlabel')
      .html('Oracle lens <span class="ol-sub">(N=4, K=10)</span>')
    var bold = new Set(p.bold)
    pcol.append('ol.ol-phrases')
      .appendMany('li', p.phrases)
      .classed('bold', (_, i) => bold.has(i))
      .text(ph => ph)
  })
}

window.init?.()

// ─── public/app-mt-bytok/init-app-mt-bytok.js ───
window.initAppMtBytok = async function(opts){
  var sel = d3.select('.app-mt-bytok').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var styleOf = {
    'jlens':      {color: util.lensColors.jacobian, dash: null,  marker: 'o'},
    'jlens-dash': {color: util.lensColors.jacobian, dash: '4,3', marker: 'o-open'},
    'template':   {color: util.tol.orange,          dash: null,  marker: 's'},
    'raw':        {color: util.gray[500],           dash: null,  marker: 'd'},
  }

  var row = sel.append('div.panel-row').st({flexDirection: 'row'})
  drawPanel(row.append('div.app-mt-panel'), d.readout, d.n_readout,
            'Decoding the intermediate concept', 'fraction in top 10',
            'tokens in the latent word')
  drawPanel(row.append('div.app-mt-panel'), d.swap, d.n_swap,
            'Swapping the intermediate concept',
            'P(answer follows the swap) at α = 1',
            'tokens in the anchor word')

  var leg = sel.append('div.app-mt-legend')
  d.readout.forEach(s => {
    var st = styleOf[s.style]
    var item = leg.append('span.leg-item')
    item.append('svg').at({width: 24, height: 12}).append('line')
      .at({x1: 0, x2: 24, y1: 6, y2: 6, stroke: st.color, strokeWidth: 1.6,
           strokeDasharray: st.dash || null})
    item.append('span').text(s.label)
  })

  function drawPanel(sel, series, ns, title, ylab, xlab){
    var c = d3.conventions({
      sel, width: 340, height: 240,
      margin: {left: 56, right: 12, top: 30, bottom: 44},
    })
    var x = d3.scalePoint().domain(d.buckets).range([0, c.width]).padding(0.2)
    c.y.domain([-0.03, 1.04])
    c.yAxis.ticks(5).tickFormat(d3.format('.0%'))
    c.drawAxis()
    c.svg.select('.x').remove()
    util.ggPlot(c)
    util.addAxisLabel(c, xlab, ylab, title, 0, -8)

    c.svg.appendMany('text.xlab', d.buckets)
      .translate((b, i) => [x(b), c.height + 14])
      .at({textAnchor: 'middle'}).text(b => b)
    c.svg.appendMany('text.xlab-n', d.buckets)
      .translate((b, i) => [x(b), c.height + 26])
      .at({textAnchor: 'middle', fill: util.gray[500]})
      .style('font-size', '10px')
      .text((b, i) => '(n=' + ns[i] + ')')

    var nM = series.length
    var off = i => (i - (nM - 1)/2) * 6
    series.forEach((s, i) => {
      var st = styleOf[s.style]
      var pts = s.points.map((p, j) => ({...p, xi: x(p.bucket) + off(i)}))
      c.svg.append('path')
        .at({d: d3.line().x(p => p.xi).y(p => c.y(p.p))(pts),
             stroke: st.color, strokeWidth: 1.6, fill: 'none',
             strokeDasharray: st.dash || null})
      var g = c.svg.appendMany('g.pt', pts).translate(p => [p.xi, 0])
      g.append('line')
        .at({y1: p => c.y(p.lo), y2: p => c.y(p.hi),
             stroke: st.color, strokeWidth: 1.0})
      g.append('circle')
        .at({cy: p => c.y(p.p), r: 3.2,
             fill: st.marker == 'o-open' ? '#fff' : st.color,
             stroke: st.color, strokeWidth: 1.2})
      g.append('title').text(p => `${s.label}\n${p.bucket} tok: ${p.k}/${p.n} (${d3.format('.0%')(p.p)})`)
    })
  }
}

// ─── public/app-mt-paper/init-app-mt-paper.js ───
window.initAppMtPaper = async function(opts){
  var sel = d3.select('.app-mt-paper').html('')
  var base = (opts?.datapath || './').replace(/\/?$/, '/')
  var d = await util.getFile(base + 'data.json')

  var colorOf = {
    'jlens':      util.lensColors.jacobian,
    'jlens-dash': util.lensColors.jacobian,
    'template':   util.tol.orange,
    'raw':        util.gray[500],
  }

  var row = sel.append('div.panel-row').st({flexDirection: 'row'})
  drawBars(row.append('div.app-mt-panel'), d.readout,
           'Decoding the intermediate concept', 'fraction in top 10')
  drawBars(row.append('div.app-mt-panel'), d.swap,
           'Swapping the intermediate concept',
           'P(answer follows the swap) at α = 1')
  sel.append('div.app-mt-n').text('n = ' + d.n)

  function drawBars(sel, series, title, ylab){
    var c = d3.conventions({
      sel, width: 240, height: 220,
      margin: {left: 56, right: 12, top: 30, bottom: 18},
    })
    var x = d3.scaleBand().domain(series.map(s => s.key))
      .range([0, c.width]).paddingInner(0.30).paddingOuter(0.18)
    c.y.domain([-0.03, 1.04])
    c.yAxis.ticks(5).tickFormat(d3.format('.0%'))
    c.drawAxis()
    c.svg.select('.x').remove()
    util.ggPlot(c)
    util.addAxisLabel(c, '', ylab, title, 0, -8)

    var g = c.svg.appendMany('g.mbar', series).translate(s => [x(s.key), 0])
    g.append('rect').at({
      width: x.bandwidth(), y: s => c.y(s.p), height: s => c.height - c.y(s.p),
      fill: s => colorOf[s.style], fillOpacity: 0.30,
    })
    g.each(function(s){
      util.barWhisker(d3.select(this), {x: x.bandwidth()/2, lo: c.y(s.lo), hi: c.y(s.hi)})
    })
    g.append('title').text(s => `${s.label}: ${s.k}/${s.n} (${d3.format('.0%')(s.p)})`)
  }

  var leg = sel.append('div.app-mt-legend')
  d.swap.forEach(s => {
    var item = leg.append('span.leg-item')
    item.append('span.swatch').st({background: colorOf[s.style], opacity: 0.30})
    item.append('span').text(s.label)
  })
}

// ─── public/init.js ───
addEventListener('scroll', function(){
  var b = document.querySelector('.draft-banner')
  if (b) b.classList.toggle('scrolled', scrollY > 120)
  // Floating TOC dropdown appears once the in-page contents has scrolled
  // off the top.
  var dc = document.querySelector('d-contents')
  var t = document.querySelector('.toc-float')
  if (t) t.classList.toggle('show', !dc || !dc.offsetHeight || dc.getBoundingClientRect().bottom < 0)
  window.updateTocFloatLabel()
}, {passive: true})

// Floating-TOC button label tracks the current section — the last TOC-listed
// heading above the viewport top, §-numbered like the d-contents entries.
// 'Contents' before the first section.
window.updateTocFloatLabel = function(){
  var lbl = document.querySelector('.toc-float-btn .lbl')
  if (!lbl) return
  var cur = null, heads = window.__tocHeadings || []
  for (var i = 0; i < heads.length && heads[i].getBoundingClientRect().top <= 80; i++) cur = heads[i]
  if (!cur){ lbl.textContent = 'Contents'; return }
  lbl.textContent = ''
  var num = lbl.appendChild(document.createElement('span'))
  num.className = 'num'
  num.textContent = '§ ' + cur.dataset.secnum + ' '
  lbl.appendChild(document.createTextNode(cur.querySelector('a[id]').textContent))
}

window.buildToc = function(){
  var nav = d3.select('d-contents').html('').append('nav')
  if (!nav.size()) return
  nav.append('h3').text('Contents')
  var ul, n = [0, 0, 0], h2 = 0, appx = 0
  window.__secNum = {}
  function entry(parent, num, id, text){
    var a = parent.append('a').at({href: '#' + id})
    a.append('span.toc-num').text(num)
    a.append('span').text(text)
  }
  // gdoc H1/H2/H3 → html h2/h3/h4 (process_doc remaps down one). TOC lists
  // h2+h3; h4 is numbered (N.M.K, \ref{}-able via __secNum) but not listed.
  d3.selectAll('d-article h2, d-article h3, d-article h4').each(function(){
    var a = this.querySelector('a[id]')
    if (!a) return
    var num
    if (this.tagName == 'H2'){
      // First H2 with id 'appendix' (and any later H2s) switch to letter
      // numbering: A, A.1, A.1.2. n[0] becomes a string; the '.'-concat
      // and n.join('.') below both handle that without further changes.
      n = (a.id == 'appendix' || appx)
        ? [String.fromCharCode(65 + appx++), 0, 0]
        : [++h2, 0, 0]
      num = window.__secNum[a.id] = '' + n[0]
      entry(nav.append('div'), num, a.id, a.textContent)
      ul = nav.append('ul')
    } else if (this.tagName == 'H3' && n[0]){
      n[1] += 1; n[2] = 0
      num = window.__secNum[a.id] = n[0] + '.' + n[1]
      entry(ul.append('li'), num, a.id, a.textContent)
    } else if (this.tagName == 'H4' && n[1]){
      n[2] += 1
      num = window.__secNum[a.id] = n.join('.')
    }
    // Prefix the number as a real <a> so it's clickable (scrolls + sets hash);
    // sits before the existing a[id] so a.textContent stays number-free for the
    // TOC entry above.
    if (num){
      this.dataset.secnum = num
      d3.select(this).selectAll('a.secnum, a\\.secnum').remove()
      d3.select(this).insert('a', ':first-child')
        .at({class: 'secnum', href: '#' + a.id}).text(num)
    }
  })

  // Visual-TOC tiles (server-side from [[VISUAL_TOC]]) get the same §-number
  // via __secNum so the grid stays in sync with d-contents numbering.
  d3.selectAll('.visual-toc a.visual-toc-top').each(function(){
    var slug = (this.getAttribute('href') || '').slice(1)
    var num = window.__secNum[slug]
    if (num) d3.select(this).select('.toc-num').text('§ ' + num)
  })

  // Floating top-left TOC dropdown — same entries as <d-contents>, shown
  // (via the scroll handler above) once the in-page contents has scrolled
  // away. The clone keeps the toc-num spans so numbering matches.
  d3.select('.toc-float').remove()
  var float = d3.select('body').append('div.toc-float')
  float.append('button.toc-float-btn')
    .at({'aria-label': 'Table of contents'})
    .html('<span class="ico">☰</span><span class="lbl">Contents</span>')
    .on('click', function(){ float.classed('open', !float.classed('open')) })
  var menu = float.append('div.toc-float-menu')
  menu.node().appendChild(nav.node().cloneNode(true))
  menu.on('click', function(e){
    if (e.target.closest('a')) float.classed('open', false)
  })
  d3.select(document).on('click.tocfloat', function(e){
    if (!float.node().contains(e.target)) float.classed('open', false)
  })
  window.__tocHeadings = d3.selectAll('d-article h2[data-secnum], d-article h3[data-secnum]').nodes()
  window.updateTocFloatLabel()
}

window.init = async function(){
  var token = window.__initToken = {}
  if (!d3.select('.tooltip').size()) d3.select('body').append('div.tooltip.tooltip-hidden')
  window.buildToc()
  // figure data-fignum is server-side and __secNum is built above — resolve now
  // so refs don't sit at "??" through the (slow) figure data fetches below.
  util.resolveFigRefs()
  d3.selectAll('figure[data-fignum]').each(function(){
    var m = this.firstElementChild
    if (m && m.offsetWidth) this.style.setProperty('--mount-w', m.offsetWidth + 'px')
  })
  util.fitFigures()
  await Promise.all([
    [window.initIntroFunctional, 'intro-functional'],
    // The first panel caption (Multihop recall) carries "Figure N:"; the init
    // hides the gdoc figcaption's number so it appears exactly once.
    [window.initLensInline, 'lens-inline'],
    // No figIntro preamble — the first panel caption stays as short as its siblings
    // ("Figure N:" prefix + the spider/legs/8 sentence only).
    [opts => window.initLensInline({...opts, sel: '.lens-inline-reasoning', sliceLink: false}), 'lens-inline-reasoning'],
    [opts => window.initSliceStack({...opts, sel: '.slice-stack-count', slugs: 'count_introspect'}), 'slice-stack-count', 'lens-slice-ranks-s2'],
    [opts => window.initSliceInline({...opts, sel: '.slice-inline-count', slugs: 'count_five'}), 'slice-inline-count', 'lens-slice-ranks-s2'],
    [opts => window.initSliceInline({...opts, sel: '.slice-inline-introspection', slugs: 'introspection'}), 'slice-inline-introspection', 'lens-slice-ranks-s2'],
    [window.initLensSlice, 'lens-slice', 'lens-slice-ranks-s2'],
    [window.initOooAbcd, 'ooo-abcd'],
    [window.initOooPatch, 'ooo-patch'],
    [window.initFeatureExamples, 'feature-examples'],
    [window.initFeatureCoverage, 'feature-coverage'],
    [window.initCompLines, 'comp-lines-attn-adj', 'comp-lines'],
    [opts => window.initCompStrata({...opts, variant: 'sae6'}),  'comp-strata',       'comp-strata'],
    [opts => window.initCompStrata({...opts, variant: 'nosae'}), 'comp-strata-nosae', 'comp-strata'],
    [window.initCompTailEnergy, 'comp-tail-energy'],
    [window.initMlpGain, 'mlp-gain'],
    [window.initLensSimilarity, 'lens-similarity'],
    [window.initTranscoderArith, 'transcoder-arith'],
    [window.initTranscoderTranslation, 'transcoder-translation'],
    [window.initJlensCircuitGraph, 'jlens-circuit-graph'],
    [window.initAttnPanel, 'attn-panel'],
    [window.initAttnPanelAppendix, 'attn-panel-appendix'],
    [window.initAttnBroadcastReselect, 'attn-broadcast-reselect'],
    [window.initAblationBars, 'ablation-bars'],
    [window.initAblationExamples, 'ablation-examples'],
    [window.initAblationStrength, 'ablation-strength'],
    [window.initBlackmailClamp, 'blackmail-clamp'],
    [opts => window.initLensCalloutMain({...opts, sel: '.lens-callout-blackmail', fig: 'blackmail'}),
      'lens-callout-blackmail', 'lens-callout-main/sonnet45'],
    [opts => window.initLensCalloutMain({...opts, sel: '.lens-callout-evil-anthropic', fig: 'evil_anthropic'}),
      'lens-callout-evil-anthropic', 'lens-callout-main/opus45'],
    [opts => window.initLensappPanel({...opts, slug: 'eval_aware'}), 'lensapp-eval-aware', 'lensapp-panel'],
    [window.initMisalignLens, 'misalign-lens'],
    [window.initMisalignLensExample, 'misalign-lens-example', 'misalign-lens'],
    [window.initRewardHackReadout, 'reward-hack-readout', 'misalign-lens'],
    [window.initRewardHackQuant, 'reward-hack-quant', 'misalign-lens'],
    [window.initRoleplayLens, 'roleplay-lens'],
    [window.initRoleplayLensExample, 'roleplay-lens-example', 'roleplay-lens'],
    [window.initJlensRmBias, 'jlens-rm-bias'],
    [window.initJlensAudit, 'jlens-audit'],
    [window.initJlensRmBiasExamples, 'jlens-rm-bias-examples'],
    [window.initPrefViolationLens, 'pref-violation-lens'],
    [window.initReflectionTraining, 'reflection-training'],
    [window.initDnTracecond, 'dn-tracecond'],
    [window.initDnExclusion, 'dn-exclusion'],
    [opts => window.initReflectionTraining({...opts, sel: '.reflection-fabrication',
      figTitle: 'Fabrication admission eval'}), 'reflection-fabrication'],
    [opts => window.initReflectionTraining({...opts, sel: '.reflection-deception',
      figTitle: 'Deception refusal eval'}), 'reflection-deception'],
    [window.initReflTrainingExamples, 'refl-training-examples'],
    [window.initModulationReadout, 'modulation-readout'],
    [window.initModulationLines, 'modulation-lines'],
    [window.initModulationPrompts, 'modulation-prompts'],
    [window.initMethodsQualitative, 'methods-qualitative'],
    [window.initLatentPatching, 'latent-patching'],
    [opts => window.initLatentPatching({...opts, sel: '.flex-gen-example'}), 'flex-gen-example'],
    [window.initMultihopSwapSuccess, 'multihop-swap-success'],
    [window.initRepeatSwitch, 'repeat-switch'],
    [window.initVerbalReport, 'verbal-report'],
    [window.initVerbalIntrospection, 'verbal-introspection'],
    [window.initTopDownSummoning, 'top-down-summoning'],
    [opts => window.initTopDownSummoning({...opts, sel: '.top-down-summoning-appendix', spec: 'appendix'}), 'top-down-summoning-appendix', 'top-down-summoning'],
    [window.initFlexGenSystematic, 'flex-gen-systematic'],
    [opts => window.initFlexGenSystematic({...opts, sel: '.flex-gen-appendix', spec: 'appendix'}), 'flex-gen-appendix', 'flex-gen-systematic'],
    [window.initSelectivityLinecount, 'selectivity-linecount'],
    [window.initSelectivityLanguage, 'selectivity-language'],
    [opts => window.initPostTraining({...opts, sel: '.post-training-tylenol', spec: 'tylenol'}), 'post-training-tylenol', 'post-training'],
    [opts => window.initPostTraining({...opts, sel: '.post-training-danger', spec: 'danger'}), 'post-training-danger', 'post-training'],
    [opts => window.initPostTraining({...opts, sel: '.post-training-condolences', spec: 'condolences'}), 'post-training-condolences', 'post-training'],
    [opts => window.initPostTraining({...opts, sel: '.post-training-introspection', spec: 'introspection'}), 'post-training-introspection', 'post-training'],
    [window.initIntroStructural, 'intro-structural'],
    [window.initLayerDiagram, 'layer-diagram'],
    [opts => window.initLinePanels({...opts, spec: 'main'}),     'layer-lines-main',     'layer-lines'],
    [opts => window.initLinePanels({...opts, spec: 'appendix'}), 'layer-lines-appendix', 'layer-lines'],
    [window.initCapacityFveOccupancy, 'capacity-fve-occupancy'],
    [window.initBroadcastAblation, 'broadcast-ablation'],
    [window.initModulationProbe, 'modulation-probe'],
    [window.initProbeSwap, 'probe-swap'],
    [window.initVerbalReportDecompositionMerged, 'verbal-report-decomposition-merged'],
    // The six selfreport figures share one data dir.
    [window.initSelfreportSoc, 'selfreport-soc', 'selfreport'],
    [window.initSelfreportOther, 'selfreport-other', 'selfreport'],
    [window.initSelfreportQuestions, 'selfreport-questions', 'selfreport'],
    [window.initSelfreportStory, 'selfreport-story', 'selfreport'],
    [window.initSelfreportExamples, 'selfreport-examples', 'selfreport'],
    [window.initSelfreportDose, 'selfreport-dose', 'selfreport'],
    [window.initSelfreportControls, 'selfreport-controls', 'selfreport'],
    [window.initMetacogAlarm, 'metacog-alarm'],
    [window.initIgnition, 'ignition'],
    [opts => window.initIgnition({...opts, sel: '.ignition-d', show: 'd'}), 'ignition-d', 'ignition'],
    [opts => window.initIgnition({...opts, sel: '.ignition-e', show: 'e'}), 'ignition-e', 'ignition'],
    [window.initEvalAwarenessProbe, 'eval-awareness-probe'],
    [window.initDualTaskSimple, 'dual-task-simple'],
    [window.initCapacityFinalBand, 'capacity-final-band'],
    [window.initFlexGenExample, 'flex-generalization-example'],
    [window.initFlexGeneralizationSystematic, 'flex-generalization-systematic'],
    [window.initCapacityBandVsSingle, 'capacity-band-vs-single'],
    [window.initAppMtExamples, 'app-mt-examples'],
    [window.initAppMtBytok, 'app-mt-bytok'],
    [window.initAppMtPaper, 'app-mt-paper'],
    [window.initOracleLens, 'oracle-lens'],
  ].map(async ([fn, dp, dataDp]) => {
    var mount = document.querySelector('.' + dp)
    if (!mount || !fn) return
    var figNum = +mount.closest('figure')?.dataset.fignum || null
    try { await fn({datapath: `data/${dataDp || dp}/`, figNum}) } catch(e){ console.warn(dp, e) }
    if (token !== window.__initToken) return
    util.fitMount(mount)
  }))
  if (token !== window.__initToken) return
  util.resolveFigRefs()
  util.fitFigures()
}
window.init()
