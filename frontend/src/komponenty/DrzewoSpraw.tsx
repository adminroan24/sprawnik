import type { GrupaSpraw } from '../typy';
export function DrzewoSpraw({ grupy, wybrana, wybierz }: { grupy: GrupaSpraw[]; wybrana: string; wybierz: (id: string) => void }) {
  function galaz(rodzicId: number | null) {
    return <ul>{grupy.filter(g => g.rodzicId === rodzicId).map(g => <li key={g.id}>
      <button className={wybrana === String(g.id) ? 'aktywny' : 'drugorzedny'} aria-pressed={wybrana === String(g.id)} onClick={() => wybierz(String(g.id))}>{g.nazwa}</button>
      {grupy.some(p => p.rodzicId === g.id) && galaz(g.id)}
    </li>)}</ul>;
  }
  return <nav aria-label="Drzewo grup spraw" className="drzewo-spraw">
    <button aria-pressed={wybrana === ''} onClick={() => wybierz('')}>Wszystkie sprawy</button>
    <button aria-pressed={wybrana === 'bez'} onClick={() => wybierz('bez')}>Bez przypisanej grupy</button>
    {galaz(null)}
  </nav>;
}
