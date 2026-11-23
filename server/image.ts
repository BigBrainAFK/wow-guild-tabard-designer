// BLP2 (BLP texture) decoding and a minimal RGBA image type.

/** hasAlpha is false for BLPs stored without an alpha channel (alphaDepth 0). */
export type Rgba = { width: number; height: number; data: Uint8Array; hasAlpha?: boolean };

function unpack565(c: number): [number, number, number] {
  const r = (c >> 11) & 0x1f;
  const g = (c >> 5) & 0x3f;
  const b = c & 0x1f;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

function decodeDXT(src: Buffer, width: number, height: number, format: 1 | 3 | 5): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  const blockBytes = format === 1 ? 8 : 16;
  const bw = Math.max(1, (width + 3) >> 2);
  const bh = Math.max(1, (height + 3) >> 2);
  let p = 0;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++, p += blockBytes) {
      const alpha = new Uint8Array(16).fill(255);
      let cp = p;
      if (format === 3) {
        for (let i = 0; i < 8; i++) {
          const v = src[p + i];
          alpha[i * 2] = (v & 0x0f) * 17;
          alpha[i * 2 + 1] = (v >> 4) * 17;
        }
        cp = p + 8;
      } else if (format === 5) {
        const a0 = src[p];
        const a1 = src[p + 1];
        const lut = [a0, a1, 0, 0, 0, 0, 0, 0];
        if (a0 > a1) for (let i = 1; i < 7; i++) lut[i + 1] = ((7 - i) * a0 + i * a1) / 7;
        else {
          for (let i = 1; i < 5; i++) lut[i + 1] = ((5 - i) * a0 + i * a1) / 5;
          lut[6] = 0;
          lut[7] = 255;
        }
        let bits = 0n;
        for (let i = 0; i < 6; i++) bits |= BigInt(src[p + 2 + i]) << BigInt(8 * i);
        for (let i = 0; i < 16; i++) alpha[i] = lut[Number((bits >> BigInt(3 * i)) & 7n)] | 0;
        cp = p + 8;
      }
      const c0 = src.readUInt16LE(cp);
      const c1 = src.readUInt16LE(cp + 2);
      const [r0, g0, b0] = unpack565(c0);
      const [r1, g1, b1] = unpack565(c1);
      const colors = [
        [r0, g0, b0, 255],
        [r1, g1, b1, 255],
        [0, 0, 0, 255],
        [0, 0, 0, 255],
      ];
      if (c0 > c1 || format !== 1) {
        colors[2] = [(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3, 255];
        colors[3] = [(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3, 255];
      } else {
        colors[2] = [(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2, 255];
        colors[3] = [0, 0, 0, 0];
      }
      const idx = src.readUInt32LE(cp + 4);
      for (let i = 0; i < 16; i++) {
        const x = bx * 4 + (i & 3);
        const y = by * 4 + (i >> 2);
        if (x >= width || y >= height) continue;
        const c = colors[(idx >> (2 * i)) & 3];
        const o = (y * width + x) * 4;
        out[o] = c[0];
        out[o + 1] = c[1];
        out[o + 2] = c[2];
        out[o + 3] = format === 1 ? c[3] : alpha[i];
      }
    }
  }
  return out;
}

/** Decodes the top mip level of a BLP2 texture to RGBA. */
export function decodeBLP(buf: Buffer): Rgba {
  if (buf.toString("latin1", 0, 4) !== "BLP2") throw new Error("Not a BLP2 file");
  const compression = buf[8];
  const alphaDepth = buf[9];
  const alphaType = buf[10];
  const width = buf.readUInt32LE(12);
  const height = buf.readUInt32LE(16);
  const offset = buf.readUInt32LE(20);
  const size = buf.readUInt32LE(20 + 64);
  const mip = buf.subarray(offset, offset + size);
  const n = width * height;

  if (compression === 2) {
    const format = alphaType === 7 ? 5 : alphaType === 1 ? 3 : 1;
    return { width, height, data: decodeDXT(mip, width, height, format), hasAlpha: alphaDepth > 0 };
  }
  const data = new Uint8Array(n * 4);
  if (compression === 3) {
    for (let i = 0; i < n; i++) {
      data[i * 4] = mip[i * 4 + 2];
      data[i * 4 + 1] = mip[i * 4 + 1];
      data[i * 4 + 2] = mip[i * 4];
      data[i * 4 + 3] = mip[i * 4 + 3];
    }
    return { width, height, data, hasAlpha: true };
  }
  // Palettized: 256-color BGRA palette at offset 148, indices, then alpha bits.
  const palette = buf.subarray(148, 148 + 1024);
  for (let i = 0; i < n; i++) {
    const c = mip[i] * 4;
    data[i * 4] = palette[c + 2];
    data[i * 4 + 1] = palette[c + 1];
    data[i * 4 + 2] = palette[c];
    let a = 255;
    if (alphaDepth === 1) a = (mip[n + (i >> 3)] >> (i & 7)) & 1 ? 255 : 0;
    else if (alphaDepth === 4) a = ((mip[n + (i >> 1)] >> ((i & 1) * 4)) & 0x0f) * 17;
    else if (alphaDepth === 8) a = mip[n + i];
    data[i * 4 + 3] = a;
  }
  return { width, height, data, hasAlpha: alphaDepth > 0 };
}

export function createImage(width: number, height: number): Rgba {
  return { width, height, data: new Uint8Array(width * height * 4) };
}
