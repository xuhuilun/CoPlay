const guestIdKey = "coplay.guestId";
const nicknameKey = "coplay.nickname";

export function getGuestId(): string {
  const existing = localStorage.getItem(guestIdKey);
  if (existing) {
    return existing;
  }
  const next = `guest_${crypto.randomUUID().slice(0, 8)}`;
  localStorage.setItem(guestIdKey, next);
  return next;
}

export function getNickname(): string {
  const existing = localStorage.getItem(nicknameKey);
  if (existing) {
    return existing;
  }
  const next = `游客${Math.floor(Math.random() * 900 + 100)}`;
  localStorage.setItem(nicknameKey, next);
  return next;
}

export function setNickname(nickname: string): string {
  const next = nickname.trim().slice(0, 24) || getNickname();
  localStorage.setItem(nicknameKey, next);
  return next;
}
