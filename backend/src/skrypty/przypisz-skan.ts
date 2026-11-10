import { readFile, writeFile, stat, rename, unlink, open } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { planPrzypisania, przypiszSkan, type StanPrzypisania } from '../services/przypisanie-skanu.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--pomoc')) { console.log('Użycie: npm run przypisz-skan -- --sesja <prywatny.json> --plan <plan.json> [--zapisz]'); return; }
  const wartosc = (nazwa: string) => { const i = args.indexOf(nazwa); if (i < 0 || !args[i + 1] || args[i + 1]!.startsWith('--')) throw new Error(`Brak ${nazwa}`); return args[i + 1]!; };
  const sesjaPlik = wartosc('--sesja'), planPlik = path.resolve(wartosc('--plan'));
  if ((await stat(sesjaPlik)).mode & 0o077) throw new Error('Plik sesji musi mieć prawa 0600, aby chronić token');
  const sesja = z.object({ api: z.url(), token: z.string().min(1) }).parse(JSON.parse(await readFile(sesjaPlik, 'utf8')));
  const url = new URL(sesja.api);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname)))) {
    throw new Error('API wymaga HTTPS lub lokalnego adresu HTTP');
  }
  const plan = planPrzypisania.parse(JSON.parse(await readFile(planPlik, 'utf8')));
  const sumaPlanu = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  const dziennik = planPlik + '.stan.json';
  let blokada;
  try {
    if (args.includes('--zapisz')) {
      blokada = await open(dziennik + '.lock', 'wx', 0o600).catch(e => {
        if (e.code === 'EEXIST') throw new Error('Ten plan ma blokadę wykonania. Sprawdź, czy drugi skrypt nadal pracuje.');
        throw e;
      });
      await blokada.writeFile(String(process.pid));
    }
    let stan: StanPrzypisania = {};
    try {
      const zapisany = JSON.parse(await readFile(dziennik, 'utf8'));
      if (zapisany.sumaPlanu !== sumaPlanu) throw new Error('Plan zmieniono po rozpoczęciu wykonania. Zachowaj dziennik i przygotuj osobny plan.');
      stan = zapisany.stan;
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    const api = async (metoda: 'GET' | 'POST' | 'PATCH', sciezka: string, dane?: unknown) => {
      const odpowiedz = await fetch(sesja.api.replace(/\/$/, '') + sciezka, { method: metoda,
        redirect: 'error', signal: AbortSignal.timeout(240000),
        headers: { Authorization: `Bearer ${sesja.token}`, 'Content-Type': 'application/json' },
        ...(dane === undefined ? {} : { body: JSON.stringify(dane) }) });
      const wynik = await odpowiedz.json() as { error?: string };
      if (!odpowiedz.ok) throw new Error(`HTTP ${odpowiedz.status}: ${wynik.error ?? 'Błąd API'}`);
      return wynik;
    };
    const utrwal = async (stan: StanPrzypisania) => {
      const tmp = dziennik + '.' + randomUUID();
      try { await writeFile(tmp, JSON.stringify({ sumaPlanu, stan }, null, 2), { flag: 'wx', mode: 0o600 }); await rename(tmp, dziennik); }
      finally { await unlink(tmp).catch(() => undefined); }
    };
    console.log(JSON.stringify(await przypiszSkan(api, plan, args.includes('--zapisz'), stan, utrwal), null, 2));
  } finally {
    if (blokada) { await blokada.close(); await unlink(dziennik + '.lock').catch(() => undefined); }
  }
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Nie udało się przypisać skanu'); process.exitCode = 1; });
