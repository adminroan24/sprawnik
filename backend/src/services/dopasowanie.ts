export type SprawaDoDopasowania = {
  id: number; tytul: string; znakWlasny: string | null; organ: string | null; znakiPism: string[];
};
export type Dopasowanie = { sprawaId: number; tytul: string; pewnosc: 'wysoka' | 'niska'; powody: string[] };

function zawieraZnak(tekst: string, znak: string): boolean {
  const czesci = znak.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [];
  if (czesci.join('').length < 6) return false;
  const wzorzec = new RegExp('(?<![\\p{L}\\p{N}])' + czesci.join('[\\s./_-]*') + '(?![\\p{L}\\p{N}])', 'iu');
  return wzorzec.test(tekst.normalize('NFKC'));
}

const normalizuj = (tekst: string) => tekst.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('pl');

/** Reguły porównują wyłącznie sprawy widoczne dla danego użytkownika. */
export function dopasujSprawy(tekst: string, sprawy: SprawaDoDopasowania[]) {
  const wyniki = sprawy.flatMap<Dopasowanie>((sprawa) => {
    const powody: string[] = [];
    if (sprawa.znakWlasny && zawieraZnak(tekst, sprawa.znakWlasny)) {
      powody.push(`Znak sprawy: ${sprawa.znakWlasny}`);
    }
    for (const znak of sprawa.znakiPism) {
      if (zawieraZnak(tekst, znak)) powody.push(`Znak wcześniejszego pisma: ${znak}`);
    }
    if (powody.length) return [{ sprawaId: sprawa.id, tytul: sprawa.tytul,
      pewnosc: 'wysoka' as const, powody }];
    const slowa = [...new Set(normalizuj(sprawa.organ ?? '').match(/[\p{L}]{4,}/gu) ?? [])];
    const odczyt = new Set(normalizuj(tekst).match(/[\p{L}]+/gu) ?? []);
    if (slowa.length >= 2 && slowa.every((slowo) => odczyt.has(slowo))) {
      return [{ sprawaId: sprawa.id, tytul: sprawa.tytul, pewnosc: 'niska' as const,
        powody: [`Zbieżna nazwa instytucji: ${sprawa.organ}`] }];
    }
    return [];
  });
  const dokladne = wyniki.filter((wynik) => wynik.pewnosc === 'wysoka');
  return dokladne.length ? dokladne : wyniki;
}
