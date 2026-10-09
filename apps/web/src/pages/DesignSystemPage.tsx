import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Input,
  Badge,
  VerificationBadge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Quote,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  Drawer,
  Toast,
  Skeleton,
  EmptyState,
  ErrorState,
  Toggle,
  Sheet,
} from '../components/ui/index.js';
import { useTheme } from '../theme.js';
import { THEMES, type ThemeId } from '@juris/shared';
import { Moon, Sun, Monitor } from 'lucide-react';
import { loadJurisECharts } from '../lib/echarts.js';

export const DesignSystemPage: React.FC = () => {
  const { theme, setTheme, resolvedTheme, isDark } = useTheme();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [toggleSample, setToggleSample] = useState(true);
  const [isToastVisible, setIsToastVisible] = useState(true);
  const [inputValue, setInputValue] = useState('New Delhi Municipal Council');
  const [inputError, setInputError] = useState('');
  const chartRef = useRef<HTMLDivElement>(null);

  // Lazy load modular echarts for the sample civic visualization
  useEffect(() => {
    let chartInstance: {
      dispose: () => void;
      setOption: (opt: object) => void;
      resize: () => void;
    } | null = null;

    loadJurisECharts().then(({ init }) => {
      if (chartRef.current) {
        chartInstance = init(chartRef.current, isDark ? 'juris-dark' : 'juris-light');
        chartInstance.setOption({
          title: {
            text: 'Civic Budget Expenditure Analysis (2026-27)',
            subtext: 'Values in ₹ Crore (Source: NDMC Budget Document)',
          },
          tooltip: { trigger: 'axis' },
          legend: { data: ['Budget Estimate', 'Revised Estimate', 'Actual Outlay'] },
          xAxis: {
            type: 'category',
            data: [
              'Water & Sewerage',
              'Public Health',
              'Road Infrastructure',
              'Education',
              'Electricity',
            ],
          },
          yAxis: { type: 'value' },
          series: [
            {
              name: 'Budget Estimate',
              type: 'bar',
              data: [520.4, 430.1, 890.5, 310.2, 640.8],
            },
            {
              name: 'Revised Estimate',
              type: 'bar',
              data: [490.2, 445.0, 810.0, 305.1, 620.0],
            },
            {
              name: 'Actual Outlay',
              type: 'line',
              data: [475.6, 420.8, 780.2, 290.4, 595.3],
            },
          ],
        });
      }
    });

    const handleResize = () => chartInstance?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance?.dispose();
    };
  }, [isDark]);

  return (
    <div className="min-h-screen bg-bg text-text p-6 md:p-12 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header with Theme Switcher */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-caption font-mono text-accent-teal bg-accent-teal-subtle px-2 py-0.5 rounded border border-accent-teal-border">
                Juris Design System v1.0
              </span>
              <span className="text-caption font-mono text-text-muted">
                Document-like & Verifiable
              </span>
            </div>
            <h1 className="text-display font-serif font-bold text-text">
              Design Tokens & Component Library
            </h1>
            <p className="text-body text-text-muted mt-1 font-sans">
              Calm, precise, high-trust civic intelligence design system with 100% WCAG AA contrast
              compliance.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-1.5 bg-surface border border-border rounded-lg self-start">
            <div className="flex items-center gap-1">
              {(['matcha-light', 'matcha-dark', 'mono-light', 'mono-dark'] as ThemeId[]).map(
                (tId) => {
                  const meta = THEMES[tId];
                  const isActive = resolvedTheme === tId && theme !== 'system';
                  return (
                    <button
                      key={tId}
                      onClick={() => setTheme(tId)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                        isActive
                          ? 'bg-accent-teal text-[var(--btn-primary-text)] shadow-xs font-semibold'
                          : 'text-text-muted hover:text-text hover:bg-surface-raised'
                      }`}
                    >
                      {meta.label}
                    </button>
                  );
                },
              )}
            </div>

            <div className="h-4 w-px bg-border hidden sm:block" />

            <div className="flex items-center gap-1">
              <button
                onClick={() => setTheme('matcha-light')}
                aria-label="Light theme"
                title="Matcha Light"
                className={`p-1.5 rounded-md transition-colors ${theme === 'matcha-light' || (theme as string) === 'light' ? 'bg-surface-raised text-accent-teal shadow-xs' : 'text-text-muted hover:text-text'}`}
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('matcha-dark')}
                aria-label="Dark theme"
                title="Matcha Dark"
                className={`p-1.5 rounded-md transition-colors ${theme === 'matcha-dark' || (theme as string) === 'dark' ? 'bg-surface-raised text-accent-teal shadow-xs' : 'text-text-muted hover:text-text'}`}
              >
                <Moon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('system')}
                aria-label="System theme"
                title={`System (${resolvedTheme})`}
                className={`p-1.5 rounded-md transition-colors ${theme === 'system' ? 'bg-surface-raised text-accent-teal shadow-xs' : 'text-text-muted hover:text-text'}`}
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* 1. Color Palette Grid */}
        <section className="space-y-4">
          <h2 className="text-h2 font-serif font-semibold text-text">
            1. Color Tokens & Semantic Roles
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { name: 'bg', var: 'bg-bg', border: 'border-border' },
              { name: 'surface', var: 'bg-surface', border: 'border-border' },
              {
                name: 'brand-navy',
                var: 'bg-brand-navy',
                border: 'border-transparent',
                text: 'text-white dark:text-bg',
              },
              {
                name: 'accent-teal',
                var: 'bg-accent-teal',
                border: 'border-transparent',
                text: 'text-white dark:text-bg',
              },
              {
                name: 'verified',
                var: 'bg-verified',
                border: 'border-transparent',
                text: 'text-white dark:text-bg',
              },
              {
                name: 'unverified',
                var: 'bg-unverified',
                border: 'border-transparent',
                text: 'text-white dark:text-bg',
              },
              {
                name: 'failed',
                var: 'bg-failed',
                border: 'border-transparent',
                text: 'text-white dark:text-bg',
              },
              { name: 'quote-highlight', var: 'bg-quote-highlight', border: 'border-quote-border' },
              { name: 'text', var: 'bg-text', border: 'border-transparent', text: 'text-bg' },
              {
                name: 'text-muted',
                var: 'bg-text-muted',
                border: 'border-transparent',
                text: 'text-white dark:text-bg',
              },
              { name: 'border', var: 'bg-border', border: 'border-border-strong' },
              {
                name: 'focus-ring',
                var: 'bg-focus-ring',
                border: 'border-transparent',
                text: 'text-white dark:text-bg',
              },
            ].map((c) => (
              <div
                key={c.name}
                className="p-3 rounded-lg bg-surface border border-border flex flex-col gap-2"
              >
                <div
                  className={`h-12 w-full rounded border ${c.var} ${c.border} flex items-center justify-center text-caption font-mono font-medium ${c.text || 'text-text'}`}
                >
                  Aa
                </div>
                <span className="text-caption font-mono font-semibold text-text">{c.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Typography Hierarchy */}
        <section className="space-y-4">
          <h2 className="text-h2 font-serif font-semibold text-text">
            2. Typography Scale (Self-Hosted Stacks)
          </h2>
          <Card className="divide-y divide-border-subtle">
            <div className="p-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
              <span className="text-caption font-mono text-text-muted w-36">
                Display (36px / 700)
              </span>
              <h1 className="text-display font-serif font-bold text-text flex-1">
                Annual Financial Budget 2026-27
              </h1>
            </div>
            <div className="p-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
              <span className="text-caption font-mono text-text-muted w-36">
                H1 Heading (30px / 600)
              </span>
              <h1 className="text-h1 font-serif font-semibold text-text flex-1">
                Executive Summary & Audit Findings
              </h1>
            </div>
            <div className="p-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
              <span className="text-caption font-mono text-text-muted w-36">
                H2 Heading (24px / 600)
              </span>
              <h2 className="text-h2 font-serif font-semibold text-text flex-1">
                Departmental Receipts & Revenue Outlay
              </h2>
            </div>
            <div className="p-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
              <span className="text-caption font-mono text-text-muted w-36">
                H3 Heading (20px / 600)
              </span>
              <h3 className="text-h3 font-serif font-semibold text-text flex-1">
                Water Supply & Sewerage Services
              </h3>
            </div>
            <div className="p-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
              <span className="text-caption font-mono text-text-muted w-36">
                Body Text (16px / 400)
              </span>
              <p className="text-body font-sans text-text flex-1">
                The budget estimates for the year 2026-27 provide for total receipts of ₹5,211.92
                Crore against revised estimates of ₹4,890.15 Crore for the preceding financial year.
              </p>
            </div>
            <div className="p-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
              <span className="text-caption font-mono text-text-muted w-36">
                Mono & Tabular (14px)
              </span>
              <p className="text-mono-code font-mono text-text tabular-nums flex-1">
                KEY_FIGURE: ₹5,211.92 Cr | VARIANCE: +6.58% | CITATION: BE 2026-27 (p. 33, Line 12)
              </p>
            </div>
          </Card>
        </section>

        {/* 3. Verification States (Grayscale Accessible) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h2 font-serif font-semibold text-text">
              3. Verification Badges (Icon + Label + Grayscale Tested)
            </h2>
            <span className="text-caption font-mono text-text-muted">
              Accessible without color cues
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-small font-medium font-sans text-text">
                  Verified (Solid Border + Icon)
                </span>
                <VerificationBadge variant="verified" page={33} />
              </div>
              <p className="text-small text-text-muted">
                Extracted figure exactly matches source text and number on target PDF page.
              </p>
            </Card>

            <Card className="p-5 flex flex-col gap-3 border-dashed">
              <div className="flex items-center justify-between">
                <span className="text-small font-medium font-sans text-text">
                  Unverified (Dashed + Alert)
                </span>
                <VerificationBadge variant="unverified" page={45} />
              </div>
              <p className="text-small text-text-muted">
                Candidate numeric claim pending OCR crosscheck or multi-page verification.
              </p>
            </Card>

            <Card className="p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-small font-medium font-sans text-text">
                  Failed (Distinct Cross + Solid)
                </span>
                <VerificationBadge variant="failed" page={12} />
              </div>
              <p className="text-small text-text-muted">
                Verification failed due to quote discrepancy or arithmetic mismatch.
              </p>
            </Card>
          </div>
        </section>

        {/* 4. Verbatim Quote Component */}
        <section className="space-y-4">
          <h2 className="text-h2 font-serif font-semibold text-text">
            4. Verbatim Quote Component (Mono Exact Citation)
          </h2>
          <Quote page={33}>
            "The Budget Estimates 2026-27 for revenue receipts are ₹5,211.92 Crore against Revised
            Estimates 2025-26 of ₹4,890.15 Crore."
          </Quote>
        </section>

        {/* 5. Interactive Primitives Showcase */}
        <section className="space-y-6">
          <h2 className="text-h2 font-serif font-semibold text-text">
            5. UI Primitives & Interactive States
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Button Variants & States</CardTitle>
                <CardDescription>
                  Primary teal, secondary navy outline, ghost, and destructive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <Button variant="primary" size="md">
                    Primary Action
                  </Button>
                  <Button variant="secondary" size="md">
                    Secondary Outline
                  </Button>
                  <Button variant="ghost" size="md">
                    Ghost Button
                  </Button>
                  <Button variant="destructive" size="md">
                    Destructive
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <Button variant="primary" size="sm">
                    Small
                  </Button>
                  <Button variant="primary" size="md">
                    Medium
                  </Button>
                  <Button variant="primary" size="lg">
                    Large Target
                  </Button>
                  <Button variant="primary" size="md" isLoading>
                    Loading
                  </Button>
                  <Button variant="primary" size="md" disabled>
                    Disabled
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-border-subtle">
                  <span className="text-caption font-mono text-text-muted mr-1">Tags & Chips:</span>
                  <Badge variant="neutral">AUDIT_2026</Badge>
                  <Badge variant="teal">CIVIC_BUDGET</Badge>
                  <Badge variant="navy">NDMC_DELHI</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Inputs */}
            <Card>
              <CardHeader>
                <CardTitle>Form Inputs</CardTitle>
                <CardDescription>
                  With label, helper text, error states, and 44px min-touch target.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Document Title"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  helperText="Official title extracted from header"
                />
                <Input
                  label="Fiscal Year Code"
                  placeholder="e.g. 2026-27"
                  error={inputError}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !/^\d{4}-\d{2}$/.test(val)) {
                      setInputError('Must match format YYYY-YY (e.g. 2026-27)');
                    } else {
                      setInputError('');
                    }
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Tabs, Dialog & Drawer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tabs Primitive</CardTitle>
                <CardDescription>
                  Document section switching with keyboard navigation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Executive Overview</TabsTrigger>
                    <TabsTrigger value="facts">Verified Facts</TabsTrigger>
                    <TabsTrigger value="risks">Risk Analysis</TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="overview"
                    className="p-3 bg-surface rounded-md border border-border text-small text-text-muted"
                  >
                    Comprehensive overview of civic appropriations, receipts, and statutory
                    compliance indicators.
                  </TabsContent>
                  <TabsContent
                    value="facts"
                    className="p-3 bg-surface rounded-md border border-border text-small text-text-muted"
                  >
                    Catalog of 25 quantitative figures cross-verified against page text layers.
                  </TabsContent>
                  <TabsContent
                    value="risks"
                    className="p-3 bg-surface rounded-md border border-border text-small text-text-muted"
                  >
                    Identified fiscal variances and multi-year capital outlay execution risks.
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Modals & Overlays</CardTitle>
                <CardDescription>
                  Accessible Dialog and Citation Drawer with focus containment.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
                  Open Verification Dialog
                </Button>
                <Button variant="secondary" onClick={() => setIsDrawerOpen(true)}>
                  Open Citation Drawer
                </Button>

                <Button variant="secondary" onClick={() => setIsSheetOpen(true)}>
                  Open Slide-Over Sheet
                </Button>

                {isToastVisible && (
                  <div className="w-full mt-2">
                    <Toast
                      type="success"
                      title="Ingestion Pipeline Completed"
                      message="10/10 stages finished with 100% quote verification."
                      onDismiss={() => setIsToastVisible(false)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interactive Switches & Toggles</CardTitle>
                <CardDescription>
                  Accessible ARIA switches with keyboard and focus support.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Toggle
                  checked={toggleSample}
                  onChange={setToggleSample}
                  label="Show Unverified Citations"
                  description="Highlight bounding boxes for candidate facts pending verification"
                />
                <Toggle
                  checked={!toggleSample}
                  onChange={(c) => setToggleSample(!c)}
                  size="sm"
                  label="Compact View Mode"
                />
              </CardContent>
            </Card>
          </div>

          {/* Skeleton, Empty & Error States */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-5 flex flex-col gap-3">
              <h4 className="text-small font-medium font-sans text-text">Loading Skeleton</h4>
              <Skeleton height={24} width="70%" />
              <Skeleton height={16} width="100%" />
              <Skeleton height={16} width="85%" />
              <div className="flex gap-2 mt-2">
                <Skeleton height={36} width={80} />
                <Skeleton height={36} width={80} />
              </div>
            </Card>

            <EmptyState
              title="No Documents Uploaded"
              description="Upload civic budget PDFs or audit reports to begin semantic extraction."
              actionLabel="Upload Sample Document"
              onAction={() => alert('Sample upload triggered')}
            />

            <ErrorState
              title="Extraction Timed Out"
              message="Worker could not parse corrupt PDF stream."
              code="CORRUPT_STREAM_ERR"
              onRetry={() => alert('Retrying extraction')}
            />
          </div>
        </section>

        {/* 6. Lazy-Loaded Civic Chart Preview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h2 font-serif font-semibold text-text">
              6. ECharts Civic Theme Preview
            </h2>
            <span className="text-caption font-mono text-text-muted">
              Okabe-Ito Palette & Dynamic Theme Switch
            </span>
          </div>
          <Card className="p-6">
            <div ref={chartRef} className="w-full h-80" />
          </Card>
        </section>

        {/* Dialog & Drawer Modals */}
        <Dialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          title="Fact Verification Inspection"
          description="Source quote verification and page geometry coordinates."
        >
          <div className="space-y-4">
            <Quote page={33} citation="Paragraph 12, Line 4">
              "BE 2026-27 for revenue receipts are ₹5,211.92 Crore against RE 2025-26 of ₹4,890.15
              Crore."
            </Quote>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => setIsDialogOpen(false)}>
                Approve Quote
              </Button>
            </div>
          </div>
        </Dialog>

        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Document Citations Drawer"
        >
          <div className="space-y-4">
            <p className="text-small text-text-muted font-sans">
              All cited figures from the current document slice with exact page references.
            </p>
            <div className="space-y-3">
              {[
                {
                  page: 33,
                  label: 'Revenue Receipts',
                  value: '₹5,211.92 Cr',
                  status: 'verified' as const,
                },
                {
                  page: 35,
                  label: 'Capital Outlay',
                  value: '₹741.15 Cr',
                  status: 'verified' as const,
                },
                {
                  page: 42,
                  label: 'Water Grant Allocation',
                  value: '₹230.28 Cr',
                  status: 'unverified' as const,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-3 bg-surface-raised border border-border rounded-lg flex items-center justify-between"
                >
                  <div>
                    <span className="text-caption font-mono text-text-muted">p. {item.page}</span>
                    <h4 className="text-small font-medium text-text">{item.label}</h4>
                    <p className="text-mono-code font-mono text-accent-teal tabular-nums">
                      {item.value}
                    </p>
                  </div>
                  <VerificationBadge variant={item.status} page={item.page} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </Drawer>

        <Sheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          title="Evidence Graph Inspection Sheet"
          description="Multimodal evidence node provenance and spatial verification."
        >
          <div className="space-y-4">
            <p className="text-small text-text-muted">
              Slide-over sheet with accessible ARIA focus trap and keyboard navigation.
            </p>
            <div className="p-4 bg-surface rounded-lg border border-border text-xs font-mono text-text">
              Fact ID: 8f24a1b0-9c32-4d1e-8e44-11a9f032d84a
              <br />
              Proof Type: VERIFIED_OCR
              <br />
              Confidence: 0.99
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsSheetOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Sheet>
      </div>
    </div>
  );
};
