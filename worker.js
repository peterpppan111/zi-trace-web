// worker.js — Cloudflare Workers 入口
// 处理 /api/proxy 代理，其余请求交给静态资源

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 代理路由
    if (url.pathname === '/api/proxy') {
      return handleProxy(request);
    }

    // 其他请求交给静态文件
    return env.ASSETS.fetch(request);
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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
