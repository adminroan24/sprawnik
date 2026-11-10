/** Kolejny przebieg zaczyna się dopiero po zakończeniu poprzedniego. */
export function uruchomPetle(zadanie: (zatrzymano: () => boolean) => Promise<void>, coMs: number,
  blad: () => void = () => console.error('[skany] Błąd kolejki; kolejny przebieg zostanie ponowiony.')) {
  let zatrzymano = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let biezace: Promise<void>;
  const przebieg = async () => {
    try { await zadanie(() => zatrzymano); } catch { blad(); }
    if (!zatrzymano) timer = setTimeout(() => { biezace = przebieg(); }, coMs);
  };
  biezace = przebieg();
  return async () => { zatrzymano = true; clearTimeout(timer); await biezace; };
}

export function uruchomObslugeSkanow() {
  if (process.env.SCAN_WATCH_ENABLED !== 'true') return async () => {};
  console.log('[skany] Stały odbiór i OCR włączone; przypisanie wymaga zatwierdzenia.');
  return uruchomPetle(async zatrzymano => {
    const { przetworzKolejkeSkanow } = await import('./skany.js');
    await przetworzKolejkeSkanow(zatrzymano);
  }, 5000);
}
