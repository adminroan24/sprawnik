import { pool } from './pool.js';
import type { SprawaDoDopasowania } from '../services/dopasowanie.js';

export async function sprawyUzytkownika(uzytkownikId: number) {
  const { rows } = await pool.query<SprawaDoDopasowania>(
    `SELECT s.id, s.tytul, s.znak_wlasny AS "znakWlasny", s.organ,
       coalesce(array_agg(DISTINCT p.znak_pisma) FILTER (WHERE p.znak_pisma IS NOT NULL), '{}') AS "znakiPism"
     FROM sprawa s LEFT JOIN pismo p ON p.sprawa_id = s.id
     WHERE s.uzytkownik_id = $1 GROUP BY s.id ORDER BY s.utworzono DESC`, [uzytkownikId],
  );
  return rows;
}
