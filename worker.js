// worker.js — Cloudflare Workers 入口
// 版本控制：修改 CURRENT_VERSION 可让旧分享链接失效

const CURRENT_VERSION = 'v1'; // ← 改这里让旧链接失效

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 版本過期檢測（如 /v0/* 訪問舊版本）
    const versionMatch = url.pathname.match(/^\/(v\d+)(\/|$)/);
    if (versionMatch && versionMatch[1] !== CURRENT_VERSION) {
      return new Response(
        `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8">
        <title>鏈接已過期</title>
        <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0A0A0A;margin:0;color:#F8F9FA}
        .box{text-align:center;padding:48px;background:rgba(20,20,20,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:24px;box-shadow:0 12px 32px rgba(0,0,0,0.6);max-width:380px}
        h1{font-size:48px;margin:0 0 8px}h2{color:#F8F9FA;margin:0 0 12px}
        p{color:#ADB5BD;font-size:14px;line-height:1.6}
        </style></head><body><div class="box">
        <h1>📜</h1><h2>此分享鏈接已過期</h2>
        <p>學習資料已更新，請向分享者索取新版鏈接。</p>
        </div></body></html>`,
        { status: 410, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
      );
    }

    // 獲取去除了版本號首碼的乾淨路徑
    const cleanPath = url.pathname.replace(/^\/v\d+/, '') || '/';

    // 代理路由
    if (cleanPath === '/api/proxy') {
      return handleProxy(request, ctx);
    }

    // 圖片代理路由
    if (cleanPath === '/api/proxy-img') {
      return handleImageProxy(request, ctx);
    }

    // 其他請求交給靜態檔，如果是目前的版本，重寫請求路徑以供 ASSETS 讀取
    let targetRequest = request;
    if (versionMatch && versionMatch[1] === CURRENT_VERSION) {
      const targetUrl = new URL(request.url);
      targetUrl.pathname = cleanPath;
      targetRequest = new Request(targetUrl.toString(), request);
    }

    // 其他请求交给静态文件
    return env.ASSETS.fetch(targetRequest);
  },
};

// 隨機產生現代瀏覽器的 User-Agent 列表
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomIP() {
  return `${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
}

async function handleProxy(request, ctx) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const bodyText = await request.text();

    // 1. Generate Cache Key using body (since POST requests aren't cached by default)
    // We create a synthetic GET Request object to use as the cache key
    const cacheKeyUrl = new URL(request.url);
    cacheKeyUrl.pathname = '/api/cache-proxy';
    cacheKeyUrl.searchParams.set('payload', bodyText);
    const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });

    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (!response) {
      // 2. Cache miss, fetch from upstream with anti-ban headers
      const upstream = await fetch(
        'https://xiaoxue.iis.sinica.edu.tw/yanbian/PageResult/PageResult',
        {
          method: 'POST',
          headers: {
            'Content-Type':    'application/x-www-form-urlencoded',
            'Referer':         'https://xiaoxue.iis.sinica.edu.tw/yanbian',
            'User-Agent':      getRandomUserAgent(),
            'Accept-Language': 'zh-TW,zh;q=0.9',
            'X-Forwarded-For': getRandomIP() // IP 偽裝
          },
          body: bodyText,
        }
      );

      if (!upstream.ok) {
        return new Response(`上游錯誤 HTTP ${upstream.status}`, {
          status: 502,
          headers: corsHeaders(),
        });
      }

      const buffer = await upstream.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(buffer);

      // 3. Create response and cache it for 30 days
      response = new Response(text, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 's-maxage=2592000', // 30 days Cloudflare cache
          ...corsHeaders(),
        },
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
      // 4. Cache hit, ensure CORS headers are present
      response = new Response(response.body, response);
      Object.entries(corsHeaders()).forEach(([k, v]) => response.headers.set(k, v));
    }

    return response;
  } catch (err) {
    return new Response(`代理失敗: ${err.message}`, {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

async function handleImageProxy(request, ctx) {
  const url = new URL(request.url);
  const targetUrlPath = url.searchParams.get('url');
  if (!targetUrlPath) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  // 1. Generate Cache Key
  const cacheKeyUrl = new URL(request.url);
  const cacheKey = new Request(cacheKeyUrl.toString(), request);
  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (!response) {
    // 2. Cache miss, fetch from upstream
    const absoluteUrl = 'https://xiaoxue.iis.sinica.edu.tw' + targetUrlPath;

    try {
      const upstream = await fetch(absoluteUrl, {
        method: 'GET',
        headers: {
          'Referer':         'https://xiaoxue.iis.sinica.edu.tw/yanbian',
          'User-Agent':      getRandomUserAgent(),
          'Accept-Language': 'zh-TW,zh;q=0.9',
          'X-Forwarded-For': getRandomIP()
        },
      });

      if (!upstream.ok) {
        return new Response(`上游錯誤 HTTP ${upstream.status}`, {
          status: 502,
          headers: corsHeaders(),
        });
      }

      const contentType = upstream.headers.get('Content-Type') || 'image/png';
      const body = await upstream.arrayBuffer();

      response = new Response(body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=2592000, s-maxage=2592000', // 30 days
          ...corsHeaders(),
        },
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } catch (err) {
      return new Response(`圖片代理失敗: ${err.message}`, {
        status: 500,
        headers: corsHeaders(),
      });
    }
  } else {
    // 3. Cache hit, ensure CORS headers
    response = new Response(response.body, response);
    Object.entries(corsHeaders()).forEach(([k, v]) => response.headers.set(k, v));
  }

  return response;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
