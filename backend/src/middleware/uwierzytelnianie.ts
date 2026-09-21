import type { NextFunction, Request, Response } from 'express';
import { BladZadania, bladUprawnien } from './errors.js';
import { odczytajToken } from '../services/uwierzytelnianie.js';
import * as uzytkownicy from '../db/uzytkownicy.js';
import type { Uzytkownik } from '../db/uzytkownicy.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Uzupełniane przez `wymagaZalogowania`. Trasy chronione mogą na nim polegać. */
      uzytkownik?: Uzytkownik;
    }
  }
}

/**
 * Sprawdza tożsamość przed obsługą żądania. Uruchamiane jako osobne ogniwo,
 * a nie fragment logiki tras — dzięki temu żadna trasa chroniona nie może
 * pominąć sprawdzenia przez przeoczenie.
 */
export async function wymagaZalogowania(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const naglowek = req.header('authorization') ?? '';
    const [schemat, token] = naglowek.split(' ');
    if (schemat !== 'Bearer' || !token) {
      throw new BladZadania(401, 'Wymagane uwierzytelnienie');
    }

    const tresc = odczytajToken(token);

    // Konto sprawdzane jest przy każdym żądaniu, bo token wystawiony przed
    // zablokowaniem konta nadal ma poprawny podpis.
    const uzytkownik = await uzytkownicy.znajdzPoId(tresc.id);
    if (!uzytkownik || !uzytkownik.aktywny) {
      throw new BladZadania(401, 'Konto nie istnieje lub zostało zablokowane');
    }

    req.uzytkownik = uzytkownik;
    next();
  } catch (blad) {
    next(blad);
  }
}

/** Operacje konfiguracyjne — reguły terminów i konta — zastrzeżone dla administratora. */
export function wymagaAdministratora(req: Request, _res: Response, next: NextFunction): void {
  if (req.uzytkownik?.rola !== 'administrator') {
    next(bladUprawnien());
    return;
  }
  next();
}

/** Zwraca zalogowanego użytkownika albo zgłasza błąd — upraszcza trasy chronione. */
export function zalogowany(req: Request): Uzytkownik {
  if (!req.uzytkownik) {
    throw new BladZadania(401, 'Wymagane uwierzytelnienie');
  }
  return req.uzytkownik;
}
