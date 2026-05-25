try {
  const r = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=3', { signal: AbortSignal.timeout(8000) });
  console.log('binance status', r.status);
  const j = await r.json();
  console.log('rows', Array.isArray(j) ? j.length : 'n/a', 'last close', Array.isArray(j) ? j[j.length-1][4] : '');
} catch (e) {
  console.log('binance unreachable:', e instanceof Error ? e.message : String(e));
}
