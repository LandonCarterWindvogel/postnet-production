// V1 BN-20 machine-time estimator.
// Keep the assumptions centralized so real VersaWorks timings can replace them
// later without changing the database or production workflow.

const INCH_TO_MM = 25.4;
const SQ_FT_PER_SQ_M = 10.7639104167;

export const MACHINE_TIME_CONFIG = {
  machineWidthMm: 460,

  // Starting production assumption: BN-20 High Quality at 10 ft²/hour.
  highQualityPrintSqFtPerHour: 10,

  // Existing production rule for sticker spacing.
  packingGapMm: 2,

  // Conservative V1 cutting allowances. Calibrate against the real BN-20.
  stickerCutSetupMinutes: 1,
  stickerCutMinutesPerLinearMetre: 0.75,
  flexCutSetupMinutes: 1,
  flexCutMinutesPerLinearMetre: 1.25
};

function toMillimetres(value, unit = 'mm') {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;

  switch (unit.toLowerCase()) {
    case 'm': return number * 1000;
    case 'cm': return number * 10;
    case 'in':
    case 'inch':
    case 'inches': return number * INCH_TO_MM;
    case 'mm':
    default: return number;
  }
}

export function parseSpecification(specification) {
  if (typeof specification !== 'string') return null;

  const match = specification.trim().match(
    /(\d+(?:\.\d+)?)\s*(mm|cm|in(?:ch(?:es)?)?|m)?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(mm|cm|in(?:ch(?:es)?)?|m)?/i
  );

  if (!match) return null;

  const unit = match[2] || match[4] || 'mm';
  const widthMm = toMillimetres(match[1], match[2] || unit);
  const heightMm = toMillimetres(match[3], match[4] || unit);

  if (!widthMm || !heightMm) return null;
  return { widthMm, heightMm };
}

function packOnRoll(widthMm, heightMm, quantity) {
  const mediaWidth = MACHINE_TIME_CONFIG.machineWidthMm;
  const gap = MACHINE_TIME_CONFIG.packingGapMm;

  const orientations = [
    { itemWidth: widthMm, itemHeight: heightMm },
    { itemWidth: heightMm, itemHeight: widthMm }
  ];

  const candidates = orientations
    .filter(({ itemWidth }) => itemWidth <= mediaWidth)
    .map(({ itemWidth, itemHeight }) => {
      const columns = Math.max(1, Math.floor((mediaWidth + gap) / (itemWidth + gap)));
      const rows = Math.ceil(quantity / columns);
      const usedColumns = Math.min(columns, quantity);
      const usedWidth = usedColumns * itemWidth + Math.max(0, usedColumns - 1) * gap;
      const usedLength = rows * itemHeight + Math.max(0, rows - 1) * gap;

      return {
        columns,
        rows,
        usedWidth,
        usedLength,
        areaMm2: usedWidth * usedLength
      };
    });

  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.areaMm2 - b.areaMm2)[0];
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 1) return '<1 min';
  return `${Math.max(1, Math.round(minutes))} min`;
}

export function estimateMachineTime({ jobType, specification, quantity, cutlinesIncluded = false }) {
  const parsed = parseSpecification(specification);
  const safeQuantity = Math.max(1, Number(quantity) || 1);

  if (!parsed) {
    return {
      available: false,
      minutes: null,
      display: 'Enter a size such as 90 × 50 mm',
      reason: 'A two-dimensional size is required for the V1 estimate.'
    };
  }

  const packed = packOnRoll(parsed.widthMm, parsed.heightMm, safeQuantity);
  if (!packed) {
    return {
      available: false,
      minutes: null,
      display: 'Size exceeds 460 mm media width',
      reason: 'Rotate the artwork or split it before production.'
    };
  }

  const areaM2 = packed.areaMm2 / 1_000_000;
  const printMinutesPerM2 = 60 / (MACHINE_TIME_CONFIG.highQualityPrintSqFtPerHour / SQ_FT_PER_SQ_M);
  const printMinutes = jobType === 'stickers' ? areaM2 * printMinutesPerM2 : 0;
  const linearMetres = packed.usedLength / 1000;

  let machineMinutes;

  if (jobType === 'flex') {
    machineMinutes = MACHINE_TIME_CONFIG.flexCutSetupMinutes
      + linearMetres * MACHINE_TIME_CONFIG.flexCutMinutesPerLinearMetre;
  } else {
    const cutMinutes = cutlinesIncluded
      ? MACHINE_TIME_CONFIG.stickerCutSetupMinutes
        + linearMetres * MACHINE_TIME_CONFIG.stickerCutMinutesPerLinearMetre
      : 0;

    machineMinutes = printMinutes + cutMinutes;
  }

  return {
    available: true,
    minutes: machineMinutes,
    display: `≈ ${formatMinutes(machineMinutes)}`,
    printMinutes,
    linearMetres,
    areaM2,
    packedWidthMm: packed.usedWidth,
    packedLengthMm: packed.usedLength,
    assumptions: {
      printRateSqFtPerHour: MACHINE_TIME_CONFIG.highQualityPrintSqFtPerHour,
      highQualityOnly: true,
      packingGapMm: MACHINE_TIME_CONFIG.packingGapMm
    }
  };
}

function updateEstimateInForm(form) {
  const output = form?.querySelector('#machine-time-estimate');
  const note = form?.querySelector('#machine-time-estimate-note');
  if (!output) return;

  const estimate = estimateMachineTime({
    jobType: form.elements.type?.value || 'stickers',
    specification: form.elements.specification?.value || '',
    quantity: form.elements.quantity?.value || 1,
    cutlinesIncluded: Boolean(form.elements.cutlines?.checked)
  });

  output.textContent = estimate.display;
  if (note) note.textContent = estimate.available
    ? 'High Quality assumption · estimate only'
    : estimate.reason;
}

// Uses event delegation so the guided wizard can re-render without rebinding
// listeners. This keeps the estimator isolated from the existing app controller.
export function installMachineTimeEstimator() {
  document.addEventListener('input', (event) => {
    const form = event.target.closest('#job-form');
    if (form) updateEstimateInForm(form);
  });

  document.addEventListener('change', (event) => {
    const form = event.target.closest('#job-form');
    if (form) updateEstimateInForm(form);
  });

  document.addEventListener('click', (event) => {
    const wizardNext = event.target.closest('[data-wizard-next]');
    if (wizardNext) {
      const form = document.getElementById('job-form');
      if (form) updateEstimateInForm(form);
    }
  });
}
