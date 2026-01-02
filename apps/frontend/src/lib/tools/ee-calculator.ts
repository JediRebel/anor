// Path: apps/frontend/src/lib/tools/ee-calculator.ts
/* cspell:ignore celpip ielts pte tef tcf nclc français équivalence */

/**
 * 🇨🇦 Express Entry CRS Calculator Logic
 * - 纯计算逻辑 + 查表 + 语言考试到 CLB/NCLC 换算
 * - 语言换算表按 IRCC 官方档位（见 canada.ca 的 CLB/NCLC 对照表）
 */

export type EducationLevel =
  | 'none'
  | 'high_school'
  | 'one_year'
  | 'two_year'
  | 'bachelors'
  | 'two_or_more'
  | 'masters'
  | 'phd';

export type CanadianEducation = 'none' | '1_or_2_years' | '3_years_or_more';

export type TestType = 'celpip' | 'ielts' | 'pte' | 'tef' | 'tcf';

export interface LanguageScores {
  reading: number; // CLB/NCLC (0-12)
  writing: number;
  listening: number;
  speaking: number;
}

export interface EECriteria {
  age: number;
  hasSpouse: boolean;
  educationLevel: EducationLevel;

  firstLanguageTest: TestType;
  firstLanguage: LanguageScores;

  secondLanguageTest?: TestType;
  secondLanguage?: LanguageScores;

  canadianWorkExperience: number; // 0-10
  foreignWorkExperience: number; // 0-10

  certificateOfQualification: boolean;

  spouseEducationLevel?: EducationLevel;
  spouseLanguageTest?: TestType;
  spouseLanguage?: LanguageScores;
  spouseCanadianWorkExperience?: number;

  siblingInCanada: boolean;
  canadianEducation: CanadianEducation;
  nominationCertificate: boolean;
}

export interface CRSDetails {
  core: {
    age: number;
    education: number;
    firstLanguage: {
      reading: number;
      writing: number;
      listening: number;
      speaking: number;
      total: number;
    };
    secondLanguage: {
      reading: number;
      writing: number;
      listening: number;
      speaking: number;
      rawTotal: number;
      cappedTotal: number;
      cap: number;
    };
    canadianWork: number;
    subtotal: number;
    cap: number;
    cappedSubtotal: number;
  };
  spouse: {
    enabled: boolean;
    education: number;
    language: {
      reading: number;
      writing: number;
      listening: number;
      speaking: number;
      total: number;
    };
    canadianWork: number;
    subtotal: number;
    cap: number;
    cappedSubtotal: number;
  };
  transferability: {
    education: {
      eduLang: number;
      eduCanWork: number;
      subtotal: number;
      cap: number;
      cappedSubtotal: number;
    };
    foreignWork: {
      foreignLang: number;
      foreignCan: number;
      subtotal: number;
      cap: number;
      cappedSubtotal: number;
    };
    certificateOfQualification: number;
    subtotal: number;
    cap: number;
    cappedSubtotal: number;
  };
  additional: {
    nomination: number;
    french: number;
    canadianEducation: number;
    sibling: number;
    subtotal: number;
    cap: number;
    cappedSubtotal: number;
  };
}

export interface CRSResult {
  total: number;
  breakdown: {
    core: number;
    spouse: number;
    transferability: number;
    additional: number;
  };
  details: CRSDetails;
}

// ---------------------------
// Utils
// ---------------------------

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const toInt = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0);

const normAge = (age: number) => clamp(toInt(age), 0, 99);
const normYears10 = (y: number) => clamp(toInt(y), 0, 10);
const normLang = (s: LanguageScores): LanguageScores => ({
  reading: clamp(toInt(s.reading), 0, 12),
  writing: clamp(toInt(s.writing), 0, 12),
  listening: clamp(toInt(s.listening), 0, 12),
  speaking: clamp(toInt(s.speaking), 0, 12),
});

const allAtLeast = (scores: LanguageScores, min: number) =>
  scores.reading >= min &&
  scores.writing >= min &&
  scores.listening >= min &&
  scores.speaking >= min;

