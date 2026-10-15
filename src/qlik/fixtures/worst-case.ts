import type { AnalyticsApp, Assistant } from '@/domain';

import { fixtureAnalyticsApps, fixtureAssistants } from './data';

/**
 * Worst-case data for the web preview (break-ui). Every value is one a real Tenant can hold: several
 * come from a live Tenant (`zzz`, `Finance Billing & Accrual app(1)`, two apps named `Test`,
 * `CLASSIC CHATTTTT`). Neither Qlik API documents a name limit, and this app sets none.
 * Picked in dev builds with `?data=` on the web preview URL (src/qlik/context.tsx).
 */
export type FixtureData = { apps: AnalyticsApp[]; assistants: Assistant[] };
export type FixtureDataName = 'demo' | 'worst' | 'empty' | 'one' | 'many';

const now = Date.now();
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
const DAY = 24 * 60 * 60 * 1000;

const app = (id: string, name: string, updatedAt: string, hasThumbnail = false): AnalyticsApp => ({
  id,
  name,
  updatedAt,
  hasThumbnail,
});

// Spread across the first rows, as real data is: what shows on screen first matters most.
const worstApps: AnalyticsApp[] = [
  app('w1', 'Konsolidierter Konzernabschluss – Monatsberichterstattung Q3 2026 (Entwurf, nicht freigegeben)', iso(-3 * 60 * 1000)),
  app('w2', 'zzz', iso(-2 * DAY)),
  app('w3', 'Transform_KLogistikus_Extractor_RawLayer_SWIFT_MT940_v4.0.4', iso(-40 * DAY)),
  app('w4', 'Test', iso(-14 * DAY)),
  app('w5', 'Test', iso(-14 * DAY)),
  app('w6', 'Finance Billing & Accrual app(1)', iso(2 * 60 * 1000)), // device clock behind the Tenant's
  app('w7', 'Đặng Thị Ngọc Hân – Báo cáo doanh thu theo khu vực', iso(-400 * DAY)),
  app('w8', 'تحليل المبيعات الإقليمية للربع الثالث', iso(-5 * 60 * 60 * 1000)),
  app('w9', '销售分析仪表板与区域业绩汇总', iso(-9 * DAY)),
  app('w10', 'Q', iso(-1 * DAY)),
  app('w11', 'Sales Analysis', ''), // no updatedAt
  app('w12', 'Benachrichtigungseinstellungsübersichtsdashboard', '1970-01-01T00:00:00Z'),
];

const longDescription =
  'Answers questions about leave, benefits, travel, expenses, relocation and every other people policy for ' +
  'employees in Singapore, Malaysia, Indonesia, the Philippines and Vietnam, using the handbooks the HR team ' +
  'publishes each quarter. It does not cover payroll, which has its own Assistant.';

const worstAssistants: Assistant[] = [
  { kind: 'classic', id: 'wa1', name: 'Qlik Answers App (Classic)', description: '' },
  { kind: 'classic', id: 'wa2', name: 'CLASSIC CHATTTTT', description: 'Line one of the description\nLine two of it' },
  { kind: 'classic', id: 'wa3', name: 'Kebijakan Sumber Daya Manusia dan Tunjangan Karyawan Wilayah Asia Pasifik', description: longDescription },
  { kind: 'classic', id: 'wa4', name: 'HR', description: '<b>Internal</b> &amp; confidential' },
  { kind: 'classic', id: 'wa5', name: 'Sales Insights', description: 'APAC region' },
  { kind: 'classic', id: 'wa6', name: 'Sales Insights', description: 'EMEA region' },
  { kind: 'classic', id: 'wa7', name: 'Asistente_RRHH_España_Portugal_v2_FINAL', description: '' },
  { kind: 'classic', id: 'wa8', name: 'نور الهدى – سياسات الموارد البشرية', description: '' },
];

const manyApps = Array.from({ length: 120 }, (_, i) =>
  app(`m${i + 1}`, `Regional performance ${i + 1}`, iso(-i * 7 * 60 * 60 * 1000)),
);
const manyAssistants: Assistant[] = Array.from({ length: 40 }, (_, i) => ({
  kind: 'classic',
  id: `ma${i + 1}`,
  name: `Policy Assistant ${i + 1}`,
  description: i % 3 === 0 ? 'Answers from the policy handbook.' : '',
}));

export const fixtureDataSets: Record<FixtureDataName, FixtureData> = {
  demo: { apps: fixtureAnalyticsApps, assistants: fixtureAssistants },
  worst: { apps: worstApps, assistants: worstAssistants },
  empty: { apps: [], assistants: [] },
  one: { apps: [worstApps[1]], assistants: [worstAssistants[0]] },
  many: { apps: manyApps, assistants: manyAssistants },
};
