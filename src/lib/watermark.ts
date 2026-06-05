/**
 * 水印去除核心算法
 * 基于边界像素加权平均的内容填充
 */

/** 对 mask 区域内每个像素，用周围未标记像素的加权平均值填充 */
export function removeWatermark(
  sourceCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  blurPasses: number = 3
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  // 创建结果画布
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = w;
  resultCanvas.height = h;
  const resultCtx = resultCanvas.getContext('2d')!;
  resultCtx.drawImage(sourceCanvas, 0, 0);

  const srcData = sourceCanvas.getContext('2d')!.getImageData(0, 0, w, h);
  const maskData = maskCanvas.getContext('2d')!.getImageData(0, 0, w, h);
  const resultData = resultCtx.getImageData(0, 0, w, h);

  const src = srcData.data;
  const mask = maskData.data;
  const dst = resultData.data;

  // 1. 标记需要修复的像素
  const isMasked = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    isMasked[i] = mask[i * 4 + 3] > 30 ? 1 : 0; // alpha > 30 视为被标记
  }

  // 2. 逐遍填充：从边界向内，每次用非 masked 邻居的加权均值填充
  for (let pass = 0; pass < blurPasses; pass++) {
    const filled = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!isMasked[idx] || filled[idx]) continue;

        let r = 0, g = 0, b = 0, totalW = 0;

        // 搜索半径随 pass 增大
        const radius = 2 + pass * 2;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const nIdx = ny * w + nx;

            // 只用非 masked 或已填充的像素
            if (!isMasked[nIdx] || filled[nIdx]) {
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const weight = 1 / (dist * dist); // 距离越近权重越大
              const pi = nIdx * 4;
              r += dst[pi] * weight;
              g += dst[pi + 1] * weight;
              b += dst[pi + 2] * weight;
              totalW += weight;
            }
          }
        }

        if (totalW > 0) {
          const pi = idx * 4;
          dst[pi] = Math.round(r / totalW);
          dst[pi + 1] = Math.round(g / totalW);
          dst[pi + 2] = Math.round(b / totalW);
          dst[pi + 3] = 255;
          filled[idx] = 1;
        }
      }
    }

    // 标记已填充的像素为非 masked，下一遍可被邻居使用
    for (let i = 0; i < w * h; i++) {
      if (filled[i]) isMasked[i] = 0;
    }
  }

  // 3. 对修复区域做轻微高斯模糊平滑
  smoothRegion(dst, w, h, mask, 1);

  resultCtx.putImageData(resultData, 0, 0);
  return resultCanvas;
}

/** 对修复区域做轻微平滑 */
function smoothRegion(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  mask: Uint8ClampedArray,
  radius: number
) {
  const copy = new Uint8ClampedArray(data);

  for (let y = radius; y < h - radius; y++) {
    for (let x = radius; x < w - radius; x++) {
      const idx = y * w + x;
      if (mask[idx * 4 + 3] <= 30) continue;

      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ni = ((y + dy) * w + (x + dx)) * 4;
          r += copy[ni];
          g += copy[ni + 1];
          b += copy[ni + 2];
          count++;
        }
      }
      const pi = idx * 4;
      data[pi] = Math.round(r / count);
      data[pi + 1] = Math.round(g / count);
      data[pi + 2] = Math.round(b / count);
    }
  }
}
