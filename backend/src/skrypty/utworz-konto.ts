/**
 * Utworzenie konta z wiersza poleceń.
 *
 * Konta nie powstają przez publiczną rejestrację: system obsługuje sprawy
 * konkretnych osób, a nie dowolnych odwiedzających. Pierwsze konto musi więc
 * powstać poza aplikacją, kolejne zakłada administrator (UC13).
 *
 * Użycie: npm run konto -- <e-mail> <hasło> "<imię i nazwisko>" [rola]
 */

import * as uzytkownicy from '../db/uzytkownicy.js';
import { zahaszujHaslo } from '../services/uwierzytelnianie.js';
import { closePool } from '../db/pool.js';
import type { Rola } from '../db/uzytkownicy.js';

const [email, haslo, imieNazwisko, rola = 'uzytkownik'] = process.argv.slice(2);

if (!email || !haslo || !imieNazwisko) {
  console.error('Użycie: npm run konto -- <e-mail> <hasło> "<imię i nazwisko>" [uzytkownik|administrator]');
  process.exit(1);
}

if (rola !== 'uzytkownik' && rola !== 'administrator') {
  console.error(`Nieznana rola: ${rola}`);
  process.exit(1);
}

if (haslo.length < 8) {
  console.error('Hasło musi mieć co najmniej 8 znaków');
  process.exit(1);
}

try {
  if (await uzytkownicy.znajdzPoEmailu(email)) {
    console.error(`Konto o adresie ${email} już istnieje`);
    process.exit(1);
  }

  const utworzony = await uzytkownicy.dodaj({
    email,
    hasloHash: await zahaszujHaslo(haslo),
    imieNazwisko,
    rola: rola as Rola,
  });

  console.log(`Utworzono konto: ${utworzony.email} (${utworzony.rola})`);
} finally {
  await closePool();
}
