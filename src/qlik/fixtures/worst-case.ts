import type { AnalyticsApp, Answer, Assistant, Citation } from '@/domain';

import { fixtureAnalyticsApps, fixtureAssistants } from './data';

/**
 * Worst-case data for the web preview (break-ui). Every value is one a real Tenant can hold: several
 * come from a live Tenant (`zzz`, `Finance Billing & Accrual app(1)`, two apps named `Test`,
 * `CLASSIC CHATTTTT`). Neither Qlik API documents a name limit, and this app sets none.
 * Picked in dev builds with `?data=` on the web preview URL (src/qlik/context.tsx).
 */
export type FixtureData = {
  apps: AnalyticsApp[];
  assistants: Assistant[];
  /** Answers for this dataset, picked by the question. Absent, or no match: the demo Answers. */
  answerFor?: (question: string) => Answer | undefined;
};
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

const text = (markdown: string, citations: Citation[] = []): Answer => ({ blocks: [{ kind: 'text', markdown }], citations });

// Wide enough that five columns of real policy data cannot fit a phone.
const wideTable = text(
  [
    'Here are the 2026 travel limits by office:',
    '',
    '| Office | Per diem (SGD) | Hotel cap per night (SGD) | Business class threshold | Approver |',
    '|---|---|---|---|---|',
    '| Singapore | 120.00 | 350.00 | Flights over 6 hours | Regional Head of People & Culture |',
    '| Kuala Lumpur | 95.00 | 280.00 | Flights over 8 hours | Country Finance Controller |',
    '| Jakarta | 1,284,500.00 IDR | 2,450,000.00 IDR | Never | Chief Executive Officer |',
  ].join('\n'),
);

// A Qlik set-analysis expression: one long line with no spaces to break at.
const longCode = text(
  [
    'Use this expression in the sheet:',
    '',
    '```',
    "Sum({<Year={2026},Region={'APAC'},CostCenter={'CC-4410','CC-4420','CC-4431'},ClaimStatus={'Approved'}>}ReimbursementAmountLocalCurrency)/Count(DISTINCT EmployeeID)",
    '```',
  ].join('\n'),
);

const longUrl = text(
  'The full policy is at https://intranet.malayan.example.com/hr/policies/travel-and-expense/apac/2026/HR-POL-2026-0042-REV-07.pdf?version=7&lang=en and the summary is [HR-POL-2026-0042-REV-07_APAC_Travel&Expense_Consolidated_FINAL](https://intranet.malayan.example.com/hr/policies/summary).',
);

const citationFiles = [
  'Q3 Board Deck — FINAL (revised) v12 [approved by legal].pdf',
  'HR-POL-2026-0042-REV-07_APAC_Travel&Expense_Consolidated.pdf',
  'IMG_20250914_183022_HDR_portrait_edited_edited.HEIC',
  'Employee Handbook 2026.pdf',
  'Handbook.pdf',
  'Handbook.pdf',
  'Kebijakan Perjalanan Dinas dan Penggantian Biaya Karyawan 2026.docx',
  'travel-faq.md',
  'Benefits Overview (Singapore, Malaysia, Indonesia, Philippines, Vietnam).pptx',
  'Reimbursement_Rates_Q3.xlsx',
  'Policy.pdf',
  'Memo from the CFO regarding per diem changes effective 1 October 2026.pdf',
];
const manyCitations = text(
  'Business-class travel needs the approval listed for each office in the travel policy.',
  citationFiles.map((documentPath, i) => ({
    documentId: `wc-doc-${i}`,
    knowledgeBaseId: 'wc-kb',
    documentPath,
    excerpts: i % 3 === 0 ? [longExcerpt(i)] : i % 3 === 1 ? ['Approval is required.'] : [],
  })),
);
function longExcerpt(i: number): string {
  return `Section ${i + 1}.4: Employees travelling on flights longer than six hours may book business class with prior written approval from the approver listed in Appendix B, provided the booking is made at least 14 days before departure and the fare does not exceed 1.5 times the economy fare on the same route.`;
}

// About 4,000 characters: what a thorough policy Answer really runs to.
const longAnswer = text(
  [
    '# Travel and expense policy for APAC, 2026',
    '',
    ...Array.from({ length: 9 }, (_, i) =>
      [
        `## ${['Booking', 'Approval', 'Per diem', 'Hotels', 'Flights', 'Ground transport', 'Meals', 'Receipts', 'Exceptions'][i]}`,
        '',
        'Employees must follow the rules in this section for every trip, whether domestic or international, and keep all receipts until the claim is approved. Managers are responsible for checking that each claim matches the trip purpose stated in the original request.',
        '',
        '- Submit the request at least 14 days before departure.',
        '- Attach the itinerary and the cost estimate.',
      ].join('\n'),
    ),
  ].join('\n\n'),
);

const worstAnswerFor = (question: string): Answer | undefined => {
  if (/limit|table/i.test(question)) return wideTable;
  if (/expression|code/i.test(question)) return longCode;
  if (/where|link|url/i.test(question)) return longUrl;
  if (/approv|source/i.test(question)) return manyCitations;
  if (/everything|full|long/i.test(question)) return longAnswer;
  if (/^is |^does |^can /i.test(question)) return text('Yes.');
  return undefined;
};

export const fixtureDataSets: Record<FixtureDataName, FixtureData> = {
  demo: { apps: fixtureAnalyticsApps, assistants: fixtureAssistants },
  worst: { apps: worstApps, assistants: worstAssistants, answerFor: worstAnswerFor },
  empty: { apps: [], assistants: [] },
  one: { apps: [worstApps[1]], assistants: [worstAssistants[0]] },
  many: { apps: manyApps, assistants: manyAssistants },
};
