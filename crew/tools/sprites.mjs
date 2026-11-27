// Hand-built 32x32 pixel crabs with an automatic 1-cell ink outline. Every cell carries a motion group.
// Usage: node crew/tools/sprites.mjs   -> writes crew/hooks/sprites.ts (the crabs the crew mod draws).
//
// Groups (see CRAB_CSS in crew/hooks/crabs.ts): `la` and `lb` are the two leg pairs that alternate in the
// walk, a prop class (it, orb, flame, ndl, gl, b1, b2, zap, tail, horn, bell) is a prop with a motion of
// its own, and `bd` is everything else. An outline cell joins the group of the cell it outlines.
//
// Drawn for Switchboard in 2026-11 (the owner's working copy outside the repo): crabBase, the palette, the
// outline and the first three sprites (plain, architect, business-analyst) set the style; the rest of the crew
// set follows it. This file is now the source of the crabs.
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../hooks/sprites.ts', import.meta.url))

const N = 32
const INK = '#1F1E1D'
const CLAY = '#D97757'
const CLAY_HI = '#EC9A74'
const CLAY_LO = '#B5573A'
const WHITE = '#F4F3EE'

function grid() {
  const g = Array.from({ length: N }, () => Array(N).fill(null))
  const gr = Array.from({ length: N }, () => Array(N).fill(null))
  const set = (x, y, c, k = 'bd') => { if (x >= 0 && y >= 0 && x < N && y < N) { g[y][x] = c; gr[y][x] = c ? k : null } }
  const get = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : null)
  return { g, gr, set, get }
}

function ellipse(set, cx, cy, rx, ry, colorAt) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry
    if (dx * dx + dy * dy <= 1) set(x, y, colorAt(x, y, dx, dy))
  }
}

// The base crab. `rightClawUp` lifts the right claw so it can hold a prop.
// The three legs on each side alternate: the outer and lowest are pair `la`, the middle one pair `lb`.
function crabBase(s, { rightClawUp = false } = {}) {
  const { set } = s
  const mirror = (pts) => pts.map(([x, y]) => [N - 1 - x, y])
  // legs (drawn first so the shell covers their roots)
  const legsL = [
    [[6, 19], [5, 20], [4, 21], [3, 22], [3, 23]],
    [[7, 22], [6, 23], [5, 24], [5, 25], [5, 26]],
    [[9, 24], [8, 25], [8, 26], [8, 27], [8, 28]],
  ]
  legsL.forEach((leg, i) => { for (const [x, y] of [...leg, ...mirror(leg)]) set(x, y, CLAY_LO, i % 2 === 0 ? 'la' : 'lb') })
  // arms
  const armL = [[7, 17], [6, 16]]
  for (const [x, y] of armL) set(x, y, CLAY)
  const armR = rightClawUp ? [[24, 17], [25, 16], [26, 15], [26, 14], [26, 13]] : mirror(armL)
  for (const [x, y] of armR) set(x, y, CLAY)
  // claws: a round blob with a V notch on top
  const claw = (cx, cy, notchX) => {
    ellipse(set, cx, cy, 3.4, 3.1, (x, y, dx, dy) => (dy < -0.35 && dx < 0.2 ? CLAY_HI : dy > 0.45 ? CLAY_LO : CLAY))
    for (const [x, y] of [[notchX, Math.floor(cy) - 3], [notchX, Math.floor(cy) - 2], [notchX, Math.floor(cy) - 1]]) { s.g[y][x] = null; s.gr[y][x] = null }
  }
  claw(4.5, 13, 5)
  if (rightClawUp) claw(27.5, 10, 26)
  else claw(27.5, 13, 26)
  // shell
  ellipse(set, 16, 20.5, 10.6, 6.6, (x, y, dx, dy) => {
    if (dy < -0.62 && Math.abs(dx) < 0.75) return CLAY_HI
    if (dy > 0.6) return CLAY_LO
    if (dy > 0.3 && Math.abs(dx) > 0.7) return CLAY_LO
    return CLAY
  })
  // shell shine
  for (const [x, y] of [[10, 16], [11, 16], [12, 16], [10, 17]]) set(x, y, CLAY_HI)
  // eye stalks and eyes, spread apart so a hat can sit on the shell between them
  for (const y of [11, 12, 13, 14]) { set(10, y, CLAY); set(21, y, CLAY) }
  for (const ex of [9, 20]) for (let y = 7; y <= 10; y++) for (let x = ex; x < ex + 3; x++) set(x, y, INK)
  set(10, 8, WHITE)
  set(21, 8, WHITE)
}

