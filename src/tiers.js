// Limits per version, enforced by the server (Channel + Quota). The page has the same numbers in TIERS
// (public/index.html) only to explain limits before the server refuses; keep both in sync.
export const TIERS = {
  web: { channels: 1, turnSec: 20, talksPerDay: 25, chatPerDay: 0 },
  basic: { channels: 3, turnSec: 60, talksPerDay: Infinity, chatPerDay: 5 },
  plus: { channels: 10, turnSec: 60, talksPerDay: Infinity, chatPerDay: 50 },
  pro: { channels: 25, turnSec: 60, talksPerDay: Infinity, chatPerDay: Infinity },
};

// The free web version has no proof of identity, so a device id alone is not enough: on top of the
// per-device limits, everything from one IP address together gets at most this many devices' worth.
export const WEB_PER_IP = 4;
