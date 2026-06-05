import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

interface MediaItem {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
}

interface ParseResult {
  platform: string;
  title?: string;
  author?: string;
  media: MediaItem[];
}

// ===== 短链接解析（跟踪重定向获取真实 URL）=====
async function resolveShortUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': MOBILE_UA },
    redirect: 'follow',
  });
  return res.url;
}

// ===== 小红书解析 =====
async function parseXiaohongshu(url: string): Promise<ParseResult> {
  // 解析短链接
  let realUrl = url;
  if (/xhslink/i.test(url)) {
    realUrl = await resolveShortUrl(url);
  }

  // 提取笔记 ID
  const noteMatch = realUrl.match(/explore\/([a-f0-9]+)/i) || realUrl.match(/discovery\/item\/([a-f0-9]+)/i);
  if (!noteMatch) {
    throw new Error('无法识别小红书链接，请检查链接格式');
  }

  // 请求页面
  const res = await fetch(realUrl, {
    headers: {
      'User-Agent': MOBILE_UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const result: ParseResult = {
    platform: '小红书',
    title: $('meta[property="og:title"]').attr('content') || $('title').text().trim(),
    author: $('meta[name="author"]').attr('content'),
    media: [],
  };

  // 尝试从 JSON-LD 或 __INITIAL_STATE__ 提取数据
  const scripts = $('script').toArray();
  for (const script of scripts) {
    const content = $(script).html() || '';

    // 尝试匹配 __INITIAL_STATE__ 中的图片
    if (content.includes('__INITIAL_STATE__')) {
      const imgMatch = content.match(/"imageList":\s*(\[.*?\])/s);
      if (imgMatch) {
        try {
          const images = JSON.parse(imgMatch[1].replace(/\\/g, ''));
          for (const img of images) {
            if (img.urlDefault || img.url) {
              result.media.push({
                type: 'image',
                url: img.urlDefault || img.url,
                thumbnail: img.urlPre || img.urlDefault,
              });
            }
          }
        } catch { /* ignore parse errors */ }
      }

      // 视频
      const videoMatch = content.match(/"video":\s*\{[^}]*"url"\s*:\s*"(.*?)"/s);
      if (videoMatch) {
        result.media.push({
          type: 'video',
          url: videoMatch[1].replace(/\\u002F/g, '/'),
        });
      }
    }
  }

  // 回退：从 og:image 提取
  if (result.media.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      result.media.push({ type: 'image', url: ogImage, thumbnail: ogImage });
    }
  }

  // 回退：从 img 标签提取
  if (result.media.length === 0) {
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && (src.includes('xhscdn') || src.includes('sns-webpic'))) {
        result.media.push({ type: 'image', url: src });
      }
    });
  }

  if (result.media.length === 0) {
    throw new Error('未找到可下载的图片或视频，可能该笔记为私密内容');
  }

  return result;
}

