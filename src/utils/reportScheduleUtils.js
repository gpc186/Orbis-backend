const REPORT_TIMEZONE = "America/Sao_Paulo";

function buildFormatter(extraOptions = {}) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...extraOptions
  });
}

function buildApiDateTimeFormatter() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
}

function toNumberMap(parts) {
  return parts.reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = Number(part.value);
    }
    return acc;
  }, {});
}

function getLocalDateTimeParts(date = new Date()) {
  return toNumberMap(buildFormatter().formatToParts(date));
}

function getLocalDateParts(date = new Date()) {
  const { year, month, day } = getLocalDateTimeParts(date);
  return { year, month, day };
}

function toUtcDate(parts) {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour || 0,
      parts.minute || 0,
      parts.second || 0,
      0
    )
  );
}

function zonedDateTimeToUtc(parts) {
  let guess = toUtcDate(parts);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const zoned = getLocalDateTimeParts(guess);
    const diffMs = toUtcDate(parts).getTime() - toUtcDate(zoned).getTime();

    if (diffMs === 0) {
      return new Date(guess.getTime() + (parts.millisecond || 0));
    }

    guess = new Date(guess.getTime() + diffMs);
  }

  return new Date(guess.getTime() + (parts.millisecond || 0));
}

function addDaysToLocalDate(localDate, days) {
  const date = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day + days));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function getLastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getLocalDayOfWeek(localDate) {
  return new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day)).getUTCDay();
}

function buildCandidateDate(localDate, hour, minute) {
  return zonedDateTimeToUtc({
    ...localDate,
    hour,
    minute,
    second: 0,
    millisecond: 0
  });
}

function computeNextDailyRun({ hour, minute }, now = new Date()) {
  let candidateLocalDate = getLocalDateParts(now);
  let candidate = buildCandidateDate(candidateLocalDate, hour, minute);

  if (candidate <= now) {
    candidateLocalDate = addDaysToLocalDate(candidateLocalDate, 1);
    candidate = buildCandidateDate(candidateLocalDate, hour, minute);
  }

  return candidate;
}

function computeNextWeeklyRun({ hour, minute, dayOfWeek }, now = new Date()) {
  const localNowDate = getLocalDateParts(now);
  const today = getLocalDayOfWeek(localNowDate);
  let offset = dayOfWeek - today;

  if (offset < 0) {
    offset += 7;
  }

  let candidateLocalDate = addDaysToLocalDate(localNowDate, offset);
  let candidate = buildCandidateDate(candidateLocalDate, hour, minute);

  if (candidate <= now) {
    candidateLocalDate = addDaysToLocalDate(candidateLocalDate, 7);
    candidate = buildCandidateDate(candidateLocalDate, hour, minute);
  }

  return candidate;
}

function computeNextMonthlyRun({ hour, minute, dayOfMonth }, now = new Date()) {
  const localNowDate = getLocalDateParts(now);
  const clampedDay = Math.min(dayOfMonth, getLastDayOfMonth(localNowDate.year, localNowDate.month));

  let candidateLocalDate = {
    year: localNowDate.year,
    month: localNowDate.month,
    day: clampedDay
  };
  let candidate = buildCandidateDate(candidateLocalDate, hour, minute);

  if (candidate <= now) {
    const nextMonth = localNowDate.month === 12 ? 1 : localNowDate.month + 1;
    const nextYear = localNowDate.month === 12 ? localNowDate.year + 1 : localNowDate.year;
    const nextClampedDay = Math.min(dayOfMonth, getLastDayOfMonth(nextYear, nextMonth));

    candidateLocalDate = {
      year: nextYear,
      month: nextMonth,
      day: nextClampedDay
    };
    candidate = buildCandidateDate(candidateLocalDate, hour, minute);
  }

  return candidate;
}

function computeNextRun(scheduleConfig, now = new Date()) {
  const frequency = scheduleConfig.frequencia;

  if (frequency === "DIARIO") {
    return computeNextDailyRun(
      { hour: scheduleConfig.hora, minute: scheduleConfig.minuto },
      now
    );
  }

  if (frequency === "SEMANAL") {
    return computeNextWeeklyRun(
      {
        hour: scheduleConfig.hora,
        minute: scheduleConfig.minuto,
        dayOfWeek: scheduleConfig.diaSemana
      },
      now
    );
  }

  if (frequency === "MENSAL") {
    return computeNextMonthlyRun(
      {
        hour: scheduleConfig.hora,
        minute: scheduleConfig.minuto,
        dayOfMonth: scheduleConfig.diaMes
      },
      now
    );
  }

  throw new Error("Unsupported report schedule frequency.");
}

function formatReportDateTime(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = toNumberMap(buildApiDateTimeFormatter().formatToParts(date));
  const offsetMinutes = Math.round((toUtcDate(parts).getTime() - date.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffsetMinutes / 60)).padStart(2, "0");
  const offsetRemainderMinutes = String(absoluteOffsetMinutes % 60).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}.${milliseconds}${sign}${offsetHours}:${offsetRemainderMinutes}`;
}

function buildScheduleDescription(scheduleConfig) {
  if (scheduleConfig.frequencia === "DIARIO") {
    return `Diario as ${String(scheduleConfig.hora).padStart(2, "0")}:${String(scheduleConfig.minuto).padStart(2, "0")}`;
  }

  if (scheduleConfig.frequencia === "SEMANAL") {
    return `Semanal no dia ${scheduleConfig.diaSemana} as ${String(scheduleConfig.hora).padStart(2, "0")}:${String(scheduleConfig.minuto).padStart(2, "0")}`;
  }

  if (scheduleConfig.frequencia === "MENSAL") {
    return `Mensal no dia ${scheduleConfig.diaMes} as ${String(scheduleConfig.hora).padStart(2, "0")}:${String(scheduleConfig.minuto).padStart(2, "0")}`;
  }

  return "Agendamento invalido";
}

module.exports = {
  buildScheduleDescription,
  computeNextRun,
  formatReportDateTime,
  REPORT_TIMEZONE
};
