// The crew's crabs: one pixel crab per role, each in its own costume, drawn as SVG.
//
// The crab body, the group-per-motion layout and the walk are adapted from
// savvy-progress by johnnyvizz (MIT), whose crab is Pixel Clawd from DockCrab;
// see crew/NOTICE. The fourteen roster costumes are Switchboard's own.
//
// A crab is 30x28 grid cells. `Fill` puts a cell in a named group: `bd` (the default)
// is the body and its costume, `la`/`lb` the two leg pairs, anything else a prop with a
// motion of its own. Props nest inside `bd`, so they ride the walk's bob as well.

const CLAY = '#D97757'
const INK = '#1F1E1D'
const WHITE = '#F4F3EE'

type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string): void =>
  rows.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      const c = map[ch]
      if (c !== undefined) f(x + dx, y + dy, 1, 1, c, cls)
    }),
  )

// `armFront` raises the right claw; `armCls` lets the raised claw travel with its prop.
const crabBody = (f: Fill, armFront = 0, armCls?: string): void => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, 14 + armFront, 4, 4, CLAY, armCls)
  f(9, 12, 2, 2, INK)
  f(19, 12, 2, 2, INK)
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

export const COSTUMES: Record<string, (f: Fill, t: string) => void> = {
  // 🏛️ Architect: a temple pediment for a hat; the blueprint unrolls.
  architect: (f, t) => {
    crabBody(f, -4)
    stamp(f, 6, 4, ['........pp........', '......pppppp......', '....pppppppppp....', '..pppppppppppppp..', 'tttttttttttttttttt', 'c..c..c..c..c..c.c'], { p: '#EDEBE4', t, c: '#D6D3C9' })
    stamp(f, 23, 3, ['kkkkk', 'bwbwb', 'bbbbb', 'bwbbb', 'bbwbb', 'kkkkk'], { k: '#2A5A85', b: t, w: '#CFE3F3' }, 'it')
  },
  // 🔮 Business Analyst: a starry wizard's hat; the crystal ball glows.
  'business-analyst': (f, t) => {
    crabBody(f, -4)
    stamp(f, 6, 1, ['..........hh......', '.........hhh......', '........hhhhh.....', '.......hhshhhh....', '......hhhhhhhhh...', '.....hhhhhhhshhh..', '....hhhhhhhhhhhhh.', '..hhhhshhhhhhhhhh.', 'bbbbbbbbbbbbbbbbbb'], { h: t, s: '#F5C542', b: '#5B3A94' })
    stamp(f, 23, 4, ['.ggg.', 'gwggg', 'ggggg', '.ggg.'], { g: '#B9A6F2', w: '#FFFFFF' }, 'orb')
    stamp(f, 23, 8, ['bbbbb', '.bbb.'], { b: '#5B3A94' })
  },
  // 🎨 Designer: a red beret, a palette in one claw; the brush dabs.
  designer: (f, t) => {
    crabBody(f, -4)
    stamp(f, 6, 6, ['...........r......', '....rrrrrrrrrrr...', '..rrrrrrrrrrrrrrr.', '.rrrrrrrrrrrrrrrr.'], { r: t })
    stamp(f, 0, 18, ['.pppp.', 'prpbpp', 'ppypp.', '.ppp..'], { p: '#E9D3A8', r: t, b: '#2F8FD8', y: '#F5C542' })
    f(25, 4, 1, 6, '#7A4A26', 'it')
    f(25, 3, 1, 1, '#C9CCD2', 'it')
    f(24, 1, 3, 2, t, 'it')
  },
  // 🔥 Backend Developer: a smith's bandana and goggles; the forge torch flickers.
  'developer-backend': (f, t) => {
    crabBody(f, -4)
    f(7, 8, 16, 2, t)
    f(5, 8, 2, 1, t)
    f(4, 9, 2, 1, t)
    f(9, 8, 3, 2, '#3A3A3C')
    f(18, 8, 3, 2, '#3A3A3C')
    f(10, 8, 1, 1, '#A9D6F5')
    f(19, 8, 1, 1, '#A9D6F5')
    f(25, 5, 1, 5, '#7A4A26')
    stamp(f, 23, 0, ['..y..', '.yoy.', 'yoroy', '.ooo.', '..o..'], { y: '#F5C542', o: t, r: '#C8323C' }, 'flame')
  },
  // 🔨 Frontend Developer: a cap with a long visor; the hammer swings.
  'developer-frontend': (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 7, 6, ['...cccccccccc...', '..cccccccccccc..', '.cccccccccccccc.'], { c: t })
    f(7, 9, 19, 1, '#1D5F99')
    stamp(f, 23, 1, ['hhhhh', 'hhhhh'], { h: '#8E929A' }, 'it')
    f(25, 3, 1, 7, '#7A4A26', 'it')
  },
  // ⚖️ Code Reviewer: a judge's curled wig; the gavel bangs.
  'reviewer-code': (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 5, 4, ['....wwwwwwwwww....', '..wwgwwgwwgwwgww..', '.wwwwwwwwwwwwwwww.', 'wwgwwgwwgwwgwwgwww', 'ww..............ww', 'gw..............wg', 'ww..............ww', 'gw..............wg', 'ww..............ww', '.w..............w.'], { w: '#E4E1D8', g: '#A8A49A' })
    stamp(f, 23, 3, ['bbbbb', 'btttb'], { b: '#6B4423', t }, 'it')
    f(25, 5, 1, 5, '#A0703F', 'it')
  },
  // 🧭 UX Reviewer: an explorer's pith helmet; the compass needle hunts.
  'reviewer-ux': (f, t) => {
    crabBody(f, -4)
    stamp(f, 6, 4, ['.....kkkkkkkk.....', '...kkkkkkkkkkkk...', '..kkkkkkkkkkkkkk..', '..kkkkkkkkkkkkkk..', '.tttttttttttttttt.', 'kkkkkkkkkkkkkkkkkk'], { k: '#D8C7A0', t })
    stamp(f, 23, 4, ['.ggg.', 'gwwwg', 'gwwwg', 'gwwwg', '.ggg.'], { g: '#B08D57', w: WHITE })
    f(25, 5, 1, 2, '#C8323C', 'ndl')
    f(25, 7, 1, 1, '#3A3A3C', 'ndl')
  },
  // 🛡️ Security Reviewer: a plumed knight's helm and a shield; the shield glints.
  'reviewer-security': (f, t) => {
    crabBody(f)
    stamp(f, 6, 3, ['........pp........', '.......pppp.......', '....ssssssssss....', '...ssssssssssss...', '..ssssssssssssss..', '..sddddddddddddds.', '.ssssssssssssssss.'], { p: t, s: '#B8BCC4', d: '#6E737C' })
    stamp(f, 0, 12, ['ttttt', 'ttwtt', 'twwwt', 'ttwtt', '.ttt.', '..t..'], { t, w: WHITE })
    f(1, 12, 1, 1, '#FFFFFF', 'gl')
  },
  // 🧪 QA Engineer: lab goggles pushed up; the flask bubbles.
  'testing-qa': (f, t) => {
    crabBody(f, -4)
    f(7, 9, 16, 1, '#3A3A3C')
    f(8, 7, 4, 3, '#3A3A3C')
    f(18, 7, 4, 3, '#3A3A3C')
    f(9, 8, 2, 1, '#A9D6F5')
    f(19, 8, 2, 1, '#A9D6F5')
    stamp(f, 23, 4, ['.kk.', '.kk.', 'wggw', 'gggg', 'gggg', '.gg.'], { k: '#C9CCD2', w: '#E6E8EE', g: t })
    f(24, 2, 1, 1, '#B6E3C3', 'b1')
    f(25, 0, 1, 1, '#B6E3C3', 'b2')
  },
  // ⚡ Infra Pentester: a dark hood; the lightning crackles.
  'testing-pentester': (f, t) => {
    crabBody(f, -4)
    stamp(f, 5, 4, ['....hhhhhhhhhh....', '..hhhhhhhhhhhhhh..', '.hhhhhhhhhhhhhhhh.', 'hhhhhhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhhhh', 'hhh............hhh', 'hhh............hhh', 'hhh............hhh', 'hh..............hh', '.h..............h.'], { h: '#3A3A3C' })
    stamp(f, 24, 0, ['..yy', '.yy.', 'yyyy', '..y.', '.y..', 'y...'], { y: t }, 'zap')
  },
  // 💀 Red Team Lead: a ninja's wrap and a skull on the headband; its tails flutter.
  'testing-red-team': (f, t) => {
    crabBody(f)
    stamp(f, 7, 6, ['....kkkkkkkk....', '..kkkkkkkkkkkk..', '.kkkkkkkkkkkkkk.', 'rrrrrrrswrrrrrrr'], { k: '#2B2A28', r: t, s: WHITE, w: WHITE })
    f(7, 10, 16, 2, '#2B2A28')
    f(7, 14, 16, 2, '#2B2A28')
    stamp(f, 2, 9, ['rrrr', '.rr.'], { r: t }, 'tail')
  },
  // 📜 Technical Writer: reading glasses, a scroll in one claw; the quill scribbles.
  'writer-technical': (f, t) => {
    crabBody(f, -4)
    const k = '#55514C'
    for (const x of [8, 18]) {
      f(x, 11, 4, 1, k)
      f(x, 14, 4, 1, k)
      f(x, 12, 1, 2, k)
      f(x + 3, 12, 1, 2, k)
    }
    f(12, 12, 6, 1, k)
    stamp(f, 0, 16, ['pppppp', 'pkkkkp', 'pppppp', 'pkkkp.', 'pppppp'], { p: '#EBD9B4', k: t })
    stamp(f, 23, 1, ['...w', '..ww', '.wwg', '.wg.', 'wg..', 'g...'], { w: '#E4E1D8', g: '#8E8A80' }, 'it')
    f(23, 7, 1, 3, '#3A3A3C', 'it')
  },
  // 📯 Release Manager: a herald's feathered cap; the post horn toots.
  'release-manager': (f, t) => {
    crabBody(f, -4)
    stamp(f, 7, 6, ['..cccccccccc....', '.cccccccccccc...', 'cccccccccccccc..', 'dddddddddddddddd'], { c: '#2E6B45', d: t })
    stamp(f, 3, 2, ['f...', '.ff.', '..ff', '...f'], { f: '#C8323C' })
    stamp(f, 22, 4, ['......gg', 'gggggggg', 'g....ggg', 'gggggggg', '......gg'], { g: t }, 'horn')
    f(28, 0, 1, 3, INK, 'note')
    f(29, 0, 1, 1, INK, 'note')
  },
  // 🎭 Loki: a two-pronged jester's cap and a half mask; the bells jingle.
  loki: (f, t) => {
    crabBody(f)
    stamp(f, 5, 2, ['gg................pp', '.gg..............pp.', '..ggg..........ppp..', '...gggg......pppp...', '....ggggg..ppppp....', '.....gggggppppp.....', '..dddddddddddddddd..'], { g: t, p: '#7B4FB0', d: '#D4A017' })
    f(5, 1, 1, 1, '#F5C542', 'bell')
    f(24, 1, 1, 1, '#F5C542', 'bell')
    f(8, 11, 14, 1, WHITE)
    f(7, 12, 1, 1, WHITE)
    f(22, 12, 1, 1, WHITE)
  },
  // 🔭 Explore, Claude Code's own scout: a brass spyglass that sweeps.
  explore: f => {
    crabBody(f, -4)
    stamp(f, 21, 7, ['bbbbbbbbb', 'bkkkkkkkb', 'bbbbbbbbb'], { b: '#B08D57', k: '#8A6A3A' }, 'it')
    f(29, 7, 1, 3, '#CFE3F3', 'it')
  },
  other: f => crabBody(f),
}

