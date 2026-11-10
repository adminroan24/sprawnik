BEGIN;

-- Jedna organizacja w tej instalacji. Własność spraw pozostaje przy użytkownikach.
CREATE TABLE profil_firmy (
  id smallint PRIMARY KEY CHECK (id = 1),
  nazwa text NOT NULL CHECK (length(btrim(nazwa)) BETWEEN 1 AND 200),
  nip text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefon text NOT NULL DEFAULT '',
  adres text NOT NULL DEFAULT '',
  strona_www text NOT NULL DEFAULT '',
  zmieniono timestamptz NOT NULL DEFAULT now()
);
INSERT INTO profil_firmy(id, nazwa) VALUES (1, 'Organizacja');

CREATE TABLE grupa_spraw (
  id bigserial PRIMARY KEY,
  rodzic_id bigint REFERENCES grupa_spraw(id) ON DELETE RESTRICT,
  nazwa text NOT NULL CHECK (length(btrim(nazwa)) BETWEEN 1 AND 150),
  kolejnosc integer NOT NULL DEFAULT 0,
  CHECK (rodzic_id IS NULL OR rodzic_id <> id)
);
CREATE UNIQUE INDEX grupa_nazwa_w_rodzicu_idx ON grupa_spraw(coalesce(rodzic_id, 0), lower(nazwa));
CREATE INDEX grupa_rodzic_idx ON grupa_spraw(rodzic_id);
ALTER TABLE sprawa ADD COLUMN grupa_id bigint REFERENCES grupa_spraw(id) ON DELETE RESTRICT;
CREATE INDEX sprawa_grupa_idx ON sprawa(grupa_id);

COMMIT;
