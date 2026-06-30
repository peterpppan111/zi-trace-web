export default {
  async fetch(request, env, ctx) {
    try {
      const url = "https://xiaoxue.iis.sinica.edu.tw/ImageText2/ShowImage.ashx?text=人&font=標楷體&size=29&style=regular&color=#000000";
      const res = await fetch(url);
      return new Response(res.status.toString());
    } catch (e) {
      return new Response("Error: " + e.message);
    }
  }
}