// ---------------------------
// Lookup Tables
// ---------------------------

const AGE_POINTS: Record<number, { single: number; withSpouse: number }> = {
  17: { single: 0, withSpouse: 0 },
  18: { single: 99, withSpouse: 90 },
  19: { single: 105, withSpouse: 95 },
  20: { single: 110, withSpouse: 100 },
  21: { single: 110, withSpouse: 100 },
  22: { single: 110, withSpouse: 100 },
  23: { single: 110, withSpouse: 100 },
  24: { single: 110, withSpouse: 100 },
  25: { single: 110, withSpouse: 100 },
  26: { single: 110, withSpouse: 100 },
  27: { single: 110, withSpouse: 100 },
  28: { single: 110, withSpouse: 100 },
  29: { single: 110, withSpouse: 100 },
  30: { single: 105, withSpouse: 95 },
  31: { single: 99, withSpouse: 90 },
  32: { single: 94, withSpouse: 85 },
  33: { single: 88, withSpouse: 80 },
  34: { single: 83, withSpouse: 75 },
  35: { single: 77, withSpouse: 70 },
  36: { single: 72, withSpouse: 65 },
  37: { single: 66, withSpouse: 60 },
  38: { single: 61, withSpouse: 55 },
  39: { single: 55, withSpouse: 50 },
  40: { single: 50, withSpouse: 45 },
  41: { single: 39, withSpouse: 35 },
  42: { single: 28, withSpouse: 25 },
  43: { single: 17, withSpouse: 15 },
  44: { single: 6, withSpouse: 5 },
};

const EDU_POINTS: Record<EducationLevel, { single: number; withSpouse: number }> = {
  none: { single: 0, withSpouse: 0 },
  high_school: { single: 30, withSpouse: 28 },
  one_year: { single: 90, withSpouse: 84 },
  two_year: { single: 98, withSpouse: 91 },
  bachelors: { single: 120, withSpouse: 112 },
  two_or_more: { single: 128, withSpouse: 119 },
  masters: { single: 135, withSpouse: 126 },
  phd: { single: 150, withSpouse: 140 },
};

const LANG_FIRST_POINTS = (clb: number, withSpouse: boolean): number => {
  if (clb >= 10) return withSpouse ? 32 : 34;
  if (clb === 9) return withSpouse ? 29 : 31;
  if (clb === 8) return withSpouse ? 22 : 23;
  if (clb === 7) return withSpouse ? 16 : 17;
  if (clb === 6) return withSpouse ? 8 : 9;
  if (clb === 4 || clb === 5) return 6;
  return 0;
};

const LANG_SECOND_POINTS = (clb: number): number => {
  if (clb >= 9) return 6;
  if (clb === 7 || clb === 8) return 3;
  if (clb === 5 || clb === 6) return 1;
  return 0;
};

const CAN_WORK_POINTS = (years: number, withSpouse: boolean): number => {
  if (years >= 5) return withSpouse ? 70 : 80;
  if (years === 4) return withSpouse ? 63 : 72;
  if (years === 3) return withSpouse ? 56 : 64;
  if (years === 2) return withSpouse ? 46 : 53;
  if (years === 1) return withSpouse ? 35 : 40;
  return 0;
};

// ---------------------------
// Main CRS Calculation
// ---------------------------

