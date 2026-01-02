// Path: apps/frontend/src/app/tools/ee-score/page.tsx
/* cspell:ignore teer lmia celpip ielts tef tcf pte recalc nclc */
'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { useForm, useFormContext, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api-client';

import {
  calculateCRS,
  type CRSResult,
  type EECriteria,
  TEST_CONFIGS,
  type TestType,
  LANGUAGE_SKILLS,
  type LangSkill,
} from '@/lib/tools/ee-calculator';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Save, Calculator, ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// --- 防抖 Hook (避免频繁计算) ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ---------------------------
// 输入约束工具
// ---------------------------

function preventSciNotationKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  // 禁止 e/E/+/-，避免 1e3 / +10 / -1 这种隐性大数或符号污染
  if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
    e.preventDefault();
  }
}

function preventSciNotationPaste(e: React.ClipboardEvent<HTMLInputElement>) {
  const text = e.clipboardData.getData('text') || '';
  if (/[eE+\-]/.test(text)) e.preventDefault();
}

function clampIntInRange(raw: string, min: number, max: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function getStepPrecision(step: number) {
  const s = String(step);
  if (s.includes('e-')) {
    const p = Number(s.split('e-')[1]);
    return Number.isFinite(p) ? p : 0;
  }
  const idx = s.indexOf('.');
  return idx >= 0 ? s.length - idx - 1 : 0;
}

function snapToStep(value: number, step: number) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}

function normalizeByInputProps(
  raw: string,
  props: { min: number; max: number; step: number },
): { display: string; num: number | null } {
  if (raw === '') return { display: '', num: null };

  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v)) return { display: '', num: null };

  const snapped = snapToStep(v, props.step);
  const clamped = Math.min(props.max, Math.max(props.min, snapped));

  const precision = getStepPrecision(props.step);
  const fixed = clamped.toFixed(precision);

  return { display: fixed, num: Number.parseFloat(fixed) };
}

// ---------------------------
// Zod Schema
// ---------------------------

const clbField = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? 0 : v),
  z.coerce.number().int().min(0).max(12),
);

const languageSchema = z.object({
  reading: clbField,
  writing: clbField,
  listening: clbField,
  speaking: clbField,
});

const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().int(),
);

const testTypeEnum = z.enum(['celpip', 'ielts', 'pte', 'tef', 'tcf']);

const educationEnum = z.enum([
  'none',
  'high_school',
  'one_year',
  'two_year',
  'bachelors',
  'two_or_more',
  'masters',
  'phd',
]);

const canadianEduEnum = z.enum(['none', '1_or_2_years', '3_years_or_more']);

