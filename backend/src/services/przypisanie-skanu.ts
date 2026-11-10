import { z } from 'zod';

export const planPrzypisania = z.object({
  skanId: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sprawaId: z.number().int().positive().optional(),
  nowaSprawa: z.object({ tytul: z.string().trim().min(1), grupaId: z.number().int().positive().nullable().default(null) }).optional(),
  pismoId: z.number().int().positive().optional(),
  nowePismo: z.object({ rodzaj: z.string().trim().min(1), korespondent: z.string().trim().min(1),
    znakPisma: z.string().nullable().default(null), opis: z.string().nullable().default(null) }).optional(),
  rola: z.enum(['tresc','zalacznik','dowod_nadania','potwierdzenie_odbioru']).default('tresc'),
}).refine(p => Boolean(p.sprawaId) !== Boolean(p.nowaSprawa), 'Wskaż istniejącą albo nową sprawę')
  .refine(p => Boolean(p.pismoId) !== Boolean(p.nowePismo), 'Wskaż istniejące albo nowe pismo')
  .refine(p => !p.pismoId || Boolean(p.sprawaId), 'Istniejące pismo wymaga wskazania jego sprawy');
export type PlanPrzypisania = z.infer<typeof planPrzypisania>;
export type StanPrzypisania = { sprawaId?: number; pismoId?: number; wynik?: { dokumentId: number; terminId: number | null; archiwizowano: boolean; ostrzezenie: string | null } };
export type KlientPrzypisania = (metoda: 'GET' | 'POST' | 'PATCH', sciezka: string, dane?: unknown) => Promise<any>;

/** Sekwencja używa tego samego API, uprawnień i magazynu co interfejs. */
export async function przypiszSkan(api: KlientPrzypisania, plan: PlanPrzypisania, zapis: boolean,
  stan: StanPrzypisania = {}, utrwal: (stan: StanPrzypisania) => Promise<void> = async () => {}):
  Promise<StanPrzypisania & { wykonanoWczesniej?: boolean; tryb?: string; [klucz: string]: unknown }> {
  if (stan.wynik) return { wykonanoWczesniej: true, ...stan };
  const { skany } = await api('GET', '/skany');
  const skan = skany.find((s: { id: string }) => s.id === plan.skanId);
  if (!skan) throw new Error('Skan nie oczekuje na przypisanie');
  if (!skan.gotowy || skan.zaDuzy) throw new Error('Skan nie jest gotowy lub przekracza limit rozmiaru');
  const ocr = await api('POST', `/skany/${plan.skanId}/rozpoznaj`, {});
  if (ocr.sha256 !== plan.sha256) throw new Error('Plik zmienił się od przygotowania planu. Sprawdź skan ponownie.');
  const sprawaId = stan.sprawaId ?? plan.sprawaId;
  const pismoId = stan.pismoId ?? plan.pismoId;
  let szczegoly = sprawaId ? await api('GET', `/sprawy/${sprawaId}`) : null;
  let pismo = pismoId ? szczegoly?.pisma.find((p: { id: number }) => p.id === pismoId) : null;
  if (pismoId && !pismo) throw new Error('Pismo nie należy do wskazanej sprawy');
  if (!sprawaId && plan.nowaSprawa?.grupaId) {
    const { grupy } = await api('GET', '/grupy');
    if (!grupy.some((g: { id: number }) => g.id === plan.nowaSprawa!.grupaId)) throw new Error('Grupa docelowa nie istnieje');
  }
  const przychodzace = !pismo || pismo.kierunek === 'przychodzace';
  const dataWplywu = skan.dataWplywu ?? pismo?.dataDoreczenia ?? null;
  if (przychodzace && plan.rola === 'tresc' && !dataWplywu) throw new Error('Najpierw zapisz datę wpływu skanu');
  if (skan.dataWplywu && pismo?.dataDoreczenia && pismo.dataDoreczenia !== skan.dataWplywu) {
    throw new Error('Data doręczenia pisma różni się od daty wpływu skanu');
  }
  const podglad = { tryb: zapis ? 'zapis' : 'podglad', skan: skan.nazwa, dataWplywu,
    sprawa: szczegoly?.sprawa ?? plan.nowaSprawa, pismo: pismo ?? plan.nowePismo,
    terminZatwierdzony: skan.terminOdpowiedzi ?? null,
    propozycjeTerminow: ocr.propozycjeTerminow ?? [],
    uwaga: skan.terminOdpowiedzi ? 'Zachowany zostanie zatwierdzony termin skanu.' : 'Propozycje OCR nie zostały zatwierdzone — skrypt nie utworzy z nich terminu.' };
  if (!zapis) return podglad;
  if (!sprawaId) {
    stan.sprawaId = (await api('POST', '/sprawy', plan.nowaSprawa)).sprawa.id;
    await utrwal(stan);
  } else stan.sprawaId = sprawaId;
  if (!pismoId) {
    stan.pismoId = (await api('POST', `/sprawy/${stan.sprawaId}/pisma`, {
      ...plan.nowePismo, kierunek: 'przychodzace', dataDoreczenia: dataWplywu,
    })).pismo.id;
    await utrwal(stan);
  } else {
    stan.pismoId = pismoId;
    if (przychodzace && !pismo.dataDoreczenia && dataWplywu) {
      await api('PATCH', `/pisma/${pismoId}/doreczenie`, { dataDoreczenia: dataWplywu });
    }
  }
  const wynik = await api('POST', `/skany/${plan.skanId}/import`, { pismoId: stan.pismoId, rola: plan.rola, sha256: plan.sha256 });
  stan.wynik = { dokumentId: wynik.dokument.id, terminId: wynik.terminId ?? null,
    archiwizowano: wynik.archiwizowano, ostrzezenie: wynik.ostrzezenie };
  await utrwal(stan);
  return { ...podglad, ...stan };
}
