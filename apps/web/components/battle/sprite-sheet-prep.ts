/**
 * Turning a picture of six soldiers into a sheet the renderer can march.
 *
 * The sheets are generated, not authored. An image model asked for "6 frames,
 * horizontal strip" returns six characters on a white canvas at whatever size
 * and spacing it felt like — not six registered cells. The four shipped sheets
 * came back 1376x768: the old frame count, inferred as `round(width / height)`,
 * read that as **two** frames, so a marching soldier flipped between the left
 * half and the right half of the picture — three cats at a time, twice a
 * second.
 *
 * Rather than hand-cut the four files, this measures the image and rebuilds it:
 * find the figures, cut on the gaps between them, and re-lay them into square
 * cells. That keeps the pipeline honest for the next sheet an admin uploads,
 * which will have its own arbitrary padding.
 *
 * Runs once per sheet and is cached by the caller.
 */

/** Frames are cut on vertical runs of background; ignore specks below this. */
const MIN_RUN_WIDTH = 12;
/** A column with fewer inked pixels than this is background. */
const MIN_COLUMN_INK = 3;
/** Below this darkness a pixel counts as background rather than artwork. */
const WHITE_FLOOR = 235;
/**
 * A walk cycle is four to eight poses. Anything outside that is not a strip
 * this renderer can march, and the failures are not theoretical: of the four
 * generated sheets, one arrived as a 2x4-and-3 grid, one as a 3x2 grid, and one
 * as a captioned contact sheet with cell borders drawn in. Counting figures
 * gives 3, 3 and 1 — so they are refused here and the caller draws its shape
 * instead. Rendering them anyway is what put three soldiers inside one frame.
 */
const MIN_FRAMES = 4;
const MAX_FRAMES = 8;
/** Fully transparent at or above this; the ramp below it softens JPEG ringing. */
const KEY_HIGH = 245;
const KEY_LOW = 225;

export interface PreparedSheet {
  canvas: HTMLCanvasElement;
  frames: number;
  /** Width and height of one cell in the prepared strip. */
  cell: number;
}

/**
 * Does this artwork sit on a solid light background?
 *
 * Only then is keying the right thing to do. Running it unconditionally eats
 * the white parts of art that already ships with transparency — a helmet
 * highlight, the whites of an eye — so the corners decide.
 */
function hasOpaqueLightBackground(data: Uint8ClampedArray, w: number, h: number) {
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  return corners.every((i) => {
    const light = data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230;
    return light && data[i + 3] > 250;
  });
}

export function prepareSheet(
  source: CanvasImageSource & { width: number; height: number },
  cell: number,
): PreparedSheet | null {
  const w = source.width;
  const h = source.height;
  if (!w || !h) return null;

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  if (!wctx) return null;
  wctx.drawImage(source, 0, 0);

  let image: ImageData;
  try {
    image = wctx.getImageData(0, 0, w, h);
  } catch {
    // Tainted by a cross-origin upload. Nothing can be measured, so hand the
    // sheet back untouched and let the caller fall back to the drawn shape.
    return null;
  }
  const px = image.data;

  const keyed = hasOpaqueLightBackground(px, w, h);
  if (keyed) {
    for (let i = 0; i < px.length; i += 4) {
      const min = Math.min(px[i], px[i + 1], px[i + 2]);
      px[i + 3] =
        min >= KEY_HIGH ? 0 : min <= KEY_LOW ? 255 : Math.round(((KEY_HIGH - min) / (KEY_HIGH - KEY_LOW)) * 255);
    }
    wctx.putImageData(image, 0, 0);
  }

  // Where the figures actually are. Cutting on gaps rather than on equal
  // divisions is what stops a frame from carrying a slice of its neighbour's
  // sword — the generated sheets are not evenly spaced.
  const inked = (x: number) => {
    let n = 0;
    for (let y = 0; y < h; y += 1) {
      const i = (y * w + x) * 4;
      const on = keyed ? px[i + 3] > 24 : px[i + 3] > 24 && Math.min(px[i], px[i + 1], px[i + 2]) < WHITE_FLOOR;
      if (on && (n += 1) >= MIN_COLUMN_INK) return true;
    }
    return false;
  };

  const runs: Array<{ x0: number; x1: number }> = [];
  let start = -1;
  for (let x = 0; x < w; x += 1) {
    const on = inked(x);
    if (on && start < 0) start = x;
    if ((!on || x === w - 1) && start >= 0) {
      const end = on ? x : x - 1;
      if (end - start + 1 >= MIN_RUN_WIDTH) runs.push({ x0: start, x1: end });
      start = -1;
    }
  }
  if (runs.length < MIN_FRAMES || runs.length > MAX_FRAMES) return null;

  // Vertical extent per frame, and the union, which fixes the ground line.
  const boxes = runs.map(({ x0, x1 }) => {
    let top = h;
    let bottom = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const i = (y * w + x) * 4;
        const on = keyed ? px[i + 3] > 24 : Math.min(px[i], px[i + 1], px[i + 2]) < WHITE_FLOOR;
        if (on) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          break;
        }
      }
    }
    return { x0, y0: top, w: x1 - x0 + 1, h: Math.max(1, bottom - top + 1) };
  });

  const maxW = Math.max(...boxes.map((b) => b.w));
  const unionTop = Math.min(...boxes.map((b) => b.y0));
  const unionBottom = Math.max(...boxes.map((b) => b.y0 + b.h));
  const unionH = Math.max(1, unionBottom - unionTop);

  // One scale for every frame, or the soldier changes size as it walks. Scaled
  // against the union height so the bob of the cycle is preserved instead of
  // being flattened by per-frame normalisation.
  const scale = Math.min(cell / maxW, cell / unionH) * 0.94;

  const canvas = document.createElement('canvas');
  canvas.width = cell * boxes.length;
  canvas.height = cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';

  boxes.forEach((b, f) => {
    const dw = b.w * scale;
    const dh = b.h * scale;
    // Bottom-aligned against the shared ground line, centred horizontally.
    // Feet stay on the floor; the head is free to rise and fall.
    const dy = cell - (unionBottom - b.y0) * scale - 1;
    ctx.drawImage(work, b.x0, b.y0, b.w, b.h, f * cell + (cell - dw) / 2, dy, dw, dh);
  });

  return { canvas, frames: boxes.length, cell };
}
