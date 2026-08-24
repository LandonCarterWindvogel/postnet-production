// Machine-time estimates for the BN-20 production portion only.
// These anchors are based on the client's observed Print + Cut timings.
// They deliberately exclude drying, weeding, heat pressing, QC, queue time, and design.

const STICKER_ANCHORS = [
  { width: 50, height: 50, quantity: 100, minutes: 37.5 },
  { width: 50, height: 50, quantity: 500, minutes: 180 },
  { width: 100, height: 50, quantity: 100, minutes: 50 },
  { width: 100, height: 50, quantity: 500, minutes: 270 },
  { width: 200, height: 100, quantity: 100, minutes: 150 }
];

const FLEX_ANCHORS = [
  { width: 100, height: 100, quantity: 10, minutes: 17.5 },
  { width: 200, height: 200, quantity: 10, minutes: 52.5 },
  { width: 200, height: 200, quantity: 25, minutes: 120 },
  { width: 300, height: 300, quantity: 25, minutes: 225 }
];

function distance(anchor, width, height, quantity) {
  const areaRatio = Math.max((width * height) / (anchor.width * anchor.height), 0.01);
  const quantityRatio = Math.max(quantity / anchor.quantity, 0.01);
  return Math.sqrt((Math.log(areaRatio) ** 2) * 0.65 + (Math.log(quantityRatio) ** 2) * 0.35);
}

export function estimateMachineMinutes({ type = 'stickers', width, height, quantity }) {
  const w = Number(width);
  const h = Number(height);
  const q = Number(quantity);
  if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isInteger(q) || w <= 0 || h <= 0 || q <= 0) return null;

  const anchors = type === 'flex' ? FLEX_ANCHORS : STICKER_ANCHORS;
  const ranked = anchors
    .map((anchor) => ({ anchor, distance: distance(anchor, w, h, q) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2);

  const estimates = ranked.map(({ anchor, distance: d }) => {
    const areaRatio = Math.max((w * h) / (anchor.width * anchor.height), 0.01);
    const quantityRatio = Math.max(q / anchor.quantity, 0.01);
    const scaled = anchor.minutes * (areaRatio ** 0.55) * (quantityRatio ** 0.80);
    return { minutes: scaled, weight: 1 / Math.max(d, 0.05) };
  });

  const totalWeight = estimates.reduce((sum, item) => sum + item.weight, 0);
  const weighted = estimates.reduce((sum, item) => sum + item.minutes * item.weight, 0) / totalWeight;
  return Math.max(5, Math.round(weighted * 2) / 2);
}

export function formatMachineTime(minutes) {
  if (!Number.isFinite(minutes)) return '—';
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}
