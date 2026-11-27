// The crew's crabs: one pixel crab per role, each in its own costume, drawn as SVG.
//
// Every crab is Switchboard's own drawing: 32x32 grid cells, hand-built and outlined by
// crew/tools/sprites.mjs, which writes the generated crew/hooks/sprites.ts that this file draws.
// The group-per-motion layout and the walk are adapted from savvy-progress by johnnyvizz (MIT);
// see crew/NOTICE.
//
// `Fill` puts a cell in a named group: `bd` (the default) is the body and its costume,
// `la`/`lb` the two leg pairs, anything else a prop with a motion of its own. Props nest
// inside `bd`, so they ride the walk's bob as well.

import { PALETTE, SPRITES } from './sprites'

type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const drawSprite =
  (slug: string): ((f: Fill) => void) =>
  f => {
    for (const [cls, runs] of Object.entries(SPRITES[slug] ?? {})) {
      for (const [x, y, w, c] of runs) f(x, y, w, 1, PALETTE[c] ?? '#000000', cls)
    }
  }

/** One drawing per slug: the fourteen roster costumes, Explore, and `other`, the plain crab for any agent the roster does not know. */
export const COSTUMES: Record<string, (f: Fill) => void> = Object.fromEntries(Object.keys(SPRITES).map(slug => [slug, drawSprite(slug)]))

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
@keyframes toot{50%{transform:scale(1.12)}}
.c-loki.run .bell{animation:jingle .5s steps(1) infinite}
@keyframes jingle{50%{transform:translateY(1px)}}
.c-explore.run .it{animation:sweep 1s steps(1) infinite}
@keyframes sweep{50%{transform:translate(-1px,-1px)}}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

/**
 * One crab as an SVG group at (x, y), `scale` times its 32 cells: `dim` for a planned task, `isWalking` while its agent runs.
 * The drawings carry their own colours, so a role's colour is no longer used here; it stays in the signature for callers.
 */
export const crab = (x: number, y: number, costume: string, _color: string, dim = false, isWalking = false, scale = 1.1): string => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (cx, cy, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  const draw = COSTUMES[costume] ?? COSTUMES.other
  draw?.(f)
  const group = (cls: string) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  return `<g transform="translate(${x},${y}) scale(${scale})" opacity="${dim ? 0.45 : 1}" shape-rendering="crispEdges"><g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g></g>`
}
