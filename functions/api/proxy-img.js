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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    // 只複製必要的 Content-Type，避免其他 header (如 CSP, Content-Length) 在移動端產生相容性問題
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', upstreamRes.headers.get('Content-Type') || 'image/png');
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