// 4-neighbour ink outline around every filled cell (works on any square grid). An outline cell takes the
// group most of its filled neighbours are in; on a tie a prop or leg group wins over the body.
function outlineGrid(g, gr) {
  const n = g.length
  const at = (x, y) => (x >= 0 && y >= 0 && x < n && y < n ? g[y][x] : null)
  const add = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (g[y][x]) continue
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => at(x + dx, y + dy)).map(([dx, dy]) => gr[y + dy][x + dx])
    if (near.length === 0) continue
    const count = new Map()
    for (const k of near) count.set(k, (count.get(k) ?? 0) + 1)
    const best = [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] === 'bd') - (b[0] === 'bd'))[0][0]
    add.push([x, y, best])
  }
  for (const [x, y, k] of add) { g[y][x] = INK; gr[y][x] = k }
}
function outline(s) { outlineGrid(s.g, s.gr) }

function center(s) {
  const n = N
  let x0 = n, y0 = n, x1 = -1, y1 = -1
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (s.g[y][x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  const sx = Math.floor((n - (x1 - x0 + 1)) / 2) - x0, sy = Math.floor((n - (y1 - y0 + 1)) / 2) - y0
  const g = Array.from({ length: n }, () => Array(n).fill(null))
  const gr = Array.from({ length: n }, () => Array(n).fill(null))
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (s.g[y][x]) { g[y + sy][x + sx] = s.g[y][x]; gr[y + sy][x + sx] = s.gr[y][x] }
  s.g = g
  s.gr = gr
}

// `grp` is one group for every cell, or an object from the map's characters to their groups (default `bd`).
function stampRows(set, x0, y0, rows, map, grp = 'bd') {
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => { if (map[ch]) set(x0 + dx, y0 + dy, map[ch], typeof grp === 'string' ? grp : (grp[ch] ?? 'bd')) }))
}

// Shared prop colours
const WOOD = '#7A4A26'
const STEEL = '#8E929A'
const SILVER = '#B8BCC4'
const GOLD = '#D4A017'
const YELLOW = '#F5C542'
const BRASS = '#B08D57'
const EYES = [9, 20]

// A frame around each eye (goggles, glasses, mask). `corners` keeps the four corner cells, `bottom` the row under the eye.
function eyeFrame(s, color, { corners = true, bottom = true, colorRight = color } = {}) {
  EYES.forEach((ex, i) => {
    const c = i === 0 ? color : colorRight
    for (let y = 6; y <= (bottom ? 11 : 10); y++) for (let x = ex - 1; x <= ex + 3; x++) {
      const inside = x >= ex && x <= ex + 2 && y >= 7 && y <= 10
      const corner = (x === ex - 1 || x === ex + 3) && (y === 6 || y === 11)
      if (inside || (corner && !corners)) continue
      s.set(x, y, c)
    }
  })
}

// The judge's wig and gavel, shared by reviewer-code and the plugin icon. The gavel is the prop (`it`).
function judge(s) {
  // rows of tight curls, a dark ribbon at the base, short side rolls
  stampRows(s.set, 12, 5, [
    '..wwww..',
    '.wwwwww.',
    '.gwgwgw.',
    '.wwwwww.',
    '.wgwgwg.',
    '.wwwwww.',
    'gwgwgwgw',
    'wwkkkkww',
    'gw....wg',
  ], { w: '#EDEBE4', g: '#A29F93', k: '#2B2B30' })
  stampRows(s.set, 23, 1, [
    'dbBBbbd',
    'dbbbbbd',
    'dbbbbbd',
  ], { b: BRASS, B: '#D2B37C', d: '#7A5F35' }, 'it')
  for (let y = 4; y <= 9; y++) s.set(26, y, WOOD, 'it')
}

function architectHat(s) {
  stampRows(s.set, 13, 5, [
    '..pp..',
    '.pppp.',
    'pppppp',
    'bbbbbb',
    'cdcdcd',
    'cdcdcd',
    'cdcdcd',
    'ssssss',
  ], { p: '#EDEBE4', b: '#3E7CB1', c: '#EDEBE4', d: '#8C8A84', s: '#D6D3C9' })
}

