import type { GrupaSpraw } from '../typy';
export function sciezkaGrupy(grupy: GrupaSpraw[], id: number | null): string {
  const czesci: string[] = []; const odwiedzone = new Set<number>();
  while (id !== null && !odwiedzone.has(id)) {
    odwiedzone.add(id); const grupa = grupy.find(g => g.id === id); if (!grupa) break;
    czesci.unshift(grupa.nazwa); id = grupa.rodzicId;
  }
  return czesci.join(' / ');
}
export function podgrupy(grupy: GrupaSpraw[], id: number): Set<number> {
  const zbior = new Set<number>([id]);
  let zmiana = true;
  while (zmiana) { zmiana = false; for (const g of grupy) if (g.rodzicId !== null && zbior.has(g.rodzicId) && !zbior.has(g.id)) { zbior.add(g.id); zmiana = true; } }
  return zbior;
}
