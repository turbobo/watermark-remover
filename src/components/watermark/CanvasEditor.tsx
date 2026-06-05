'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { removeWatermark } from '@/lib/watermark';

export default function CanvasEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });

  // ===== 加载图片 =====
  const loadImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        originalImageRef.current = img;
        setImageSize({ w: img.width, h: img.height });

        // 计算缩放
        const container = containerRef.current!;
        const maxW = container.clientWidth - 20;
        const maxH = 500;
        const s = Math.min(maxW / img.width, maxH / img.height, 1);
        setScale(s);

        const cw = Math.round(img.width * s);
        const ch = Math.round(img.height * s);

        // 设置画布尺寸
        const canvas = canvasRef.current!;
        const maskCanvas = maskCanvasRef.current!;
        canvas.width = cw;
        canvas.height = ch;
        maskCanvas.width = cw;
        maskCanvas.height = ch;

        // 绘制原图
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, cw, ch);

        // 清空 mask
        maskCanvas.getContext('2d')!.clearRect(0, 0, cw, ch);

        setImageLoaded(true);
        setResultUrl(null);
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  // ===== 拖拽上传 =====
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImage(file);
  }, [loadImage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  }, [loadImage]);

  // ===== 画笔绘制 =====
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = maskCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = maskCanvasRef.current!.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize * scale / 2, 0, Math.PI * 2);
    ctx.fill();
  }, [isDrawing, brushSize, scale]);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  }, [draw]);

  const stopDraw = useCallback(() => setIsDrawing(false), []);

  // ===== 清除涂抹 =====
  const clearMask = () => {
    const ctx = maskCanvasRef.current!.getContext('2d')!;
    ctx.clearRect(0, 0, maskCanvasRef.current!.width, maskCanvasRef.current!.height);
    setResultUrl(null);
  };

  // ===== 执行去水印 =====
  const processRemoval = async () => {
    setProcessing(true);
    try {
      const canvas = canvasRef.current!;
      const mask = maskCanvasRef.current!;

      // 创建原尺寸画布
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = imageSize.w;
      fullCanvas.height = imageSize.h;
      fullCanvas.getContext('2d')!.drawImage(originalImageRef.current!, 0, 0);

      // 将 mask 放大到原尺寸
      const fullMask = document.createElement('canvas');
      fullMask.width = imageSize.w;
      fullMask.height = imageSize.h;
      const mCtx = fullMask.getContext('2d')!;
      mCtx.imageSmoothingEnabled = true;
      mCtx.drawImage(mask, 0, 0, imageSize.w, imageSize.h);

      // 执行去水印
      const result = removeWatermark(fullCanvas, fullMask, 5);
      setResultUrl(result.toDataURL('image/png'));
    } catch (err) {
      console.error('去水印失败:', err);
    }
    setProcessing(false);
  };

  // ===== 下载结果 =====
  const downloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `去水印_${Date.now()}.png`;
    a.click();
  };

  // ===== 重新上传 =====
  const reset = () => {
    setImageLoaded(false);
    setResultUrl(null);
    originalImageRef.current = null;
  };

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      {!imageLoaded && (
        <div
          className="drop-zone rounded-xl p-12 text-center cursor-pointer"
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
          onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <div className="text-5xl mb-4">📷</div>
          <p className="text-lg font-medium text-gray-700 mb-2">拖拽图片到这里，或点击上传</p>
          <p className="text-sm text-gray-400">支持 JPG / PNG / WebP，建议不超过 4000×4000</p>
          <input
            id="file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* 编辑器 */}
      {imageLoaded && (
        <>
          {/* 工具栏 */}
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">画笔大小</label>
              <input
                type="range"
                min={5}
                max={80}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-gray-500 w-8">{brushSize}px</span>
            </div>

            <div className="h-5 w-px bg-gray-200" />

            <button
              onClick={clearMask}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              清除涂抹
            </button>
            <button
              onClick={processRemoval}
              disabled={processing}
              className="px-4 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {processing ? <><span className="spinner" />处理中...</> : '✨ 去除水印'}
            </button>

            <div className="flex-1" />

            <span className="text-xs text-gray-400">{imageSize.w}×{imageSize.h}</span>
            <button
              onClick={reset}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              重新上传
            </button>
          </div>

          {/* 画布区域 */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 编辑区 */}
            <div ref={containerRef} className="canvas-container flex-1 bg-white rounded-xl border border-gray-200 p-3 overflow-auto">
              <p className="text-xs text-gray-400 mb-2">🖌️ 用红色涂抹水印区域</p>
              <div className="relative inline-block">
                <canvas
                  ref={canvasRef}
                  className="block rounded"
                  style={{ imageRendering: 'auto' }}
                />
                <canvas
                  ref={maskCanvasRef}
                  className="absolute top-0 left-0 rounded"
                  style={{ imageRendering: 'auto' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
              </div>
            </div>

            {/* 结果预览 */}
            {resultUrl && (
              <div className="flex-1 bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-green-600 font-medium">✅ 处理完成</p>
                  <button
                    onClick={downloadResult}
                    className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                  >
                    下载结果
                  </button>
                </div>
                <img src={resultUrl} alt="去水印结果" className="max-w-full rounded border border-gray-100" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
