function cloneDate(date) {
  return new Date(date.getTime());
}

function getLastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function setTime(date, hour, minute) {
  const next = cloneDate(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function computeNextDailyRun({ hour, minute }, now = new Date()) {
  let candidate = setTime(now, hour, minute);

  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
}

function computeNextWeeklyRun({ hour, minute, dayOfWeek }, now = new Date()) {
  let candidate = setTime(now, hour, minute);
  const today = candidate.getDay();
  let offset = dayOfWeek - today;

  if (offset < 0) {
    offset += 7;
  }

  candidate.setDate(candidate.getDate() + offset);

  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return candidate;
}

function computeNextMonthlyRun({ hour, minute, dayOfMonth }, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = getLastDayOfMonth(year, month);
  const clampedDay = Math.min(dayOfMonth, lastDay);

  let candidate = new Date(year, month, clampedDay, hour, minute, 0, 0);

  if (candidate <= now) {
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const normalizedMonth = nextMonth > 11 ? 0 : nextMonth;
    const nextLastDay = getLastDayOfMonth(nextYear, normalizedMonth);
    const nextClampedDay = Math.min(dayOfMonth, nextLastDay);
    candidate = new Date(nextYear, normalizedMonth, nextClampedDay, hour, minute, 0, 0);
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
  computeNextRun
};
