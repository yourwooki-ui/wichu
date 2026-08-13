export type ProfilePresence =
  { kind: 'online'; count?: never } | { kind: 'minutes' | 'hours' | 'days'; count: number };

export function getProfileAge(birthDate: string, now = Date.now()) {
  const today = new Date(now);
  const birthday = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - birthday.getFullYear();
  const hasNotHadBirthday =
    today.getMonth() < birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() && today.getDate() < birthday.getDate());

  if (hasNotHadBirthday) age -= 1;
  return age;
}

export function getProfilePresence(
  lastActiveAt: string | null,
  now = Date.now(),
): ProfilePresence | null {
  if (!lastActiveAt) return null;

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(lastActiveAt).getTime()) / (60 * 1000)),
  );

  if (elapsedMinutes <= 5) return { kind: 'online' };
  if (elapsedMinutes < 60) return { kind: 'minutes', count: elapsedMinutes };

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return { kind: 'hours', count: elapsedHours };

  return { kind: 'days', count: Math.min(Math.floor(elapsedHours / 24), 7) };
}
