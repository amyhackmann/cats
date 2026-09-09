const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  }
});

const EMPTY = () => json({ ok: true, rows: [] });

function validDate(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function validInitials(v) {
  return typeof v === "string" && /^[A-Z]{3}$/.test(v);
}

function validPid(v) {
  return typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v);
}

function intOrNull(v) {
  return v === null || v === undefined || v === ""
    ? null
    : Number.isInteger(Number(v))
      ? Number(v)
      : null;
}

function clampInt(v, min, max, fallback = 0) {
  const n = intOrNull(v);
  return n === null ? fallback : Math.max(min, Math.min(max, n));
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const allowed = origin && origin === new URL(request.url).origin ? origin : "";

  return allowed ? {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  } : {};
}

function withCors(response, request) {
  const headers = new Headers(response.headers);

  for (const [k, v] of Object.entries(corsHeaders(request))) {
    headers.set(k, v);
  }

  return new Response(response.body, {
    status: response.status,
    headers
  });
}

export async function onRequestOptions({ request }) {
  return withCors(
    new Response(null, { status: 204 }),
    request
  );
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") || "day";
    const db = env.DB;

    if (!db) {
      return withCors(
        json({
          ok: false,
          error: "D1 binding DB is missing."
        }, 500),
        request
      );
    }

    let result;

    if (tab === "day") {
      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");

      if (!validDate(start) || !validDate(end)) {
        return withCors(
          json({
            ok: false,
            error: "start and end must be YYYY-MM-DD."
          }, 400),
          request
        );
      }

      result = await db.prepare(`
        WITH ranked AS (
          SELECT
            run_id, d, p, b, s, l, x, ms, i, w, m, pid,
            ROW_NUMBER() OVER (
              PARTITION BY d
              ORDER BY b ASC, ms ASC, s DESC
            ) AS rn
          FROM scores
          WHERE m = 'daily'
            AND d BETWEEN ? AND ?
        )
        SELECT
          run_id, d, p, b, s, l, x, ms, i, w, m, pid
        FROM ranked
        WHERE rn <= CASE WHEN d = ? THEN 10 ELSE 5 END
        ORDER BY d DESC, b ASC, ms ASC, s DESC
      `).bind(start, end, end).all();

    } else if (tab === "week") {
      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");

      if (!validDate(start) || !validDate(end)) {
        return withCors(
          json({
            ok: false,
            error: "start and end must be YYYY-MM-DD."
          }, 400),
          request
        );
      }

      result = await db.prepare(`
        WITH ranked AS (
          SELECT
            run_id, d, p, b, s, l, x, ms, i, w, m, pid,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(NULLIF(pid, ''), 'i:' || i)
              ORDER BY b ASC, ms ASC, s DESC
            ) AS rn
          FROM scores
          WHERE m = 'daily'
            AND d BETWEEN ? AND ?
        )
        SELECT
          run_id, d, p, b, s, l, x, ms, i, w, m, pid
        FROM ranked
        WHERE rn = 1
        ORDER BY b ASC, ms ASC, s DESC
        LIMIT 25
      `).bind(start, end).all();

    } else if (tab === "hof") {
      result = await db.prepare(`
        WITH ranked AS (
          SELECT
            run_id, d, p, b, s, l, x, ms, i, w, m, pid,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(NULLIF(pid, ''), 'i:' || i)
              ORDER BY b ASC, ms ASC, s DESC
            ) AS rn
          FROM scores
          WHERE m = 'daily'
        )
        SELECT
          run_id, d, p, b, s, l, x, ms, i, w, m, pid
        FROM ranked
        WHERE rn = 1
        ORDER BY b ASC, ms ASC, s DESC
        LIMIT 25
      `).all();

    } else if (tab === "endless") {
      result = await db.prepare(`
        WITH ranked AS (
          SELECT
            run_id, d, p, b, s, l, x, ms, i, w, m, pid,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(NULLIF(pid, ''), 'i:' || i)
              ORDER BY s DESC, ms ASC
            ) AS rn
          FROM scores
          WHERE m = 'endless'
        )
        SELECT
          run_id, d, p, b, s, l, x, ms, i, w, m, pid
        FROM ranked
        WHERE rn = 1
        ORDER BY s DESC, ms ASC
        LIMIT 25
      `).all();

    } else {
      return withCors(
        json({
          ok: false,
          error: "Unknown leaderboard tab."
        }, 400),
        request
      );
    }

    return withCors(
      json({
        ok: true,
        rows: result.results || []
      }),
      request
    );

  } catch (err) {
    return withCors(
      json({
        ok: false,
        error: "Leaderboard read failed."
      }, 500),
      request
    );
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const db = env.DB;

    if (!db) {
      return withCors(
        json({
          ok: false,
          error: "D1 binding DB is missing."
        }, 500),
        request
      );
    }

    const body = await request.json();

    const runId =
      typeof body.run_id === "string"
        ? body.run_id.slice(0, 80)
        : "";

    const mode =
      body.m === "endless"
        ? "endless"
        : body.m === "daily"
          ? "daily"
          : "";

    const d = body.d;

    const i =
      typeof body.i === "string"
        ? body.i
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .slice(0, 3)
        : "";

    const submittedPid =
      validPid(body.pid)
        ? body.pid
        : null;

    if (!runId || !mode || !validDate(d) || !validInitials(i)) {
      return withCors(
        json({
          ok: false,
          error: "Invalid score."
        }, 400),
        request
      );
    }

    const p =
      mode === "daily"
        ? clampInt(body.p, 0, 100, 0)
        : null;

    const b =
      mode === "daily"
        ? clampInt(body.b, 0, 100, 0)
        : null;

    const s =
      clampInt(body.s, 0, 100000, 0);

    const l =
      mode === "daily"
        ? clampInt(body.l, 0, 100, 0)
        : null;

    const x =
      clampInt(body.x, 0, 10000, 0);

    const ms =
      clampInt(body.ms, 0, 86400000, 0);

    const w =
      mode === "daily" && body.w
        ? 1
        : 0;

    /*
     * ============================================================
     * LEGACY PID BACKFILL
     * ============================================================
     *
     * pid_backfill holds the 70 run_ids that had no PID as of
     * 2026-09-08, when the PID build shipped. Players still on a
     * cached pre-PID build kept saving nulls; when they load a
     * fresh build and submit, their old runs get claimed so their
     * history joins up on Weekly / HOF / Endless.
     *
     * Only rows in that frozen set are ever touched. Nothing saved
     * after the table was populated is eligible, and no row that
     * already has a PID is rewritten.
     *
     * When pid_backfill stops shrinking, drop this block and the
     * table.
     */

    if (submittedPid) {
      await db.prepare(`
        UPDATE scores
        SET pid = ?
        WHERE i = ?
          AND (pid IS NULL OR pid = '')
          AND run_id IN (
            SELECT run_id FROM pid_backfill WHERE i = ?
          )
      `).bind(
        submittedPid,
        i,
        i
      ).run();
    }

    /*
     * ============================================================
     * SAVE SCORE
     * ============================================================
     *
     * Reusing a run_id updates the existing row rather than
     * creating a duplicate.
     */

    await db.prepare(`
      INSERT INTO scores
        (run_id, d, p, b, s, l, x, ms, i, w, m, pid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

      ON CONFLICT(run_id) DO UPDATE SET
        d = excluded.d,
        p = excluded.p,
        b = excluded.b,
        s = excluded.s,
        l = excluded.l,
        x = excluded.x,
        ms = excluded.ms,
        i = excluded.i,
        w = excluded.w,
        m = excluded.m,
        pid = COALESCE(excluded.pid, pid)
    `).bind(
      runId,
      d,
      p,
      b,
      s,
      l,
      x,
      ms,
      i,
      w,
      mode,
      submittedPid
    ).run();

    return withCors(
      json({ ok: true }),
      request
    );

  } catch (err) {
    return withCors(
      json({
        ok: false,
        error: "Score save failed."
      }, 500),
      request
    );
  }
}