const sprites = {
  plain: () => { const s = grid(); crabBase(s); return s },
  architect: () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    // temple pediment hat sitting on the shell between the eye stalks
    architectHat(s)
    // blueprint held up in the right claw (unrolls)
    stampRows(s.set, 24, 1, [
      'kkkkkk',
      'bwbbwb',
      'bwwwwb',
      'bbwbbb',
      'bwwwwb',
      'kkkkkk',
    ], { k: '#2A5A85', b: '#3E7CB1', w: '#CFE3F3' }, 'it')
    return s
  },
  'business-analyst': () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    // tall bent wizard hat with stars, sitting on the shell between the eye stalks
    stampRows(s.set, 13, 1, [
      '.....h',
      '....hh',
      '...hh.',
      '...hhh',
      '..hyhh',
      '..hhhh',
      '.hhhhh',
      '.hhhyh',
      'hhhhhh',
      'hyhhhh',
      'hhhhhh',
      'bbbbbb',
    ], { h: '#8E5BD8', y: '#F5C542', b: '#5B3A94' })
    // crystal ball (glows) on a stand in the right claw
    stampRows(s.set, 25, 1, [
      '.ggg.',
      'gwggg',
      'ggggg',
      'ggggg',
      '.ggg.',
      'bbbbb',
    ], { g: '#B9A6F2', w: '#FFFFFF', b: '#5B3A94' }, { g: 'orb', w: 'orb' })
    return s
  },

  // ---- the rest of the set ----

  designer: () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    // red beret: a flat wide disc tilted to one side, tiny stalk, narrow band
    stampRows(s.set, 12, 7, [
      '.....s..',
      '...rrrr.',
      '.rhhrrrr',
      'rrrrrrrr',
      'rrrrrrd.',
      '..dddd..',
    ], { r: '#D9475B', h: '#F08A98', d: '#A62F41', s: '#A62F41' })
    // palette on the left claw
    stampRows(s.set, 1, 5, [
      '.ppppp.',
      'prppbpp',
      'ppppppp',
      'pp.pypp',
      '.ppppp.',
    ], { p: '#E9D3A8', r: '#D9475B', b: '#2F8FD8', y: YELLOW })
    // brush in the right claw (dabs)
    stampRows(s.set, 26, 1, [
      'b.',
      'bb',
      'bb',
      'ss',
      'ww',
      'ww',
      'w.',
      'w.',
      'w.',
    ], { b: '#2F8FD8', s: '#C9CCD2', w: '#9A6233' }, 'it')
    return s
  },

  'developer-backend': () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    // smith's bandana with an orange stripe
    stampRows(s.set, 13, 8, [
      '.gggg.',
      'gGgggg',
      'oooooo',
      'gggggg',
      'gggggg',
    ], { g: '#5A5B63', G: '#7C7D87', o: '#E8702A' })
    // welding goggles: pale blue lenses in place of the eye black, strap to the bandana
    for (const ex of EYES) {
      for (let y = 7; y <= 10; y++) for (let x = ex; x < ex + 3; x++) s.set(x, y, y === 10 ? '#6FA8D6' : '#A9D6F5')
      s.set(ex, 8, '#FFFFFF'); s.set(ex + 1, 8, INK); s.set(ex + 1, 9, INK)
    }
    for (const x of [8, 12, 19, 23]) { s.set(x, 8, '#5A5B63'); s.set(x, 9, '#5A5B63') }
    // torch with a blocky flame (flickers)
    stampRows(s.set, 24, 1, [
      '..y..',
      '.yoy.',
      'yoroy',
      'yoroy',
      '.www.',
    ], { y: YELLOW, o: '#E8702A', r: '#C8323C', w: '#9A6233' }, { y: 'flame', o: 'flame', r: 'flame' })
    for (let y = 6; y <= 9; y++) s.set(26, y, WOOD)
    return s
  },

  'developer-frontend': () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    // blue cap with a long visor
    stampRows(s.set, 12, 6, [
      '...dd...',
      '..bbbb..',
      '.bhbbbb.',
      '.bbbbbb.',
      '.bbbbbb.',
      '.dddddd.',
      'vvvvvvvv',
    ], { b: '#2F8FD8', h: '#7CC0F2', d: '#1D5F99', v: '#1D5F99' })
    // claw hammer (swings)
    stampRows(s.set, 24, 1, [
      '..HHHh',
      'hhhhhh',
      'h..hhh',
    ], { h: STEEL, H: '#C3C7CE' }, 'it')
    for (let y = 3; y <= 9; y++) s.set(26, y, WOOD, 'it')
    return s
  },

  'reviewer-code': () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    judge(s)
    return s
  },

  'reviewer-ux': () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    // pith helmet with a teal band
    stampRows(s.set, 12, 6, [
      '...kk...',
      '..pppp..',
      '.pPpppp.',
      '.pppppp.',
      '.pppppp.',
      '.tttttt.',
      'kkkkkkkk',
    ], { p: '#C9B27C', P: '#E6D6AC', k: '#A08A55', t: '#2BA39A' })
    // brass compass with a teal and red needle (the needle hunts)
    stampRows(s.set, 24, 1, [
      '.rrrr.',
      'rccctr',
      'rcctcr',
      'rcdccr',
      'rdcccr',
      '.rrrr.',
    ], { r: BRASS, c: WHITE, t: '#2BA39A', d: '#C8323C' }, { t: 'ndl', d: 'ndl' })
    return s
  },

  'reviewer-security': () => {
    const s = grid(); crabBase(s)
    // silver helm with a blue plume
    stampRows(s.set, 13, 2, [
      '...pp.',
      '..ppPp',
      '..pppp',
      '..pp..',
      '..ss..',
      '.ssss.',
      'sSSsss',
      'ssssss',
      'skkkks',
      'ssddss',
      'dddddd',
    ], { p: '#3D5A99', P: '#6F8ACB', s: SILVER, S: '#E3E5EA', d: STEEL, k: '#3D5A99' })
    // heater shield on the left claw (the white device glints)
    stampRows(s.set, 1, 5, [
      'sssssss',
      'sbbbbbs',
      'sbbwbbs',
      'sbwbwbs',
      'swbbbws',
      'sbbbbbs',
      '.sbbbs.',
      '..sbs..',
      '...s...',
    ], { s: SILVER, b: '#3D5A99', w: WHITE }, { w: 'gl' })
    return s
  },

  'testing-qa': () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    // white lab cap with a green cross; eyes left plain
    stampRows(s.set, 13, 6, [
      '.wwww.',
      'wwwwww',
      'wwGGww',
      'wGGGGw',
      'wwGGww',
      'wwwwww',
      'gggggg',
    ], { w: WHITE, G: '#3FAE5A', g: '#C9CCD2' })
    // Erlenmeyer flask, green liquid, two bubbles that rise (b1, b2)
    stampRows(s.set, 24, 1, [
      '..ccc..',
      '...c...',
      '..coc..',
      '.cLLLc.',
      'cLLoLLc',
      'cLLLLLc',
    ], { c: '#CFE3F3', L: '#3FAE5A', o: '#9BE0AA' }, { o: 'b1' })
    s.set(27, 5, '#9BE0AA', 'b2')
    return s
  },

  'testing-pentester': () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    // hood: a pointed cowl between the eye stalks, draped over the top of the shell
    const H = '#555869', HH = '#7A7D92', SH = '#34353F'
    for (let x = 12; x <= 19; x++) s.set(x, 14, H)
    for (let x = 9; x <= 22; x++) s.set(x, 15, H)
    for (let x = 8; x <= 23; x++) if (x % 3 === 0) s.set(x, 16, H)
    stampRows(s.set, 12, 4, [
      '...hh...',
      '..hHhh..',
      '..hHhh..',
      '.hHhhhh.',
      '.hhhhhh.',
      '.hkkkkh.',
      '.hkkkkh.',
      'hhkkkkhh',
      'hhhkkhhh',
      'hhhhhhhh',
    ], { h: H, H: HH, k: SH })
    s.set(15, 14, '#E5B820'); s.set(16, 14, '#E5B820')
    // lightning bolt above the right claw (crackles)
    stampRows(s.set, 24, 1, [
      '...yyy',
      '..ypy.',
      '.ypy..',
      'yyppyy',
      '..ypy.',
      '..yy..',
      '..y...',
    ], { y: '#E5B820', p: '#FFF1A8' }, 'zap')
    return s
  },

  'testing-red-team': () => {
    const s = grid(); crabBase(s)
    // ninja wrap with a crimson headband, a skull on the front and two tails
    const W = '#474A5C', WH = '#6A6D84', R = '#C8323C'
    for (let x = 12; x <= 19; x++) s.set(x, 14, W)
    for (let x = 9; x <= 22; x++) s.set(x, 15, W)
    stampRows(s.set, 13, 6, [
      '.nnnn.',
      'nNnnnn',
      'rwwwwr',
      'rkwwkr',
      'rrwwrr',
      'nnnnnn',
      'nnnnnn',
      'nnnnnn',
    ], { n: W, N: WH, r: R, w: WHITE, k: INK })
    // tails fluttering up to the right
    for (const [x, y] of [[19, 5], [20, 4], [21, 3], [22, 3], [23, 4], [20, 5], [21, 5], [22, 5], [23, 6], [24, 6]]) s.set(x, y, R, 'tail')
    return s
  },

  'writer-technical': () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    // round reading glasses: two separate thin brown rings, no bridge
    eyeFrame(s, '#A0703F', { corners: false })
    // scroll on the left claw
    stampRows(s.set, 1, 3, [
      'dddddd',
      '.pppp.',
      '.pkkp.',
      '.pppp.',
      '.pkkp.',
      '.pppp.',
      'dddddd',
    ], { p: '#E9D3A8', d: '#C9B27C', k: INK })
    // quill in the right claw (scribbles)
    stampRows(s.set, 24, 1, [
      '....wwg',
      '...wwgw',
      '..wwgww',
      '.wwgww.',
      '.wgww..',
      '..gw...',
      '..b....',
      '..b....',
      '..b....',
    ], { w: WHITE, g: '#B4B1A6', b: '#A0703F' }, 'it')
    return s
  },

  'release-manager': () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    // herald's cap with a golden feather sweeping back
    stampRows(s.set, 13, 8, [
      '.bbbb.',
      'bBbbbb',
      'bbbbbb',
      'bbbbbb',
      'gggggg',
    ], { b: '#2A5A85', B: '#5C8DB8', g: GOLD })
    stampRows(s.set, 9, 2, [
      '.ff...',
      'fFff..',
      '.ffFf.',
      '...fFf',
      '....ff',
      '.....f',
    ], { f: GOLD, F: '#F2CF5B' })
    // post horn with a pennant (toots)
    stampRows(s.set, 22, 2, [
      '.......hh',
      '......hhH',
      'mhhhhhhhH',
      '.pp...hdd',
      '.pp....dd',
      '.p.......',
    ], { h: GOLD, H: '#F2CF5B', d: '#A57C0F', m: '#A57C0F', p: '#2A5A85' }, 'horn')
    return s
  },

  loki: () => {
    const s = grid(); crabBase(s)
    const G = '#3C9D4E', O = GOLD
    // half mask: gold over the left eye, green over the right
    eyeFrame(s, G, { bottom: false, colorRight: O })
    // three-pointed jester's cap, green and gold, a bell on each point (the bells jingle)
    stampRows(s.set, 9, 1, [
      'YY..........YY',
      'YYo........gYY',
      '..oo..YY..gg..',
      '..ooo.og.ggg..',
      '...ooooggggg..',
    ], { g: G, o: O, Y: YELLOW }, { Y: 'bell' })
    stampRows(s.set, 8, 6, [
      '.....oooggg.....',
      '.....oooggg.....',
      '.....oooggg.....',
      '.....oooggg.....',
      '.....oooggg.....',
      '.....OOOGGG.....',
    ], { g: G, o: O, Y: YELLOW, G: '#2A7338', O: '#A57C0F' })
    return s
  },

  explore: () => {
    const s = grid(); crabBase(s)
    // brass spyglass resting on the left claw, held up to the left eye: three sections, lens at the far end (sweeps)
    stampRows(s.set, 1, 6, [
      'LHg.....',
      'LHgHHg..',
      'Lhghhgdd',
      'Lhghhgdd',
    ], { h: BRASS, H: '#D9BD85', d: '#8A6A3A', g: '#7A7A7A', L: '#A9D6F5' }, 'it')
    return s
  },

  // The crew mod's plugin icon: the switchboard operator. It is drawn here but not emitted: the icon is a PNG.
  'crew-plugin': () => {
    const s = grid(); crabBase(s, { rightClawUp: true })
    const B = '#9A9CA8', A = '#EBA82F'
    // headset: band arching over the shell top between the eye stalks, an amber ear cup beside each stalk
    stampRows(s.set, 12, 6, [
      '..gggg..',
      '.gGGGgg.',
      'gg.CC.gg',
      'aa.Cc.aa',
      'aA.cc.aa',
      'aa.cc.aa',
      'aa.cc.aa',
      '...cc...',
    ], { g: B, G: '#C9CBD4', a: A, A: '#F7D07A', C: CLAY_HI, c: CLAY })
    // mic boom curving to the front of the shell
    for (const [x, y] of [[13, 13], [13, 14], [14, 15], [15, 16], [16, 16]]) s.set(x, y, B)
    s.set(17, 16, '#3A3B44'); s.set(18, 16, '#3A3B44'); s.set(17, 17, '#3A3B44'); s.set(18, 17, '#3A3B44')
    // patch cord: silver tip, amber plug, off-white cord through the claw and trailing down
    stampRows(s.set, 25, 1, [
      '.s.',
      '.s.',
      'aAa',
      'aAa',
      'aaa',
      '.d.',
      '.c.',
      '.c.',
      '.c.',
    ], { s: SILVER, a: A, A: '#F7D07A', d: '#B9801C', c: WHITE })
    for (const [x, y] of [[29, 13], [29, 14], [29, 15], [29, 16], [29, 17], [29, 18], [29, 19], [28, 19], [27, 19], [26, 19]]) s.set(x, y, WHITE)
    return s
  },
}

