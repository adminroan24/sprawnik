BEGIN;

-- Wspólna książka jednej organizacji. Nie rozszerza dostępu do spraw.
CREATE TABLE kontakt (
  id bigserial PRIMARY KEY,
  typ text NOT NULL CHECK (typ IN ('osoba', 'firma', 'instytucja')),
  nazwa text NOT NULL CHECK (length(btrim(nazwa)) BETWEEN 1 AND 200),
  nip text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefon text NOT NULL DEFAULT '',
  adres text NOT NULL DEFAULT '',
  adres_edoreczen text NOT NULL DEFAULT '',
  skrzynka_epuap text NOT NULL DEFAULT '',
  osoba_kontaktowa text NOT NULL DEFAULT '',
  notatka text NOT NULL DEFAULT '',
  aktywny boolean NOT NULL DEFAULT true,
  utworzono timestamptz NOT NULL DEFAULT now(),
  zmieniono timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kontakt_nazwa_idx ON kontakt(lower(nazwa));
ALTER TABLE pismo ADD COLUMN kontakt_id bigint REFERENCES kontakt(id) ON DELETE RESTRICT;
ALTER TABLE pismo ADD COLUMN dane_korespondenta jsonb;
ALTER TABLE pismo ADD CONSTRAINT pismo_kontakt_ma_kopie CHECK (
  (kontakt_id IS NULL AND dane_korespondenta IS NULL) OR
  (kontakt_id IS NOT NULL AND dane_korespondenta IS NOT NULL AND jsonb_typeof(dane_korespondenta) = 'object')
);
CREATE INDEX pismo_kontakt_idx ON pismo(kontakt_id);
COMMENT ON COLUMN pismo.dane_korespondenta IS 'Kopia danych kontaktowych w chwili rejestracji pisma. Zmiana książki nie zmienia historii.';

COMMIT;
