/**
 * Uwierzytelnianie — sprawdzenie tożsamości i wystawienie podpisanego tokenu.
 *
 * Komponent odrębny od tras: trasy pytają go o tożsamość, same jej nie ustalają
 * (sekcja 2.3 dokumentacji). Sesja jest bezstanowa, w bazie nie powstaje tabela
 * sesji — tożsamość potwierdza podpisany token przekazywany w nagłówku żądania.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { BladZadania } from '../middleware/errors.js';
import * as uzytkownicy from '../db/uzytkownicy.js';
import type { Rola, Uzytkownik } from '../db/uzytkownicy.js';

/** Koszt haszowania. Wyższy oznacza wolniejsze sprawdzenie hasła, także dla atakującego. */
const KOSZT_HASZOWANIA = 12;

export type TrescTokenu = { id: number; rola: Rola };

export async function zahaszujHaslo(haslo: string): Promise<string> {
  return bcrypt.hash(haslo, KOSZT_HASZOWANIA);
}

/**
 * Sprawdza dane logowania.
 *
 * Nieistniejące konto i błędne hasło dają ten sam komunikat, żeby odpowiedź nie
 * ujawniała, które adresy są zarejestrowane w systemie.
 */
export async function zaloguj(
  email: string,
  haslo: string,
): Promise<{ uzytkownik: Uzytkownik; token: string }> {
  const bladLogowania = new BladZadania(401, 'Nieprawidłowy adres e-mail lub hasło');

  const znaleziony = await uzytkownicy.znajdzPoEmailu(email);
  if (!znaleziony || !znaleziony.aktywny) {
    throw bladLogowania;
  }

  const hasloPoprawne = await bcrypt.compare(haslo, znaleziony.hasloHash);
  if (!hasloPoprawne) {
    throw bladLogowania;
  }

  const { hasloHash: _pomijane, ...uzytkownik } = znaleziony;
  return { uzytkownik, token: wystawToken(uzytkownik) };
}

export function wystawToken(uzytkownik: Pick<Uzytkownik, 'id' | 'rola'>): string {
  const tresc: TrescTokenu = { id: uzytkownik.id, rola: uzytkownik.rola };
  return jwt.sign(tresc, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Weryfikuje podpis i ważność tokenu.
 *
 * Token pozostaje ważny do czasu wygaśnięcia — bez rejestru tokenów odwołanych
 * nie da się unieważnić pojedynczego. Kompromis przyjęty świadomie i opisany
 * w dokumentacji; przy wdrożeniu produkcyjnym wymagałby uzupełnienia.
 */
export function odczytajToken(token: string): TrescTokenu {
  try {
    return jwt.verify(token, env.jwtSecret) as TrescTokenu;
  } catch {
    throw new BladZadania(401, 'Token jest nieważny lub wygasł');
  }
}
