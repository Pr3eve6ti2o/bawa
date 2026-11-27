// Address identicon (Lane P2-C, M6): a deterministic Blockie-style
// visual identicon generated from an address, so a wrong address is
// recognisable at a glance, not just by reading hex.
//
// The mined pattern (Lane E M6, from walletconnect-test-wallet's
// AccountDetails): every account/address display pairs the address
// with a deterministic identicon. No Blockie/identicon component
// existed in apps/web/src — this is the first one, and the only
// place an address gets a generated visual. It is NOT a logo: asset
// rows keep their real chain/token logo (the logo IS the asset's
// identity); identicons belong on ADDRESS displays only.
//
// No new dependency: the generator is ~40 lines — FNV-1a hash of the
// address string seeds a mulberry32 PRNG, which picks three flat
// colours (background / foreground / spot, one hue family) and an
// 8x8 grid mirrored left-right, the classic Blockie shape. The same
// address always renders the same picture; a different address
// renders a different one with overwhelming probability. Any address
// format works (0x, base58, bech32, TON) — the input is hashed as
// an opaque string, never parsed.
//
// Style B (polished, flat): flat HSL fills, no gradients, no
// hand-drawn borders. The SVG carries its own light background rect,
// so it reads on any surface — the Receive card's dark teal band,
// a muted address box, or plain paper. Decorative: aria-hidden,
// the adjacent address text carries the information for assistive
// technology.
export interface IdenticonCell {
  x: number;
  y: number;
  /** True when the cell uses the spot colour instead of foreground. */
  spot: boolean;
}

export interface IdenticonSpec {
  background: string;
  foreground: string;
  spot: string;
  cells: IdenticonCell[];
}

/** FNV-1a 32-bit hash of a string — deterministic across runs. */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    // Math.imul keeps the multiply in 32 bits; >>> 0 keeps it unsigned.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** mulberry32: a tiny deterministic PRNG from a 32-bit seed. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The deterministic picture for an address: three colours and the
 * filled cells of the 8x8 mirrored grid. Pure — same input, same
 * output, no randomness, no I/O — so tests pin it exactly.
 */
export function identiconSpec(address: string): IdenticonSpec {
  const rand = mulberry32(fnv1a(address));
  const hue = Math.floor(rand() * 360);
  const background = `hsl(${hue}, 45%, 93%)`;
  const foreground = `hsl(${hue}, 60%, 42%)`;
  const spot = `hsl(${(hue + 150) % 360}, 55%, 55%)`;
  const cells: IdenticonCell[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      if (rand() >= 0.5) continue;
      const isSpot = rand() < 0.25;
      cells.push({ x, y, spot: isSpot });
      // Mirror across the vertical centre: x=0 mirrors to 7, x=3 to 4.
      cells.push({ x: 7 - x, y, spot: isSpot });
    }
  }
  return { background, foreground, spot, cells };
}

export function AddressIdenticon({
  address,
  size = 32,
  className,
}: {
  /** The address the picture is generated from. */
  address: string;
  /** Pixel size of the square (width and height). */
  size?: number;
  className?: string;
}) {
  const spec = identiconSpec(address);
  return (
    <svg
      aria-hidden="true"
      data-testid="address-identicon"
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      className={`shrink-0 ${className ?? ''}`}
    >
      <rect x={0} y={0} width={8} height={8} fill={spec.background} />
      {spec.cells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          width={1}
          height={1}
          fill={cell.spot ? spec.spot : spec.foreground}
        />
      ))}
    </svg>
  );
}