export function calculateCRS(input: EECriteria): CRSResult {
  const data: EECriteria = {
    ...input,
    age: normAge(input.age),
    canadianWorkExperience: normYears10(input.canadianWorkExperience),
    foreignWorkExperience: normYears10(input.foreignWorkExperience),
    firstLanguage: normLang(input.firstLanguage),
    secondLanguage: input.secondLanguage ? normLang(input.secondLanguage) : undefined,
    spouseLanguage: input.spouseLanguage ? normLang(input.spouseLanguage) : undefined,
    spouseCanadianWorkExperience:
      typeof input.spouseCanadianWorkExperience === 'number'
        ? normYears10(input.spouseCanadianWorkExperience)
        : undefined,
  };

  const s = data.hasSpouse;

  let coreScore = 0;
  let spouseScore = 0;
  let transferabilityScore = 0;
  let additionalScore = 0;

  const coreCap = s ? 460 : 500;
  const l2Cap = s ? 22 : 24;

  const details: CRSDetails = {
    core: {
      age: 0,
      education: 0,
      firstLanguage: { reading: 0, writing: 0, listening: 0, speaking: 0, total: 0 },
      secondLanguage: {
        reading: 0,
        writing: 0,
        listening: 0,
        speaking: 0,
        rawTotal: 0,
        cappedTotal: 0,
        cap: l2Cap,
      },
      canadianWork: 0,
      subtotal: 0,
      cap: coreCap,
      cappedSubtotal: 0,
    },
    spouse: {
      enabled: s,
      education: 0,
      language: { reading: 0, writing: 0, listening: 0, speaking: 0, total: 0 },
      canadianWork: 0,
      subtotal: 0,
      cap: 40,
      cappedSubtotal: 0,
    },
    transferability: {
      education: { eduLang: 0, eduCanWork: 0, subtotal: 0, cap: 50, cappedSubtotal: 0 },
      foreignWork: { foreignLang: 0, foreignCan: 0, subtotal: 0, cap: 50, cappedSubtotal: 0 },
      certificateOfQualification: 0,
      subtotal: 0,
      cap: 100,
      cappedSubtotal: 0,
    },
    additional: {
      nomination: 0,
      french: 0,
      canadianEducation: 0,
      sibling: 0,
      subtotal: 0,
      cap: 600,
      cappedSubtotal: 0,
    },
  };

  // A. Core
  if (data.age >= 17 && data.age < 45) {
    const p = AGE_POINTS[data.age];
    if (p) {
      details.core.age = s ? p.withSpouse : p.single;
      coreScore += details.core.age;
    }
  }

  details.core.education = s
    ? EDU_POINTS[data.educationLevel].withSpouse
    : EDU_POINTS[data.educationLevel].single;
  coreScore += details.core.education;

  const l1 = data.firstLanguage;
  details.core.firstLanguage.reading = LANG_FIRST_POINTS(l1.reading, s);
  details.core.firstLanguage.writing = LANG_FIRST_POINTS(l1.writing, s);
  details.core.firstLanguage.listening = LANG_FIRST_POINTS(l1.listening, s);
  details.core.firstLanguage.speaking = LANG_FIRST_POINTS(l1.speaking, s);
  details.core.firstLanguage.total =
    details.core.firstLanguage.reading +
    details.core.firstLanguage.writing +
    details.core.firstLanguage.listening +
    details.core.firstLanguage.speaking;
  coreScore += details.core.firstLanguage.total;

  if (data.secondLanguage) {
    const l2 = data.secondLanguage;
    details.core.secondLanguage.reading = LANG_SECOND_POINTS(l2.reading);
    details.core.secondLanguage.writing = LANG_SECOND_POINTS(l2.writing);
    details.core.secondLanguage.listening = LANG_SECOND_POINTS(l2.listening);
    details.core.secondLanguage.speaking = LANG_SECOND_POINTS(l2.speaking);

    details.core.secondLanguage.rawTotal =
      details.core.secondLanguage.reading +
      details.core.secondLanguage.writing +
      details.core.secondLanguage.listening +
      details.core.secondLanguage.speaking;

    details.core.secondLanguage.cappedTotal = Math.min(details.core.secondLanguage.rawTotal, l2Cap);
    coreScore += details.core.secondLanguage.cappedTotal;
  }

  details.core.canadianWork = CAN_WORK_POINTS(data.canadianWorkExperience, s);
  coreScore += details.core.canadianWork;

  details.core.subtotal = coreScore;
  details.core.cappedSubtotal = Math.min(coreScore, coreCap);
  coreScore = details.core.cappedSubtotal;

  // B. Spouse
  if (s) {
    if (data.spouseEducationLevel) {
      const level = data.spouseEducationLevel;
      if (level === 'masters' || level === 'phd') details.spouse.education = 10;
      else if (level === 'two_or_more') details.spouse.education = 9;
      else if (level === 'bachelors') details.spouse.education = 8;
      else if (level === 'two_year') details.spouse.education = 7;
      else if (level === 'one_year') details.spouse.education = 6;
      else if (level === 'high_school') details.spouse.education = 2;
    }
    spouseScore += details.spouse.education;

    if (data.spouseLanguage) {
      const calcSpouseLang = (clb: number) => {
        if (clb >= 9) return 5;
        if (clb === 7 || clb === 8) return 3;
        if (clb === 5 || clb === 6) return 1;
        return 0;
      };

      details.spouse.language.reading = calcSpouseLang(data.spouseLanguage.reading);
      details.spouse.language.writing = calcSpouseLang(data.spouseLanguage.writing);
      details.spouse.language.listening = calcSpouseLang(data.spouseLanguage.listening);
      details.spouse.language.speaking = calcSpouseLang(data.spouseLanguage.speaking);
      details.spouse.language.total =
        details.spouse.language.reading +
        details.spouse.language.writing +
        details.spouse.language.listening +
        details.spouse.language.speaking;

      spouseScore += details.spouse.language.total;
    }

    if (typeof data.spouseCanadianWorkExperience === 'number') {
      const y = data.spouseCanadianWorkExperience;
      if (y >= 5) details.spouse.canadianWork = 10;
      else if (y === 4) details.spouse.canadianWork = 9;
      else if (y === 3) details.spouse.canadianWork = 8;
      else if (y === 2) details.spouse.canadianWork = 7;
      else if (y === 1) details.spouse.canadianWork = 5;
      spouseScore += details.spouse.canadianWork;
    }

    details.spouse.subtotal = spouseScore;
    details.spouse.cappedSubtotal = Math.min(spouseScore, 40);
    spouseScore = details.spouse.cappedSubtotal;
  }

  // C. Transferability
  const l1All7 = allAtLeast(data.firstLanguage, 7);
  const l1All9 = allAtLeast(data.firstLanguage, 9);

  // 该条件仅用于技工证书 C3 交叉项判断
  const isTradeCertificateEligible = allAtLeast(data.firstLanguage, 5);

  const isTwoOrMore = ['two_or_more', 'masters', 'phd'].includes(data.educationLevel);
  const isPostSecondary = data.educationLevel !== 'none' && data.educationLevel !== 'high_school';

  // C1 Education
  let eduLangPoints = 0;
  if (l1All9) {
    if (isTwoOrMore) eduLangPoints = 50;
    else if (isPostSecondary) eduLangPoints = 25;
  } else if (l1All7) {
    if (isTwoOrMore) eduLangPoints = 25;
    else if (isPostSecondary) eduLangPoints = 13;
  }

  let eduCanWorkPoints = 0;
  if (data.canadianWorkExperience >= 2) {
    if (isTwoOrMore) eduCanWorkPoints = 50;
    else if (isPostSecondary) eduCanWorkPoints = 25;
  } else if (data.canadianWorkExperience === 1) {
    if (isTwoOrMore) eduCanWorkPoints = 25;
    else if (isPostSecondary) eduCanWorkPoints = 13;
  }

  details.transferability.education.eduLang = eduLangPoints;
  details.transferability.education.eduCanWork = eduCanWorkPoints;
  details.transferability.education.subtotal = eduLangPoints + eduCanWorkPoints;
  details.transferability.education.cappedSubtotal = Math.min(
    details.transferability.education.subtotal,
    50,
  );
  transferabilityScore += details.transferability.education.cappedSubtotal;

  // C2 Foreign work
  let foreignLangPoints = 0;
  if (data.foreignWorkExperience >= 3) {
    if (l1All9) foreignLangPoints = 50;
    else if (l1All7) foreignLangPoints = 25;
  } else if (data.foreignWorkExperience >= 1) {
    if (l1All9) foreignLangPoints = 25;
    else if (l1All7) foreignLangPoints = 13;
  }

  let foreignCanPoints = 0;
  if (data.canadianWorkExperience >= 1 && data.foreignWorkExperience >= 1) {
    if (data.foreignWorkExperience >= 3) {
      foreignCanPoints = data.canadianWorkExperience >= 2 ? 50 : 25;
    } else {
      foreignCanPoints = data.canadianWorkExperience >= 2 ? 25 : 13;
    }
  }

  details.transferability.foreignWork.foreignLang = foreignLangPoints;
  details.transferability.foreignWork.foreignCan = foreignCanPoints;
  details.transferability.foreignWork.subtotal = foreignLangPoints + foreignCanPoints;
  details.transferability.foreignWork.cappedSubtotal = Math.min(
    details.transferability.foreignWork.subtotal,
    50,
  );
  transferabilityScore += details.transferability.foreignWork.cappedSubtotal;

  // C3 Certificate of Qualification
  if (data.certificateOfQualification) {
    if (l1All9 || l1All7) details.transferability.certificateOfQualification = 50;
    else if (isTradeCertificateEligible) details.transferability.certificateOfQualification = 25;

    transferabilityScore += details.transferability.certificateOfQualification;
  }

  details.transferability.subtotal = transferabilityScore;
  details.transferability.cappedSubtotal = Math.min(transferabilityScore, 100);
  transferabilityScore = details.transferability.cappedSubtotal;

  // D. Additional
  if (data.nominationCertificate) {
    details.additional.nomination = 600;
    additionalScore += 600;
  }

  let frenchScores: LanguageScores | null = null;
  let englishScores: LanguageScores | null = null;

  const isFrench = (t?: TestType) => t === 'tef' || t === 'tcf';
  const isEnglish = (t?: TestType) => t === 'celpip' || t === 'ielts' || t === 'pte';

  if (isFrench(data.firstLanguageTest)) {
    frenchScores = data.firstLanguage;
    if (data.secondLanguage && isEnglish(data.secondLanguageTest))
      englishScores = data.secondLanguage;
  } else {
    englishScores = data.firstLanguage;
    if (data.secondLanguage && isFrench(data.secondLanguageTest))
      frenchScores = data.secondLanguage;
  }

  if (frenchScores && allAtLeast(frenchScores, 7)) {
    const engAll5 = englishScores ? allAtLeast(englishScores, 5) : false;
    details.additional.french = engAll5 ? 50 : 25;
    additionalScore += details.additional.french;
  }

  if (data.canadianEducation === '3_years_or_more') {
    details.additional.canadianEducation = 30;
    additionalScore += 30;
  } else if (data.canadianEducation === '1_or_2_years') {
    details.additional.canadianEducation = 15;
    additionalScore += 15;
  }

  if (data.siblingInCanada) {
    details.additional.sibling = 15;
    additionalScore += 15;
  }

  details.additional.subtotal = additionalScore;
  details.additional.cappedSubtotal = Math.min(additionalScore, 600);
  additionalScore = details.additional.cappedSubtotal;

  const total = Math.min(1200, coreScore + spouseScore + transferabilityScore + additionalScore);

  return {
    total,
    breakdown: {
      core: coreScore,
      spouse: spouseScore,
      transferability: transferabilityScore,
      additional: additionalScore,
    },
    details,
  };
}

