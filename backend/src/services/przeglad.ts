/**
 * Przegląd terminów (UC8) wraz z kwalifikacją do stanów ostrzegawczych (UC9).
 *
 * Stan nie jest przechowywany w bazie — powstaje przy odczycie, przez porównanie
 * daty upływu z datą bieżącą. Ostrzeżenie nie zmienia terminu, zmienia wyłącznie
 * sposób jego prezentacji.
 */

import * as terminyDb from '../db/terminy.js';
import { stanTerminu, type StanTerminu, type StatusTerminu } from './terminy.js';
import type { TerminZKontekstem } from '../db/terminy.js';

export type TerminZeStanem = TerminZKontekstem & {
  stan: StanTerminu | null;
  dniDoUplywu: number;
};

const MILISEKUNDY_DOBY = 24 * 60 * 60 * 1000;

export function dzisiaj(): string {
  return new Date().toISOString().slice(0, 10);
}

function opiszTermin(termin: TerminZKontekstem, dzien: string, prog: number): TerminZeStanem {
  const dniDoUplywu = Math.round(
    (new Date(`${termin.dataUplywu}T00:00:00.000Z`).getTime() -
      new Date(`${dzien}T00:00:00.000Z`).getTime()) /
      MILISEKUNDY_DOBY,
  );
  return {
    ...termin,
    // Stan ostrzegawczy dotyczy wyłącznie terminów otwartych — termin wykonany
    // ani anulowany nie wymaga już działania, więc nie jest „przekroczony".
    stan: termin.status === 'otwarty' ? stanTerminu(termin.dataUplywu, dzien, prog) : null,
    dniDoUplywu,
  };
}

export async function terminySprawy(
  sprawaId: number,
  progOstrzegania = 7,
): Promise<TerminZeStanem[]> {
  const dzien = dzisiaj();
  const terminy = await terminyDb.listaDlaSprawy(sprawaId);
  return terminy.map((termin) => opiszTermin(termin, dzien, progOstrzegania));
}

export async function terminyUzytkownika(
  uzytkownikId: number,
  status: StatusTerminu | null = 'otwarty',
  progOstrzegania = 7,
): Promise<TerminZeStanem[]> {
  const dzien = dzisiaj();
  const terminy = await terminyDb.listaUzytkownika(uzytkownikId, status);
  return terminy.map((termin) => opiszTermin(termin, dzien, progOstrzegania));
}

/** Podsumowanie wykorzystywane na stronie głównej interfejsu. */
export function podsumowanie(terminy: TerminZeStanem[]): Record<StanTerminu, number> {
  return {
    przekroczony: terminy.filter((t) => t.stan === 'przekroczony').length,
    zblizajacy_sie: terminy.filter((t) => t.stan === 'zblizajacy_sie').length,
    odlegly: terminy.filter((t) => t.stan === 'odlegly').length,
  };
}
