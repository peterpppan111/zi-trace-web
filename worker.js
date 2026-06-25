// worker.js — Cloudflare Workers 入口
// 版本控制：修改 CURRENT_VERSION 可让旧分享链接失效

const CURRENT_VERSION = 'v1'; // ← 改这里让旧链接失效

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 版本過期檢測（如 /v0/* 訪問舊版本）
    const versionMatch = url.pathname.match(/^\/(v\d+)(\/|$)/);
    if (versionMatch && versionMatch[1] !== CURRENT_VERSION) {
      return new Response(
        `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8">
        <title>鏈接已過期</title>
        <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F5F1EA;margin:0}
        .box{text-align:center;padding:48px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.1);max-width:380px}
        h1{font-size:48px;margin:0 0 8px}h2{color:#1C1814;margin:0 0 12px}
        p{color:#8C877F;font-size:14px;line-height:1.6}
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
      return handleProxy(request);
    }

    // 圖片代理路由
    if (cleanPath === '/api/proxy-img') {
      return handleImageProxy(request);
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

async function handleProxy(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await request.text();

    const upstream = await fetch(
      'https://xiaoxue.iis.sinica.edu.tw/yanbian/PageResult/PageResult',
      {
        method: 'POST',
        headers: {
          'Content-Type':    'application/x-www-form-urlencoded',
          'Referer':         'https://xiaoxue.iis.sinica.edu.tw/yanbian',
          'User-Agent':      'Mozilla/5.0 (compatible; ZiTrace/1.0)',
          'Accept-Language': 'zh-TW,zh;q=0.9',
        },
        body,
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

    return new Response(text, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders(),
      },
    });
  } catch (err) {
    return new Response(`代理失敗: ${err.message}`, {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

async function handleImageProxy(request) {
  const url = new URL(request.url);
  const targetUrlPath = url.searchParams.get('url');
  if (!targetUrlPath) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  // 構建絕對 URL
  const absoluteUrl = 'https://xiaoxue.iis.sinica.edu.tw' + targetUrlPath;

  try {
    const upstream = await fetch(absoluteUrl, {
      method: 'GET',
      headers: {
        'Referer':         'https://xiaoxue.iis.sinica.edu.tw/yanbian',
        'User-Agent':      'Mozilla/5.0 (compatible; ZiTrace/1.0)',
        'Accept-Language': 'zh-TW,zh;q=0.9',
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

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800', // 快取 7 天
        ...corsHeaders(),
      },
    });
  } catch (err) {
    return new Response(`圖片代理失敗: ${err.message}`, {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
