export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing URL parameter', { status: 400 });
  }

  // 確保只能請求小學堂的相對路徑資源，防止被當作公開代理濫用
  if (!targetUrl.startsWith('/')) {
    return new Response('Invalid URL target', { status: 403 });
  }

  try {
    const upstreamRes = await fetch(`https://xiaoxue.iis.sinica.edu.tw${targetUrl}`, {
      headers: {
        'Referer': 'https://xiaoxue.iis.sinica.edu.tw/yanbian',
        'User-Agent': 'Mozilla/5.0 (compatible; ZiTrace/1.0; +https://zi-trace-web.pages.dev)'
      }
    });

    // 將上游的標頭複製過來，並加上 CORS 與強快取
    const responseHeaders = new Headers(upstreamRes.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable'); // 快取一年

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response('Proxy error: ' + err.message, { status: 500 });
  }
}
