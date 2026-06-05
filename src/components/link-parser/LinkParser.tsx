'use client';

import React, { useState } from 'react';

interface MediaItem {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  title?: string;
}

interface ParseResult {
  platform: string;
  title?: string;
  author?: string;
  media: MediaItem[];
}

export default function LinkParser() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState('');

  const detectPlatform = (link: string): string => {
    if (/xiaohongshu\.com|xhslink\.com|xhslink/i.test(link)) return 'xiaohongshu';
    if (/douyin\.com|v\.douyin/i.test(link)) return 'douyin';
    if (/weibo\.com|m\.weibo/i.test(link)) return 'weibo';
    return 'unknown';
  };

  const platformNames: Record<string, string> = {
    xiaohongshu: '小红书',
    douyin: '抖音',
    weibo: '微博',
    unknown: '未知平台',
  };

  const platformIcons: Record<string, string> = {
    xiaohongshu: '📕',
    douyin: '🎵',
    weibo: '🌐',
    unknown: '❓',
  };

  const handleParse = async () => {
    const link = url.trim();
    if (!link) {
      setError('请输入链接');
      return;
    }

    const platform = detectPlatform(link);
    if (platform === 'unknown') {
      setError('暂不支持该平台，目前支持小红书、抖音、微博');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link, platform }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '解析失败');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || '网络错误，请稍后重试');
    }

    setLoading(false);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      // 自动检测并解析
      const platform = detectPlatform(text);
      if (platform !== 'unknown') {
        setUrl(text);
      }
    } catch {
      // 剪贴板权限被拒绝
    }
  };

  const downloadMedia = (item: MediaItem, index: number) => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = `${result?.platform || 'media'}_${index + 1}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
    a.target = '_blank';
    a.click();
  };

  const downloadAll = () => {
    result?.media.forEach((item, i) => {
      setTimeout(() => downloadMedia(item, i), i * 300);
    });
  };

  return (
    <div className="space-y-4">
      {/* 输入区域 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleParse()}
            placeholder="粘贴小红书 / 抖音 / 微博链接..."
            className="w-full px-4 py-3 pr-16 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          <button
            onClick={handlePaste}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
          >
            粘贴
          </button>
        </div>
        <button
          onClick={handleParse}
          disabled={loading || !url.trim()}
          className="px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
        >
          {loading ? <><span className="spinner" />解析中</> : '🔍 解析'}
        </button>
      </div>

      {/* 平台标识 */}
      {url.trim() && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>{platformIcons[detectPlatform(url)]}</span>
          <span>{platformNames[detectPlatform(url)]}</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* 解析结果 */}
      {result && (
        <div className="space-y-3">
          {/* 标题信息 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {result.title && (
              <p className="text-sm font-medium text-gray-800 mb-1">{result.title}</p>
            )}
            {result.author && (
              <p className="text-xs text-gray-500">作者：{result.author}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              共 {result.media.length} 个{result.media[0]?.type === 'video' ? '视频' : '图片'}
            </p>
          </div>

          {/* 媒体预览 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {result.media.map((item, i) => (
              <div key={i} className="result-card group">
                {item.type === 'image' ? (
                  <img
                    src={item.thumbnail || item.url}
                    alt={`图片 ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-lg mb-2"
                  />
                ) : (
                  <div className="w-full aspect-video bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                    <span className="text-3xl">🎬</span>
                  </div>
                )}
                <button
                  onClick={() => downloadMedia(item, i)}
                  className="w-full py-1.5 text-xs text-blue-500 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  下载{item.type === 'video' ? '视频' : '图片'}
                </button>
              </div>
            ))}
          </div>

          {/* 全部下载 */}
          {result.media.length > 1 && (
            <button
              onClick={downloadAll}
              className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              全部下载（{result.media.length} 个）
            </button>
          )}
        </div>
      )}

      {/* 使用说明 */}
      {!result && !loading && !error && (
        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-2">
          <p className="font-medium text-gray-600">使用方法：</p>
          <p>1. 在小红书/抖音/微博 App 中点击「分享」→「复制链接」</p>
          <p>2. 将链接粘贴到上方输入框</p>
          <p>3. 点击解析，下载无水印原图/视频</p>
        </div>
      )}
    </div>
  );
}