const formSchema = z.object({
  age: z.preprocess((v) => (v === '' ? 0 : v), z.coerce.number().int().min(0).max(99)),
  hasSpouse: z.boolean().default(false),
  educationLevel: educationEnum,

  firstLanguageTest: testTypeEnum,
  firstLanguage: languageSchema,

  // 将“是否启用第二语言”纳入表单状态，确保回放数据一致性
  secondLanguageEnabled: z.boolean().default(false),
  secondLanguageTest: testTypeEnum.optional(),
  secondLanguage: languageSchema.optional(),

  canadianWorkExperience: z.preprocess(
    (v) => (v === '' ? 0 : v),
    z.coerce.number().int().min(0).max(10),
  ),
  foreignWorkExperience: z.preprocess(
    (v) => (v === '' ? 0 : v),
    z.coerce.number().int().min(0).max(10),
  ),
  certificateOfQualification: z.boolean().default(false),

  spouseEducationLevel: educationEnum.optional(),
  spouseLanguageTest: testTypeEnum.optional(),
  spouseLanguage: languageSchema.optional(),
  spouseCanadianWorkExperience: optionalNumber.optional(),

  siblingInCanada: z.boolean().default(false),
  canadianEducation: canadianEduEnum,
  nominationCertificate: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

// ---------------------------
// 子组件：语言输入模块
// ---------------------------

interface LanguageSectionProps {
  basePath: 'firstLanguage' | 'secondLanguage' | 'spouseLanguage';
  testPath?: 'firstLanguageTest' | 'secondLanguageTest' | 'spouseLanguageTest';
  title: string;
  subtitle?: string;
  allowTestMode?: boolean;
}

function LanguageSection({
  basePath,
  testPath,
  title,
  subtitle,
  allowTestMode = true,
}: LanguageSectionProps) {
  const form = useFormContext<FormValues>();
  const [mode, setMode] = useState<'clb' | 'test'>('clb');

  const formTestType = testPath ? (form.watch(testPath) as TestType | undefined) : undefined;

  // 当没有 testPath（理论上不会发生），用本地备份
  const [localTestType, setLocalTestType] = useState<TestType>('ielts');
  const selectedTest = testPath && formTestType ? formTestType : localTestType;

  // 当前语言（由考试类型推断）；在 CLB 模式下用于显式选择英语/法语，避免默认英语导致法语加分无法计算
  const currentLang = (TEST_CONFIGS[selectedTest]?.language ?? 'en') as 'en' | 'fr';

  // 规则：第一语言与第二语言不能同为英语/同为法语
  // - 第一语言：可选英语/法语
  // - 第二语言：自动固定为与第一语言相反的语言，且不可修改
  const firstTestType = form.watch('firstLanguageTest') as TestType | undefined;
  const firstLang = (firstTestType ? TEST_CONFIGS[firstTestType]?.language : 'en') as 'en' | 'fr';
  const forcedSecondLang = (firstLang === 'en' ? 'fr' : 'en') as 'en' | 'fr';

  const isLangPickable =
    !!testPath && (basePath === 'firstLanguage' || basePath === 'secondLanguage');
  const isSecondLangLocked = basePath === 'secondLanguage' && isLangPickable;

  const handleLanguageChange = (lang: 'en' | 'fr') => {
    // 第二语言语言锁定：不允许手动修改
    if (isSecondLangLocked) return;

    // 在 CLB 模式下，我们只需要一个“代表性”考试类型来标记语言归属
    // 英语：默认用 IELTS；法语：默认用 TEF（同属法语体系，后续计算会识别为法语）
    if (lang === 'en') {
      if (TEST_CONFIGS[selectedTest]?.language === 'en') return;
      handleTestChange('ielts');
      return;
    }

    if (TEST_CONFIGS[selectedTest]?.language === 'fr') return;
    handleTestChange('tef');
  };

  const effectiveLang = isSecondLangLocked ? forcedSecondLang : currentLang;
  const clbLabel = effectiveLang === 'fr' ? 'NCLC' : 'CLB';

  // 原始分缓存（仅用于 UI 展示，不参与保存；保存的是 CLB）
  const [scores, setScores] = useState<Partial<Record<LangSkill, string>>>({});

  const currentCLBs = ((form.watch(basePath as any) as any) || {
    reading: 0,
    writing: 0,
    listening: 0,
    speaking: 0,
  }) as Record<LangSkill, number>;

  const handleTestChange = (val: TestType) => {
    if (testPath) {
      form.setValue(testPath, val, { shouldDirty: true, shouldValidate: true });
    } else {
      setLocalTestType(val);
    }
    // 切换考试：清空原始分数（防止不同考试量纲混淆）
    setScores({});
  };

  const clampCLB = (n: number) => Math.max(0, Math.min(12, n));

  const handleScoreChange = (skill: LangSkill, value: string) => {
    const config = TEST_CONFIGS[selectedTest];
    const inputProps = config.getInputProps ? config.getInputProps(skill) : config.inputProps;

    // 先让用户“自然输入”，不要在 onChange 里 toFixed / snap step
    setScores((prev) => ({ ...prev, [skill]: value }));

    const numVal = tryParseNumber(value);
    if (numVal === null) {
      // 输入中间态不强行置 0，避免体验很怪；这里保持当前 CLB 不变更稳
      return;
    }

    // 计算时做一次 clamp（不做 step 吸附；吸附放到 onBlur）
    const min = inputProps?.min ?? 0;
    const max = inputProps?.max ?? 999;
    const clamped = Math.min(max, Math.max(min, numVal));

    const clb = clampCLB(config.toCLB(skill, clamped));
    form.setValue(`${basePath}.${skill}` as any, clb, { shouldValidate: true, shouldDirty: true });
  };

  const handleScoreBlur = (skill: LangSkill) => {
    const config = TEST_CONFIGS[selectedTest];
    const inputProps = config.getInputProps ? config.getInputProps(skill) : config.inputProps;

    const raw = scores[skill] ?? '';
    if (!inputProps) return;

    const normalized = normalizeByInputProps(coerceDecimal(raw), inputProps);
    // blur 时再统一成标准格式（5.5、7.0）
    setScores((prev) => ({ ...prev, [skill]: normalized.display }));

    if (normalized.num === null) return;

    const clb = clampCLB(config.toCLB(skill, normalized.num));
    form.setValue(`${basePath}.${skill}` as any, clb, { shouldValidate: true, shouldDirty: true });
  };

  const skillLabel: Record<LangSkill, string> = {
    reading: '阅读',
    writing: '写作',
    listening: '听力',
    speaking: '口语',
  };

  const canShowTestMode = allowTestMode;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        </div>

        {canShowTestMode && (
          <div className="flex items-center gap-2">
            {isLangPickable && mode === 'clb' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 whitespace-nowrap">语言</span>
                <Select
                  value={effectiveLang}
                  onValueChange={(v) => handleLanguageChange(v as 'en' | 'fr')}
                >
                  <SelectTrigger className="w-[150px] h-8 bg-white" disabled={isSecondLangLocked}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">英语（CLB）</SelectItem>
                    <SelectItem value="fr">法语（NCLC）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-[220px]">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="clb" className="text-xs">
                  输入 CLB/NCLC
                </TabsTrigger>
                <TabsTrigger value="test" className="text-xs">
                  输入考试分
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      {canShowTestMode && mode === 'test' && (
        <div className="rounded-xl border bg-slate-50/70 p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calculator className="w-4 h-4 text-slate-400" />
              <span>选择考试类型并输入原始分数，系统自动换算为 CLB/NCLC。</span>
            </div>

            <Select value={selectedTest} onValueChange={handleTestChange}>
              <SelectTrigger className="w-[220px] h-9 bg-white" disabled={isSecondLangLocked}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ielts">IELTS（雅思）</SelectItem>
                <SelectItem value="celpip">CELPIP（思培）</SelectItem>
                <SelectItem value="pte">PTE Core</SelectItem>
                <SelectItem value="tef">TEF Canada</SelectItem>
                <SelectItem value="tcf">TCF Canada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {LANGUAGE_SKILLS.map((skill) => {
              const config = TEST_CONFIGS[selectedTest];
              const inputProps = config.getInputProps
                ? config.getInputProps(skill)
                : config.inputProps;

              return (
                <div key={skill} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 flex justify-between">
                    <span>{skillLabel[skill]}</span>
                    <span className="text-primary font-semibold">
                      {clbLabel} {currentCLBs[skill] ?? 0}
                    </span>
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    {...(inputProps ?? { min: 0, max: 999, step: 1, placeholder: 'Score' })}
                    value={scores[skill] || ''}
                    onKeyDown={preventSciNotationKeyDown}
                    onPaste={preventSciNotationPaste}
                    onChange={(e) => handleScoreChange(skill, e.target.value)}
                    onBlur={() => handleScoreBlur(skill)}
                    className="bg-white"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={cn(
          'grid grid-cols-2 md:grid-cols-4 gap-4',
          canShowTestMode && mode === 'test' ? 'opacity-60 pointer-events-none grayscale' : '',
        )}
      >
        {LANGUAGE_SKILLS.map((skill) => (
          <FormField
            key={`${basePath}-${skill}`}
            control={form.control}
            name={`${basePath}.${skill}` as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-slate-600">
                  {skillLabel[skill]}（{clbLabel}）
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    step={1}
                    value={
                      field.value === undefined || field.value === null ? '' : Number(field.value)
                    }
                    readOnly={canShowTestMode && mode === 'test'}
                    onKeyDown={preventSciNotationKeyDown}
                    onPaste={preventSciNotationPaste}
                    onChange={(e) => {
                      const v = e.target.value;
                      field.onChange(v === '' ? 0 : clampIntInRange(v, 0, 12));
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        ))}
      </div>
    </div>
  );
  function coerceDecimal(raw: string) {
    // 允许用户输入 “5,5” 或 “5.5”
    return raw.replace(',', '.');
  }

  function tryParseNumber(raw: string): number | null {
    const cleaned = coerceDecimal(raw);
    // 允许中间态：'' / '.' / '5.' 这类不立刻强制归一
    if (cleaned.trim() === '' || cleaned === '.' || cleaned === '-.' || cleaned === '-')
      return null;
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
}

// ---------------------------
// 主页面
// ---------------------------

export default function EEScorePage() {
  const { user } = useAuth();
  const [result, setResult] = useState<CRSResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      age: 0,
      hasSpouse: false,
      educationLevel: 'none',

      firstLanguageTest: 'ielts',
      firstLanguage: { reading: 0, writing: 0, listening: 0, speaking: 0 },

      secondLanguageEnabled: false,
      secondLanguageTest: 'tef',
      secondLanguage: { reading: 0, writing: 0, listening: 0, speaking: 0 },

      canadianWorkExperience: 0,
      foreignWorkExperience: 0,
      certificateOfQualification: false,

      spouseEducationLevel: undefined,
      spouseLanguageTest: 'ielts',
      spouseLanguage: { reading: 0, writing: 0, listening: 0, speaking: 0 },
      spouseCanadianWorkExperience: undefined,

      siblingInCanada: false,
      canadianEducation: 'none',
      nominationCertificate: false,
    },
    mode: 'onChange',
  });

  const allValues = useWatch({ control: form.control }) as FormValues;
  const hasSpouse = allValues?.hasSpouse ?? false;
  const showSecondLang = allValues?.secondLanguageEnabled ?? false;

  // buildCriteria 需要在首次计算 useEffect 之前定义（避免 TS/运行时问题）
  const buildCriteria = (v: FormValues): EECriteria => {
    const base: EECriteria = {
      age: v.age,
      hasSpouse: v.hasSpouse,
      educationLevel: v.educationLevel,

      firstLanguageTest: v.firstLanguageTest,
      firstLanguage: v.firstLanguage,

      canadianWorkExperience: v.canadianWorkExperience,
      foreignWorkExperience: v.foreignWorkExperience,

      certificateOfQualification: v.certificateOfQualification,

      siblingInCanada: v.siblingInCanada,
      canadianEducation: v.canadianEducation,
      nominationCertificate: v.nominationCertificate,
    };

    if (v.secondLanguageEnabled && v.secondLanguage && v.secondLanguageTest) {
      base.secondLanguage = v.secondLanguage;
      base.secondLanguageTest = v.secondLanguageTest;
    }

    if (v.hasSpouse) {
      if (v.spouseEducationLevel) base.spouseEducationLevel = v.spouseEducationLevel;
      if (v.spouseLanguage) base.spouseLanguage = v.spouseLanguage;
      if (v.spouseLanguageTest) base.spouseLanguageTest = v.spouseLanguageTest;
      if (typeof v.spouseCanadianWorkExperience === 'number') {
        base.spouseCanadianWorkExperience = v.spouseCanadianWorkExperience;
      }
    }

    return base;
  };

  const recalc = (values: FormValues) => {
    const criteria = buildCriteria(values);
    setResult(calculateCRS(criteria));
  };

  // 首次渲染立即计算一次（避免等待 debounce）
  useEffect(() => {
    const v = form.getValues() as FormValues;
    recalc(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 关闭第二语言：清理 secondLanguage（避免保存脏数据）
  useEffect(() => {
    if (!showSecondLang) {
      form.setValue(
        'secondLanguage',
        { reading: 0, writing: 0, listening: 0, speaking: 0 },
        { shouldDirty: true },
      );
      // secondLanguageTest 保留默认值即可；最终 buildCriteria 会自动忽略
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSecondLang]);

  // 规则：第一语言与第二语言不能同为英语/同为法语。
  // 当启用第二语言时，自动将 secondLanguageTest 固定为与第一语言相反的语言（并锁定 UI）。
  useEffect(() => {
    if (!showSecondLang) return;

    const firstTest = form.getValues('firstLanguageTest') as TestType;
    const firstLang = (TEST_CONFIGS[firstTest]?.language ?? 'en') as 'en' | 'fr';

    // 用一个“代表性”考试类型来标记第二语言的语言归属
    const desiredSecondTest: TestType = firstLang === 'en' ? 'tef' : 'ielts';
    const currentSecondTest = form.getValues('secondLanguageTest') as TestType | undefined;

    if (currentSecondTest !== desiredSecondTest) {
      form.setValue('secondLanguageTest', desiredSecondTest, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSecondLang, allValues?.firstLanguageTest]);

  // 切换为“单身/配偶不随行”：清理配偶字段
  useEffect(() => {
    if (!hasSpouse) {
      form.setValue('spouseEducationLevel', undefined, { shouldDirty: true });
      form.setValue('spouseCanadianWorkExperience', undefined, { shouldDirty: true });
      form.setValue(
        'spouseLanguage',
        { reading: 0, writing: 0, listening: 0, speaking: 0 },
        { shouldDirty: true },
      );
      form.setValue('spouseLanguageTest', 'ielts', { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSpouse]);

  // 防抖，避免频繁计算导致卡顿
  const debouncedValues = useDebounce(allValues, 300);

  // 监听防抖后的值变化来触发计算
  useEffect(() => {
    if (debouncedValues) recalc(debouncedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValues]);

  async function handleSaveResult() {
    if (!result || !user) return;

    setIsSaving(true);
    try {
      const inputSnapshot = form.getValues();
      await apiClient.post('/tools/save', {
        toolType: 'ee-score',
        inputPayload: inputSnapshot,
        resultPayload: result,
      });
      toast.success('记录已保存');
    } catch {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  function onSubmit(data: FormValues) {
    recalc(data);
    if (window.innerWidth < 1024) {
      document.getElementById('score-panel')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  const totalScore = result?.total ?? 0;

  const scoreTone = useMemo(() => {
    if (totalScore >= 480) return 'text-green-600';
    if (totalScore >= 450) return 'text-blue-600';
    return 'text-slate-900';
  }, [totalScore]);

  const d = result?.details;

  const ScoreRow = ({ label, value, note }: { label: string; value: number; note?: string }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-slate-200 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm text-slate-700 truncate">{label}</div>
        {note && <div className="text-xs text-slate-400 mt-0.5">{note}</div>}
      </div>
      <div className="shrink-0">
        <span className="inline-flex items-center justify-center min-w-[44px] h-7 px-2 rounded-md bg-slate-100 text-slate-900 font-semibold text-sm">
          {value}
        </span>
      </div>
    </div>
  );

  const Section = ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) => (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
        </div>
      </div>
      <div className="rounded-xl border bg-white">{children}</div>
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8 space-y-2 text-center lg:text-left">
        <h1 className="text-3xl font-bold text-slate-900">快速通道 CRS 打分器</h1>
        <p className="text-slate-600">
          依据官方 CRS 规则实时计算（2025 新政版）。支持 IELTS/CELPIP/TEF/TCF/PTE 原始成绩自动换算为
          CLB/NCLC。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 左侧表单 */}
        <div className="lg:col-span-8 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* 1. 基本情况 */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-xl text-slate-900 flex items-center gap-2">
                    <span className="bg-slate-200/70 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                      1
                    </span>
                    基本情况
                  </CardTitle>
                  <CardDescription>默认全部为 0/空值；填写后右侧实时更新。</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 pt-6">
                  <FormField
                    control={form.control}
                    name="hasSpouse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>婚姻状况与随行安排</FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => field.onChange(false)}
                              className={cn(
                                'rounded-xl border p-4 text-left transition-all',
                                field.value === false
                                  ? 'border-primary bg-primary/5 shadow-sm'
                                  : 'border-slate-200 hover:bg-slate-50',
                              )}
                            >
                              <div className="text-sm font-semibold text-slate-900">
                                单身 / 配偶不随行
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                按“单身”规则计算核心分。
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => field.onChange(true)}
                              className={cn(
                                'rounded-xl border p-4 text-left transition-all',
                                field.value === true
                                  ? 'border-primary bg-primary/5 shadow-sm'
                                  : 'border-slate-200 hover:bg-slate-50',
                              )}
                            >
                              <div className="text-sm font-semibold text-slate-900">
                                已婚且配偶随行
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                会启用“配偶因素（B）”。
                              </div>
                            </button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>年龄（周岁）</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              value={
                                field.value === undefined || field.value === null
                                  ? ''
                                  : Number(field.value)
                              }
                              onKeyDown={preventSciNotationKeyDown}
                              onPaste={preventSciNotationPaste}
                              onChange={(e) => {
                                const v = e.target.value;
                                field.onChange(v === '' ? 0 : clampIntInRange(v, 0, 99));
                              }}
                            />
                          </FormControl>
                          <FormDescription>17 岁以下或 45 岁及以上按 0 分计。</FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="educationLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>最高学历</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="请选择" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">未选择 / 无</SelectItem>
                              <SelectItem value="high_school">高中毕业</SelectItem>
                              <SelectItem value="one_year">1年制专科/证书</SelectItem>
                              <SelectItem value="two_year">2年制大专/文凭</SelectItem>
                              <SelectItem value="bachelors">本科（3年+）</SelectItem>
                              <SelectItem value="two_or_more">双学历（含一个3年+）</SelectItem>
                              <SelectItem value="masters">硕士 / 专业学位</SelectItem>
                              <SelectItem value="phd">博士</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 2. 语言能力 */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-xl text-slate-900 flex items-center gap-2">
                    <span className="bg-slate-200/70 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </span>
                    语言能力
                  </CardTitle>
                  <CardDescription>可直接输入 CLB/NCLC，或输入考试成绩自动换算。</CardDescription>
                </CardHeader>

                <CardContent className="space-y-8 pt-6">
                  <LanguageSection
                    basePath="firstLanguage"
                    testPath="firstLanguageTest"
                    title="第一官方语言"
                    subtitle="英语（IELTS/CELPIP/PTE）或法语（TEF/TCF）均可作为第一语言。"
                  />

                  <div className="pt-6 border-t border-slate-100">
                    <FormField
                      control={form.control}
                      name="secondLanguageEnabled"
                      render={({ field }) => (
                        <div className="flex items-center space-x-2 mb-4">
                          <Checkbox
                            id="second-lang"
                            checked={field.value}
                            onCheckedChange={(c) => field.onChange(!!c)}
                          />
                          <label
                            htmlFor="second-lang"
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            我有第二语言成绩（例如法语 TEF/TCF 或英语 IELTS/CELPIP/PTE）
                          </label>
                        </div>
                      )}
                    />

                    {showSecondLang && (
                      <div className="pl-4 border-l-2 border-slate-200">
                        <LanguageSection
                          basePath="secondLanguage"
                          testPath="secondLanguageTest"
                          title="第二官方语言"
                          subtitle="注意：第二语言在核心分（A）中有封顶。"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 3. 工作经验 */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-xl text-slate-900 flex items-center gap-2">
                    <span className="bg-slate-200/70 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </span>
                    工作经验
                  </CardTitle>
                </CardHeader>

                <CardContent className="grid gap-6 md:grid-cols-2 pt-6">
                  <FormField
                    control={form.control}
                    name="canadianWorkExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>加拿大工作经验（年）</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            value={
                              field.value === undefined || field.value === null
                                ? ''
                                : Number(field.value)
                            }
                            onKeyDown={preventSciNotationKeyDown}
                            onPaste={preventSciNotationPaste}
                            onChange={(e) => {
                              const v = e.target.value;
                              field.onChange(v === '' ? 0 : clampIntInRange(v, 0, 10));
                            }}
                          />
                        </FormControl>
                        <FormDescription>按 EE 定义口径；通常为 TEER 0/1/2/3。</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="foreignWorkExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>海外工作经验（年）</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            value={
                              field.value === undefined || field.value === null
                                ? ''
                                : Number(field.value)
                            }
                            onKeyDown={preventSciNotationKeyDown}
                            onPaste={preventSciNotationPaste}
                            onChange={(e) => {
                              const v = e.target.value;
                              field.onChange(v === '' ? 0 : clampIntInRange(v, 0, 10));
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          通常按近 10 年口径累计（以 EE 定义为准）。
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="certificateOfQualification"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-xl border p-4 md:col-span-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            持有加拿大省/联邦技工执业证书（Certificate of Qualification）
                          </FormLabel>
                          <div className="text-xs text-slate-500">用于技能可转移加分（C）。</div>
                        </div>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* 4. 配偶因素 */}
              {hasSpouse && (
                <Card className="overflow-hidden border-blue-200 bg-blue-50/30">
                  <CardHeader className="bg-blue-50/50 border-b border-blue-100">
                    <CardTitle className="text-xl text-slate-900 flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                        4
                      </span>
                      配偶/同居伴侣因素
                    </CardTitle>
                    <CardDescription>仅在“配偶随行”时计入（B）。</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6 pt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="spouseEducationLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>配偶学历</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="可不填（默认 0 分）" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">无 / 未选择</SelectItem>
                                <SelectItem value="high_school">高中毕业</SelectItem>
                                <SelectItem value="one_year">1年制专科</SelectItem>
                                <SelectItem value="two_year">2年制大专</SelectItem>
                                <SelectItem value="bachelors">本科</SelectItem>
                                <SelectItem value="two_or_more">双学历</SelectItem>
                                <SelectItem value="masters">硕士 / 专业学位</SelectItem>
                                <SelectItem value="phd">博士</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="spouseCanadianWorkExperience"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>配偶加拿大工作（年）</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                className="bg-white"
                                value={
                                  field.value === undefined || field.value === null
                                    ? ''
                                    : Number(field.value)
                                }
                                onKeyDown={preventSciNotationKeyDown}
                                onPaste={preventSciNotationPaste}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  field.onChange(v === '' ? undefined : clampIntInRange(v, 0, 10));
                                }}
                              />
                            </FormControl>
                            <FormDescription>可不填（默认 0 分）。</FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>

                    <LanguageSection
                      basePath="spouseLanguage"
                      testPath="spouseLanguageTest"
                      title="配偶语言（按 CLB/NCLC 计）"
                      subtitle="可不填（默认 0 分）。"
                      allowTestMode={true}
                    />
                  </CardContent>
                </Card>
              )}

              {/* 5. 附加分 */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-xl text-slate-900 flex items-center gap-2">
                    <span className="bg-slate-200/70 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                      5
                    </span>
                    附加加分项
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 pt-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="siblingInCanada"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 rounded-xl border p-3 bg-white">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="cursor-pointer font-normal">
                            加拿大兄弟姐妹（18 岁+ PR/公民）
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nominationCertificate"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 rounded-xl border p-3 bg-white">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="cursor-pointer font-normal">
                            省提名证书（PNP）
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="canadianEducation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>加拿大留学经历</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="未选择 / 无" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">无</SelectItem>
                              <SelectItem value="1_or_2_years">1年或2年大专/证书</SelectItem>
                              <SelectItem value="3_years_or_more">3年以上学位/硕士/博士</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  <button type="submit" className="hidden" />
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>

        {/* 右侧：实时得分面板（sticky 悬浮） */}
        <div className="lg:col-span-4" id="score-panel">
          <div className="lg:sticky lg:top-8 space-y-6">
            <Card className="shadow-lg overflow-hidden border-t-4 border-t-primary">
              <CardHeader className="bg-slate-50 border-b pb-4">
                <CardTitle className="text-center text-slate-500 text-sm font-medium uppercase tracking-wider">
                  总 CRS 分数
                </CardTitle>
                <div className="text-center mt-2">
                  <span
                    className={cn(
                      'text-6xl font-bold tracking-tighter transition-all duration-300',
                      scoreTone,
                    )}
                  >
                    {totalScore}
                  </span>
                </div>
                <div className="text-xs text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
                  <ArrowRightLeft className="w-3 h-3" />
                  修改表单后自动重新计算
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                <Section
                  title="A. 核心/人力资本"
                  subtitle={`小计封顶：${d?.core.cap ?? (hasSpouse ? 460 : 500)} 分`}
                >
                  <div className="p-3">
                    <ScoreRow label="年龄" value={d?.core.age ?? 0} />
                    <ScoreRow label="学历" value={d?.core.education ?? 0} />
                    <ScoreRow label="第一语言：阅读" value={d?.core.firstLanguage.reading ?? 0} />
                    <ScoreRow label="第一语言：写作" value={d?.core.firstLanguage.writing ?? 0} />
                    <ScoreRow label="第一语言：听力" value={d?.core.firstLanguage.listening ?? 0} />
                    <ScoreRow label="第一语言：口语" value={d?.core.firstLanguage.speaking ?? 0} />

                    <ScoreRow
                      label="第二语言：阅读"
                      value={d?.core.secondLanguage.reading ?? 0}
                      note={`第二语言小计封顶：${d?.core.secondLanguage.cap ?? (hasSpouse ? 22 : 24)} 分`}
                    />
                    <ScoreRow label="第二语言：写作" value={d?.core.secondLanguage.writing ?? 0} />
                    <ScoreRow
                      label="第二语言：听力"
                      value={d?.core.secondLanguage.listening ?? 0}
                    />
                    <ScoreRow label="第二语言：口语" value={d?.core.secondLanguage.speaking ?? 0} />
                    <ScoreRow
                      label="第二语言（计入）"
                      value={d?.core.secondLanguage.cappedTotal ?? 0}
                      note={`原始合计：${d?.core.secondLanguage.rawTotal ?? 0}`}
                    />

                    <ScoreRow label="加拿大工作经验" value={d?.core.canadianWork ?? 0} />

                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">A 小计（计入）</div>
                      <span className="inline-flex items-center justify-center min-w-[54px] h-8 px-2 rounded-md bg-slate-900 text-white font-bold">
                        {result?.breakdown.core ?? 0}
                      </span>
                    </div>
                  </div>
                </Section>

                <Section title="B. 配偶因素" subtitle="仅配偶随行时计分（封顶 40 分）">
                  <div className="p-3">
                    <ScoreRow
                      label="是否启用配偶计分"
                      value={hasSpouse ? 1 : 0}
                      note={hasSpouse ? '已启用（配偶随行）' : '未启用'}
                    />
                    <ScoreRow label="配偶学历" value={d?.spouse.education ?? 0} />
                    <ScoreRow label="配偶语言：阅读" value={d?.spouse.language.reading ?? 0} />
                    <ScoreRow label="配偶语言：写作" value={d?.spouse.language.writing ?? 0} />
                    <ScoreRow label="配偶语言：听力" value={d?.spouse.language.listening ?? 0} />
                    <ScoreRow label="配偶语言：口语" value={d?.spouse.language.speaking ?? 0} />
                    <ScoreRow label="配偶加拿大工作经验" value={d?.spouse.canadianWork ?? 0} />
                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">B 小计（计入）</div>
                      <span className="inline-flex items-center justify-center min-w-[54px] h-8 px-2 rounded-md bg-slate-900 text-white font-bold">
                        {result?.breakdown.spouse ?? 0}
                      </span>
                    </div>
                  </div>
                </Section>

                <Section
                  title="C. 技能可转移（交叉项）"
                  subtitle="总封顶 100 分（包含教育/海外经验/技工证书）"
                >
                  <div className="p-3">
                    <ScoreRow
                      label="教育 + 语言"
                      value={d?.transferability.education.eduLang ?? 0}
                    />
                    <ScoreRow
                      label="教育 + 加拿大工作"
                      value={d?.transferability.education.eduCanWork ?? 0}
                    />
                    <ScoreRow
                      label="教育子类（计入）"
                      value={d?.transferability.education.cappedSubtotal ?? 0}
                      note={`原始合计：${d?.transferability.education.subtotal ?? 0}，封顶：${d?.transferability.education.cap ?? 50}`}
                    />

                    <ScoreRow
                      label="海外经验 + 语言"
                      value={d?.transferability.foreignWork.foreignLang ?? 0}
                    />
                    <ScoreRow
                      label="海外经验 + 加拿大工作"
                      value={d?.transferability.foreignWork.foreignCan ?? 0}
                    />
                    <ScoreRow
                      label="海外子类（计入）"
                      value={d?.transferability.foreignWork.cappedSubtotal ?? 0}
                      note={`原始合计：${d?.transferability.foreignWork.subtotal ?? 0}，封顶：${d?.transferability.foreignWork.cap ?? 50}`}
                    />

                    <ScoreRow
                      label="技工证书（计入）"
                      value={d?.transferability.certificateOfQualification ?? 0}
                    />

                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">C 小计（计入）</div>
                      <span className="inline-flex items-center justify-center min-w-[54px] h-8 px-2 rounded-md bg-slate-900 text-white font-bold">
                        {result?.breakdown.transferability ?? 0}
                      </span>
                    </div>
                  </div>
                </Section>

                <Section title="D. 附加分" subtitle="总封顶 600 分（PNP、法语、教育、亲属等）">
                  <div className="p-3">
                    <ScoreRow label="省提名（PNP）" value={d?.additional.nomination ?? 0} />
                    <ScoreRow label="法语能力加分" value={d?.additional.french ?? 0} />
                    <ScoreRow label="加拿大教育加分" value={d?.additional.canadianEducation ?? 0} />
                    <ScoreRow label="加拿大兄弟姐妹" value={d?.additional.sibling ?? 0} />
                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">D 小计（计入）</div>
                      <span className="inline-flex items-center justify-center min-w-[54px] h-8 px-2 rounded-md bg-slate-900 text-white font-bold">
                        {result?.breakdown.additional ?? 0}
                      </span>
                    </div>
                  </div>
                </Section>
              </CardContent>

              <CardFooter className="bg-slate-50 border-t p-4 flex flex-col gap-3">
                {user ? (
                  <Button
                    onClick={handleSaveResult}
                    disabled={isSaving || !result}
                    className="w-full shadow-sm"
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    保存到我的记录
                  </Button>
                ) : (
                  <Button asChild variant="secondary" className="w-full">
                    <Link href={`/login?redirect=/tools/ee-score`}>登录后可保存结果</Link>
                  </Button>
                )}

                <div className="text-xs text-center text-slate-400">
                  默认输入均为 0，右侧总分默认为 0；填写后自动更新。
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