// ---- emit crew/hooks/sprites.ts

// The generated key for the plain crab is `other`: the roster's fallback slug.
const KEY = { plain: 'other' }
const SKIP = new Set(['crew-plugin'])

const palette = []
const colorIndex = (c) => {
  const u = c.toUpperCase()
  let i = palette.indexOf(u)
  if (i < 0) { i = palette.length; palette.push(u) }
  return i
}

const blocks = []
for (const [name, make] of Object.entries(sprites)) {
  if (SKIP.has(name)) continue
  const s = make(); outline(s); center(s)
  // runs of equal colour and group along a row: [x, y, width, palette index]
  const byGroup = new Map([['bd', []]])
  for (let y = 0; y < N; y++) {
    let x = 0
    while (x < N) {
      const c = s.g[y][x]
      if (!c) { x++; continue }
      const k = s.gr[y][x]
      let w = 1
      while (x + w < N && s.g[y][x + w] === c && s.gr[y][x + w] === k) w++
      if (!byGroup.has(k)) byGroup.set(k, [])
      byGroup.get(k).push([x, y, w, colorIndex(c)])
      x += w
    }
  }
  const order = [...byGroup.keys()].sort((a, b) => rank(a) - rank(b))
  const lines = order.map((k) => `    ${k}: [${byGroup.get(k).map((r) => `[${r.join(',')}]`).join(',')}],`)
  blocks.push(`  '${KEY[name] ?? name}': {\n${lines.join('\n')}\n  },`)
}
function rank(k) { return k === 'bd' ? 0 : k === 'la' ? 2 : k === 'lb' ? 3 : 1 }

const ts = `// Generated by crew/tools/sprites.mjs. Do not edit by hand.
//
// Each crab is a 32x32 grid of cells: per motion group (bd body, la and lb the two leg pairs, any other
// name a prop with a motion of its own) a list of horizontal runs [x, y, width, palette index].

export type Run = [x: number, y: number, width: number, color: number]

export const PALETTE: string[] = [${palette.map((c) => `'${c}'`).join(', ')}]

export const SPRITES: Record<string, Record<string, Run[]>> = {
${blocks.join('\n')}
}
`
fs.writeFileSync(OUT, ts)
console.log('wrote', OUT, Object.keys(sprites).filter((n) => !SKIP.has(n)).length, 'crabs,', palette.length, 'colors')
