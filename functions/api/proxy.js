/**
 * Cloudflare Pages Function: /api/proxy
 * 代理 POST 請求至中央研究院小學堂字形演變資料庫。
 * 圖片 URL 保留原始域名，由用戶端瀏覽器直接加載——需要網絡連接。
 */
export async function onRequestPost(context) {
  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders(),
    });
  }

  try {
    const body = await context.request.text();

    const upstream = await fetch(
      'https://xiaoxue.iis.sinica.edu.tw/yanbian/PageResult/PageResult',
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Referer':       'https://xiaoxue.iis.sinica.edu.tw/yanbian',
          'User-Agent':    'Mozilla/5.0 (compatible; ZiTrace/1.0; +https://zi-trace.pages.dev)',
          'Accept':        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9',
        },
        body,
      }
    );

    if (!upstream.ok) {
      return new Response(`上游服務錯誤 (HTTP ${upstream.status})`, {
        status: 502,
        headers: corsHeaders(),
      });
    }

    // Decode with Traditional Chinese encoding (Big5 / UTF-8)
    const buffer = await upstream.arrayBuffer();
    let text;
    try {
      text = new TextDecoder('utf-8').decode(buffer);
    } catch {
      text = new TextDecoder('big5').decode(buffer);
    }

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders(),
      },
    });
  } catch (err) {
    return new Response(`代理請求失敗: ${err.message}`, {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

// Allow GET for health check
export async function onRequestGet() {
  return new Response(JSON.stringify({ status: 'ok', service: '漢字源流代理' }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
