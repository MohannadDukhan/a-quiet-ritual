export const DEFAULT_TIME_ZONE = "America/New_York";
export const TIME_ZONE_COOKIE_NAME = "bw_tz";

type DateInput = Date | string;

function parseDate(input: DateInput): Date | null {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (isValidTimeZone(timeZone)) {
    return timeZone;
  }
  return DEFAULT_TIME_ZONE;
}

function safeFormat(
  input: DateInput,
  options: Intl.DateTimeFormatOptions,
  timeZone?: string,
): string {
  const date = parseDate(input);
  if (!date) {
    return "";
  }

  const resolvedTimeZone = resolveTimeZone(timeZone);
  try {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: resolvedTimeZone,
    })
      .format(date)
      .toLowerCase();
  } catch {
    try {
      return new Intl.DateTimeFormat("en-US", {
        ...options,
        timeZone: DEFAULT_TIME_ZONE,
      })
        .format(date)
        .toLowerCase();
    } catch {
      return "";
    }
  }
}

export function formatDateTime(input: DateInput, timeZone?: string): string {
  return safeFormat(
    input,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
    timeZone,
  );
}

export function formatDate(input: DateInput, timeZone?: string): string {
  return safeFormat(
    input,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
    timeZone,
  );
}

export function formatTime(input: DateInput, timeZone?: string): string {
  return safeFormat(
    input,
    {
      hour: "numeric",
      minute: "2-digit",
    },
    timeZone,
  );
}
