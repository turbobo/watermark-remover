'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

const CanvasEditor = dynamic(() => import('@/components/watermark/CanvasEditor'), { ssr: false });
const LinkParser = dynamic(() => import('@/components/link-parser/LinkParser'), { ssr: false });

type Tab = 'watermark' | 'link';

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'watermark', label: '图片去水印', icon: '🖌️' },
  { key: 'link', label: '链接解析下载', icon: '🔗' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('watermark');

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h1 className="text-lg font-bold text-gray-800">去水印工具箱</h1>
          </div>
          <span className="text-xs text-gray-400">免费 · 无需登录 · 本地处理</span>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Tab 切换 */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab-btn flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 ${
                activeTab === tab.key ? 'active' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <div className="bg-white/60 backdrop-blur rounded-2xl border border-gray-200 p-5 sm:p-6">
          {activeTab === 'watermark' && <CanvasEditor />}
          {activeTab === 'link' && <LinkParser />}
        </div>

        {/* 功能说明 */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FeatureCard
            icon="🖌️"
            title="智能去水印"
            desc="上传图片，涂抹水印区域，自动用周围像素填充修复"
          />
          <FeatureCard
            icon="📱"
            title="社交平台解析"
            desc="支持小红书、抖音、微博链接，一键提取无水印原图/视频"
          />
          <FeatureCard
            icon="🔒"
            title="隐私安全"
            desc="图片处理完全在浏览器本地完成，不上传到服务器"
          />
        </div>

        {/* Footer */}
        <footer className="mt-10 pb-6 text-center text-xs text-gray-400">
          <p>去水印工具箱 · 仅供学习交流使用</p>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="text-sm font-medium text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}
