const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidBirthDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isAdult(value: string, today = new Date()) {
  if (!isValidBirthDate(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const cutoff = new Date(
    Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()),
  );
  return new Date(Date.UTC(year, month - 1, day)) <= cutoff;
}