// ---------------------------
// Test Conversion (IRCC-equivalency-style mapping)
// ---------------------------

export const LANGUAGE_SKILLS = ['reading', 'writing', 'listening', 'speaking'] as const;
export type LangSkill = (typeof LANGUAGE_SKILLS)[number];

export type TestInputProps = { min: number; max: number; step: number; placeholder: string };

export interface TestConfig {
  label: string;
  language: 'en' | 'fr';
  toCLB: (skill: LangSkill, score: number) => number;
  inputProps?: TestInputProps;
  getInputProps?: (skill: LangSkill) => TestInputProps;
}

// 用区间映射（从高到低匹配），减少边界误差
type Band = { min: number; clb: number };
const toBand = (score: number, bands: Band[]) => {
  const s = Number(score);
  if (!Number.isFinite(s)) return 0;
  for (const b of bands) {
    if (s >= b.min) return b.clb;
  }
  return 0;
};

export const TEST_CONFIGS: Record<TestType, TestConfig> = {
  celpip: {
    label: 'CELPIP-G (English)',
    language: 'en',
    // CELPIP 可显示到 CLB 12；CRS 计分对 >=10 同档，但 UI 应正确显示 11/12
    toCLB: (_skill, score) => {
      if (!Number.isFinite(score)) return 0;
      const s = Math.round(score);
      if (s >= 12) return 12;
      if (s === 11) return 11;
      if (s === 10) return 10;
      if (s === 9) return 9;
      if (s === 8) return 8;
      if (s === 7) return 7;
      if (s === 6) return 6;
      if (s === 5) return 5;
      if (s === 4) return 4;
      return 0;
    },
    inputProps: { min: 0, max: 12, step: 1, placeholder: '4-12' },
  },

  ielts: {
    label: 'IELTS General Training (English)',
    language: 'en',
    // IRCC 表按档位：R/L/W/S 的 CLB 10/9/8/7/6/5/4
    toCLB: (skill, score) => {
      if (skill === 'reading') {
        return toBand(score, [
          { min: 8.0, clb: 10 },
          { min: 7.0, clb: 9 },
          { min: 6.5, clb: 8 },
          { min: 6.0, clb: 7 },
          { min: 5.0, clb: 6 },
          { min: 4.0, clb: 5 },
          { min: 3.5, clb: 4 },
        ]);
      }
      if (skill === 'listening') {
        return toBand(score, [
          { min: 8.5, clb: 10 },
          { min: 8.0, clb: 9 },
          { min: 7.5, clb: 8 },
          { min: 6.0, clb: 7 },
          { min: 5.5, clb: 6 },
          { min: 5.0, clb: 5 },
          { min: 4.5, clb: 4 },
        ]);
      }
      // writing / speaking
      return toBand(score, [
        { min: 7.5, clb: 10 },
        { min: 7.0, clb: 9 },
        { min: 6.5, clb: 8 },
        { min: 6.0, clb: 7 },
        { min: 5.5, clb: 6 },
        { min: 5.0, clb: 5 },
        { min: 4.0, clb: 4 },
      ]);
    },
    inputProps: { min: 0, max: 9, step: 0.5, placeholder: '0-9.0' },
  },

  pte: {
    label: 'PTE Core (English)',
    language: 'en',
    // IRCC 表为区间；这里按“达到该 CLB 的最低分”映射（>=min 即命中）
    toCLB: (skill, score) => {
      if (!Number.isFinite(score)) return 0;
      const s = Math.round(score);

      const bands: Record<LangSkill, Band[]> = {
        reading: [
          { min: 88, clb: 10 },
          { min: 78, clb: 9 },
          { min: 69, clb: 8 },
          { min: 60, clb: 7 },
          { min: 51, clb: 6 },
          { min: 42, clb: 5 },
          { min: 33, clb: 4 },
          { min: 24, clb: 3 },
        ],
        writing: [
          { min: 90, clb: 10 },
          { min: 88, clb: 9 },
          { min: 79, clb: 8 },
          { min: 69, clb: 7 },
          { min: 60, clb: 6 },
          { min: 51, clb: 5 },
          { min: 41, clb: 4 },
          { min: 32, clb: 3 },
        ],
        listening: [
          { min: 89, clb: 10 },
          { min: 82, clb: 9 },
          { min: 71, clb: 8 },
          { min: 60, clb: 7 },
          { min: 50, clb: 6 },
          { min: 39, clb: 5 },
          { min: 28, clb: 4 },
          { min: 18, clb: 3 },
        ],
        speaking: [
          { min: 89, clb: 10 },
          { min: 84, clb: 9 },
          { min: 76, clb: 8 },
          { min: 68, clb: 7 },
          { min: 59, clb: 6 },
          { min: 51, clb: 5 },
          { min: 42, clb: 4 },
          { min: 34, clb: 3 },
        ],
      };

      return toBand(s, bands[skill]);
    },
    inputProps: { min: 0, max: 90, step: 1, placeholder: '0-90' },
  },

  tef: {
    label: 'TEF Canada (Français)',
    language: 'fr',
    // Express Entry 仍使用 “Équivalence ancien score”（< 2019-09-30）口径
    toCLB: (skill, score) => {
      if (!Number.isFinite(score)) return 0;
      const s = Math.round(score);

      const bands: Record<LangSkill, Band[]> = {
        reading: [
          { min: 263, clb: 10 },
          { min: 248, clb: 9 },
          { min: 233, clb: 8 },
          { min: 207, clb: 7 },
          { min: 181, clb: 6 },
          { min: 151, clb: 5 },
          { min: 121, clb: 4 },
        ],
        writing: [
          { min: 393, clb: 10 },
          { min: 371, clb: 9 },
          { min: 349, clb: 8 },
          { min: 310, clb: 7 },
          { min: 271, clb: 6 },
          { min: 226, clb: 5 },
          { min: 181, clb: 4 },
        ],
        listening: [
          { min: 316, clb: 10 },
          { min: 298, clb: 9 },
          { min: 280, clb: 8 },
          { min: 249, clb: 7 },
          { min: 217, clb: 6 },
          { min: 181, clb: 5 },
          { min: 145, clb: 4 },
        ],
        speaking: [
          { min: 393, clb: 10 },
          { min: 371, clb: 9 },
          { min: 349, clb: 8 },
          { min: 310, clb: 7 },
          { min: 271, clb: 6 },
          { min: 226, clb: 5 },
          { min: 181, clb: 4 },
        ],
      };

      return toBand(s, bands[skill]);
    },
    getInputProps: (skill) => {
      if (skill === 'reading') return { min: 0, max: 300, step: 1, placeholder: '121-300' };
      if (skill === 'listening') return { min: 0, max: 360, step: 1, placeholder: '145-360' };
      return { min: 0, max: 450, step: 1, placeholder: '181-450' };
    },
  },

  tcf: {
    label: 'TCF Canada (Français)',
    language: 'fr',
    toCLB: (skill, score) => {
      if (!Number.isFinite(score)) return 0;
      const s = Math.round(score);

      // Reading/Listening 为分数区间；Writing/Speaking 为等级区间（4-20）
      const bands: Record<LangSkill, Band[]> = {
        reading: [
          { min: 549, clb: 10 },
          { min: 524, clb: 9 },
          { min: 499, clb: 8 },
          { min: 453, clb: 7 },
          { min: 406, clb: 6 },
          { min: 375, clb: 5 },
          { min: 342, clb: 4 },
        ],
        listening: [
          { min: 549, clb: 10 },
          { min: 523, clb: 9 },
          { min: 503, clb: 8 },
          { min: 458, clb: 7 },
          { min: 398, clb: 6 },
          { min: 369, clb: 5 },
          { min: 331, clb: 4 },
        ],
        writing: [
          { min: 16, clb: 10 },
          { min: 14, clb: 9 },
          { min: 12, clb: 8 },
          { min: 10, clb: 7 },
          { min: 7, clb: 6 },
          { min: 6, clb: 5 },
          { min: 4, clb: 4 },
        ],
        speaking: [
          { min: 16, clb: 10 },
          { min: 14, clb: 9 },
          { min: 12, clb: 8 },
          { min: 10, clb: 7 },
          { min: 7, clb: 6 },
          { min: 6, clb: 5 },
          { min: 4, clb: 4 },
        ],
      };

      return toBand(s, bands[skill]);
    },
    getInputProps: (skill) => {
      if (skill === 'writing' || skill === 'speaking') {
        return { min: 0, max: 20, step: 1, placeholder: '4-20' };
      }
      return {
        min: 0,
        max: 699,
        step: 1,
        placeholder: skill === 'reading' ? '342-699' : '331-699',
      };
    },
  },
};
