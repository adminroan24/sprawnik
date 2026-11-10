-- Rozszerzenie istniejących danych bez ich usuwania.
BEGIN;

ALTER TABLE pismo ADD COLUMN kanal text;
ALTER TABLE pismo ADD COLUMN numer_nadania text;
ALTER TABLE pismo ADD COLUMN odpowiedz_na_pismo_id bigint;
ALTER TABLE pismo ADD CONSTRAINT pismo_kanal_poprawny CHECK (
  kanal IS NULL OR kanal IN ('email', 'edoreczenia', 'epuap', 'poczta', 'osobiscie', 'inne')
);
ALTER TABLE pismo ADD CONSTRAINT pismo_id_sprawa_unique UNIQUE (id, sprawa_id);
ALTER TABLE pismo ADD CONSTRAINT pismo_odpowiedz_w_tej_samej_sprawie
  FOREIGN KEY (odpowiedz_na_pismo_id, sprawa_id) REFERENCES pismo (id, sprawa_id);
ALTER TABLE pismo ADD CONSTRAINT pismo_nie_odpowiada_sobie
  CHECK (odpowiedz_na_pismo_id IS NULL OR odpowiedz_na_pismo_id <> id);
CREATE INDEX pismo_odpowiedz_idx ON pismo (odpowiedz_na_pismo_id);

ALTER TABLE dokument ADD COLUMN rola text NOT NULL DEFAULT 'zalacznik';
ALTER TABLE dokument ADD CONSTRAINT dokument_rola_poprawna CHECK (
  rola IN ('tresc', 'zalacznik', 'dowod_nadania', 'potwierdzenie_odbioru')
);

CREATE TABLE dokument_ocr (
  dokument_id bigint PRIMARY KEY REFERENCES dokument (id) ON DELETE CASCADE,
  tekst text NOT NULL,
  jezyki text NOT NULL,
  liczba_stron integer NOT NULL CHECK (liczba_stron > 0),
  wykonano timestamptz NOT NULL DEFAULT now()
);

COMMIT;
