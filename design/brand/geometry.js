// ancora mark geometry on a 64-unit grid. All paths are plain SVG path data.
const f = n => +n.toFixed(2);
const polar = (cx, cy, r, a) => [f(cx + r * Math.cos(a)), f(cy + r * Math.sin(a))];

// Shield: x 12..52, top y=14, straight sides to y=34, then a circular arc (r=20, centre 32,34) to the point (32,54).
export const shield = 'M12 14H52V34A20 20 0 0 1 32 54A20 20 0 0 1 12 34Z';

// Four-point star with concave sides, centred (cx,cy), outer radius R, inner radius r.
export function star(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    pts.push(polar(cx, cy, i % 2 ? r : R, a));
  }
  return 'M' + pts.map(p => p.join(' ')).join('L') + 'Z';
}

// Anchor: shank (width w, from y0 to the bowl), arms swept as an annular arc of a circle centred (32,cy)
// with outer radius Ro and inner radius Ro-w, from angle a0 to a1 (radians, measured from +x axis, y down).
// Ends are cut square.
export function anchor({ w = 4, top = 27, cy = 40, Ro = 12, a0 = 0.14, a1 = Math.PI - 0.14 } = {}) {
  const Ri = Ro - w;
  const cx = 32;
  const [ox0, oy0] = polar(cx, cy, Ro, a0);
  const [ox1, oy1] = polar(cx, cy, Ro, a1);
  const [ix0, iy0] = polar(cx, cy, Ri, a0);
  const [ix1, iy1] = polar(cx, cy, Ri, a1);
  // shank bottom meets inner arc at y = cy + Ri
  const sb = f(cy + Ri);
  const hw = w / 2;
  const shank = `M${f(cx - hw)} ${top}H${f(cx + hw)}V${sb}H${f(cx - hw)}Z`;
  const bowl = `M${ox0} ${oy0}A${Ro} ${Ro} 0 0 1 ${ox1} ${oy1}L${ix1} ${iy1}A${Ri} ${Ri} 0 0 0 ${ix0} ${iy0}Z`;
  return shank + bowl;
}

export const master = {
  shield,
  anchor: anchor({ w: 5, top: 26, cy: 36, Ro: 12.5, a0: -0.08, a1: Math.PI + 0.08 }),
  star: star(32, 14, 9.5, 3.4),
  anchorS: anchor({ w: 7, top: 27, cy: 36, Ro: 13.5, a0: -0.05, a1: Math.PI + 0.05 }),
  starS: star(32, 14, 11, 4),
  anchorXS: anchor({ w: 9, top: 28, cy: 36, Ro: 14, a0: 0, a1: Math.PI }),
  starXS: star(32, 14, 13, 5)
};
