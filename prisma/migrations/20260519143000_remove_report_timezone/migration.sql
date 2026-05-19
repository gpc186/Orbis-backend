WITH local_reference AS (
    SELECT NOW() AT TIME ZONE 'America/Sao_Paulo' AS local_now
),
daily_targets AS (
    SELECT
        r."id",
        CASE
            WHEN date_trunc('day', ref.local_now) + make_interval(hours => r."hora", mins => r."minuto") > ref.local_now
                THEN date_trunc('day', ref.local_now) + make_interval(hours => r."hora", mins => r."minuto")
            ELSE date_trunc('day', ref.local_now) + interval '1 day' + make_interval(hours => r."hora", mins => r."minuto")
        END AS next_local_run
    FROM "RelatorioAgendamento" r
    CROSS JOIN local_reference ref
    WHERE r."frequencia" = 'DIARIO'
),
weekly_targets AS (
    SELECT
        r."id",
        CASE
            WHEN r.candidate_local > ref.local_now THEN r.candidate_local
            ELSE r.candidate_local + interval '7 day'
        END AS next_local_run
    FROM (
        SELECT
            base."id",
            date_trunc('day', ref.local_now)
                + make_interval(
                    days => ((base."diaSemana" - EXTRACT(DOW FROM ref.local_now)::int + 7) % 7),
                    hours => base."hora",
                    mins => base."minuto"
                ) AS candidate_local
        FROM "RelatorioAgendamento" base
        CROSS JOIN local_reference ref
        WHERE base."frequencia" = 'SEMANAL'
    ) r
    CROSS JOIN local_reference ref
),
monthly_targets AS (
    SELECT
        r."id",
        CASE
            WHEN r.current_candidate_local > r.local_now THEN r.current_candidate_local
            ELSE r.next_candidate_local
        END AS next_local_run
    FROM (
        SELECT
            base."id",
            ref.local_now,
            date_trunc('month', ref.local_now)
                + make_interval(
                    days => LEAST(
                        base."diaMes",
                        EXTRACT(DAY FROM (date_trunc('month', ref.local_now) + interval '1 month - 1 day'))::int
                    ) - 1,
                    hours => base."hora",
                    mins => base."minuto"
                ) AS current_candidate_local,
            date_trunc('month', ref.local_now + interval '1 month')
                + make_interval(
                    days => LEAST(
                        base."diaMes",
                        EXTRACT(DAY FROM (date_trunc('month', ref.local_now + interval '1 month') + interval '1 month - 1 day'))::int
                    ) - 1,
                    hours => base."hora",
                    mins => base."minuto"
                ) AS next_candidate_local
        FROM "RelatorioAgendamento" base
        CROSS JOIN local_reference ref
        WHERE base."frequencia" = 'MENSAL'
    ) r
),
all_targets AS (
    SELECT "id", next_local_run FROM daily_targets
    UNION ALL
    SELECT "id", next_local_run FROM weekly_targets
    UNION ALL
    SELECT "id", next_local_run FROM monthly_targets
)
UPDATE "RelatorioAgendamento" ag
SET "proximoEnvioEm" = timezone('UTC', all_targets.next_local_run AT TIME ZONE 'America/Sao_Paulo')
FROM all_targets
WHERE ag."id" = all_targets."id";

ALTER TABLE "RelatorioAgendamento"
DROP COLUMN "timezone";