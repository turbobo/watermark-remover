import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '去水印工具箱 - 在线去除图片/视频水印',
  description: '免费在线去水印工具，支持上传图片智能去水印，以及小红书、抖音、微博链接解析无水印原图/视频下载。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