// Pure CSS, run by the compositor: no redraws. Periods divide one second, so the
// once-a-second redraw of a running row restarts them in phase. Every crab walks;
// each costume adds its prop's motion on top. prefers-reduced-motion stops them all.
export const CRAB_CSS = `<style>
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
@keyframes blink{50%{opacity:.15}}
.c-architect.run .it{transform-origin:50% 0;animation:unroll 1s ease-in-out infinite}
@keyframes unroll{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
.c-business-analyst.run .orb{animation:glow 1s ease-in-out infinite}
@keyframes glow{50%{opacity:.4}}
.c-designer.run .it{transform-origin:50% 100%;animation:dab .5s ease-in-out infinite}
@keyframes dab{50%{transform:rotate(-20deg)}}
.c-developer-backend.run .flame{transform-origin:50% 100%;animation:flick .25s steps(1) infinite}
@keyframes flick{50%{transform:scaleX(.8) translateY(-1px)}}
.c-developer-frontend.run .it{transform-origin:50% 100%;animation:swing .5s ease-in infinite}
@keyframes swing{40%{transform:rotate(-35deg)}}
.c-reviewer-code.run .it{transform-origin:50% 100%;animation:bang 1s steps(1) infinite}
@keyframes bang{0%{transform:rotate(-30deg)}50%{transform:rotate(12deg)}}
.c-reviewer-ux.run .ndl{transform-origin:50% 66%;animation:hunt 1s ease-in-out infinite}
@keyframes hunt{25%{transform:rotate(35deg)}75%{transform:rotate(-35deg)}}
.c-reviewer-security.run .gl{animation:blink 1s steps(1) infinite}
.c-testing-qa.run .b1{animation:rise .5s ease-out infinite}.c-testing-qa.run .b2{animation:rise .5s ease-out infinite -.25s}
@keyframes rise{0%{transform:translateY(1px);opacity:1}100%{transform:translateY(-2px);opacity:0}}
.c-testing-pentester.run .zap{animation:blink .5s steps(1) infinite}
.c-testing-red-team.run .tail{transform-origin:100% 50%;animation:flutter .25s steps(1) infinite}
@keyframes flutter{50%{transform:skewY(-15deg) scaleX(.8)}}
.c-writer-technical.run .it{animation:scribble .5s steps(1) infinite}
@keyframes scribble{25%{transform:translate(-1px,1px)}75%{transform:translate(1px,1px)}}
.c-release-manager.run .horn{transform-origin:0 50%;animation:toot 1s ease-in-out infinite}
.c-release-manager.run .note{animation:blink .5s steps(1) infinite}
@keyframes toot{50%{transform:scale(1.12)}}
.c-loki.run .bell{animation:jingle .5s steps(1) infinite}
@keyframes jingle{50%{transform:translateY(1px)}}
.c-explore.run .it{animation:sweep 1s steps(1) infinite}
@keyframes sweep{50%{transform:translate(-1px,-1px)}}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

/** One crab as an SVG group at (x, y): `dim` for a planned task, `isWalking` while its agent runs. */
export const crab = (x: number, y: number, costume: string, color: string, dim = false, isWalking = false, scale = 1.1): string => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (cx, cy, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  const draw = COSTUMES[costume] ?? COSTUMES.other
  draw?.(f, color)
  const group = (cls: string) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  return `<g transform="translate(${x},${y}) scale(${scale})" opacity="${dim ? 0.45 : 1}" shape-rendering="crispEdges"><g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g></g>`
}