// ===== 抖音解析 =====
async function parseDouyin(url: string): Promise<ParseResult> {
  // 解析短链接
  let realUrl = url;
  if (/v\.douyin/i.test(url)) {
    realUrl = await resolveShortUrl(url);
  }

  // 提取视频 ID
  const videoMatch = realUrl.match(/video\/(\d+)/);
  if (!videoMatch) {
    throw new Error('无法识别抖音链接，请检查链接格式');
  }
  const videoId = videoMatch[1];

  // 使用移动端页面获取视频信息
  const mobileUrl = `https://www.iesdouyin.com/share/video/${videoId}`;
  const res = await fetch(mobileUrl, {
    headers: {
      'User-Agent': MOBILE_UA,
      'Accept': 'text/html',
      'Referer': 'https://www.douyin.com/',
    },
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const result: ParseResult = {
    platform: '抖音',
    title: $('meta[property="og:title"]').attr('content') || $('title').text().trim(),
    media: [],
  };

  // 从页面数据提取视频 URL
  const scripts = $('script').toArray();
  for (const script of scripts) {
    const content = $(script).html() || '';

    if (content.includes('playAddr') || content.includes('play_addr')) {
      // 匹配视频播放地址
      const urlMatch = content.match(/"play_addr"[^}]*"url_list"\s*:\s*\["(.*?)"/s)
        || content.match(/"playAddr"\s*:\s*"(.*?)"/s);
      if (urlMatch) {
        let videoUrl = urlMatch[1].replace(/\\u002F/g, '/');
        result.media.push({ type: 'video', url: videoUrl });
      }
    }

    // 封面图
    if (content.includes('cover') || content.includes('poster')) {
      const coverMatch = content.match(/"cover"[^}]*"url_list"\s*:\s*\["(.*?)"/s)
        || content.match(/"poster"\s*:\s*"(.*?)"/s);
      if (coverMatch) {
        const coverUrl = coverMatch[1].replace(/\\u002F/g, '/');
        result.media.push({ type: 'image', url: coverUrl, thumbnail: coverUrl });
      }
    }
  }

  // 回退：og:image
  if (result.media.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogVideo = $('meta[property="og:video:url"]').attr('content') || $('meta[property="og:video"]').attr('content');
    if (ogVideo) result.media.push({ type: 'video', url: ogVideo });
    if (ogImage) result.media.push({ type: 'image', url: ogImage });
  }

  if (result.media.length === 0) {
    throw new Error('未找到可下载的视频，可能该视频已被删除或设为私密');
  }

  return result;
}

// ===== 微博解析 =====
async function parseWeibo(url: string): Promise<ParseResult> {
  // 解析短链接
  let realUrl = url;
  if (/t\.cn\//i.test(url) || /weibo\.cn/i.test(url)) {
    realUrl = await resolveShortUrl(url);
  }

  const res = await fetch(realUrl, {
    headers: {
      'User-Agent': MOBILE_UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Cookie': '',
    },
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const result: ParseResult = {
    platform: '微博',
    title: $('meta[property="og:title"]').attr('content') || $('title').text().trim(),
    media: [],
  };

  // 提取图片
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    // 微博图片域名
    if (src.includes('sinaimg.cn') && (src.includes('/large/') || src.includes('/mw690/') || src.includes('/orj480/'))) {
      // 替换为大图 URL
      const largeUrl = src.replace(/\/mw\d+\//, '/large/').replace(/\/orj\d+\//, '/large/').replace(/\/thumb\d+\//, '/large/');
      result.media.push({ type: 'image', url: largeUrl, thumbnail: src });
    }
  });

  // 提取视频
  const videoSrc = $('video source').attr('src') || $('video').attr('src');
  if (videoSrc) {
    result.media.push({ type: 'video', url: videoSrc });
  }

  // 从 JSON 数据提取
  const scripts = $('script').toArray();
  for (const script of scripts) {
    const content = $(script).html() || '';
    if (content.includes('pic_infos') || content.includes('page_pic')) {
      const picMatch = content.match(/"pic_infos"\s*:\s*\{[^}]*\}/gs);
      if (picMatch) {
        for (const block of picMatch) {
          const largeUrls = [...block.matchAll(/"large"\s*:\s*\{[^}]*"url"\s*:\s*"(.*?)"/g)];
          for (const m of largeUrls) {
            const u = m[1].replace(/\\u002F/g, '/');
            if (!result.media.some((m) => m.url === u)) {
              result.media.push({ type: 'image', url: u });
            }
          }
        }
      }
    }
  }

  // 回退 og:image
  if (result.media.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) result.media.push({ type: 'image', url: ogImage });
  }

  if (result.media.length === 0) {
    throw new Error('未找到可下载的图片或视频，可能该微博已被删除或需要登录');
  }

  return result;
}

// ===== API Route =====
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, platform } = body;

    if (!url) {
      return NextResponse.json({ error: '请提供链接' }, { status: 400 });
    }

    let result: ParseResult;

    switch (platform) {
      case 'xiaohongshu':
        result = await parseXiaohongshu(url);
        break;
      case 'douyin':
        result = await parseDouyin(url);
        break;
      case 'weibo':
        result = await parseWeibo(url);
        break;
      default:
        return NextResponse.json({ error: '不支持的平台' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('解析失败:', err);
    return NextResponse.json(
      { error: err.message || '解析失败，请稍后重试' },
      { status: 500 }
    );
  }
}
