import React, { useMemo } from 'react';
import type { DocumentFactDetail, VisualSpec, VisualSeriesPoint } from '@juris/shared';
import { selectVisualSpecs } from '@juris/shared';
import { VisualCard } from './VisualCard.js';
import { useVisualSelection } from '../../lib/selection-store.js';
import { FileText, Sparkles } from 'lucide-react';

interface OverviewStoryboardProps {
  facts: DocumentFactDetail[];
  documentName: string;
  verificationRate?: number;
  pageCount?: number;
  onSelectFact?: (factId: string) => void;
  onOpenInsight?: (spec: VisualSpec) => void;
}

export const OverviewStoryboard: React.FC<OverviewStoryboardProps> = ({
  facts,
  documentName,
  verificationRate = 100,
  pageCount = 1,
  onSelectFact,
  onOpenInsight,
}) => {
  const { includeEstimates, category: selectedCategory } = useVisualSelection();

  // Deterministic chart selector picks candidate visual specifications
  const visualSpecs = useMemo(() => {
    let filteredFacts = facts;
    if (selectedCategory) {
      filteredFacts = facts.filter(
        (f) =>
          f.label.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          f.type === selectedCategory,
      );
    }
    return selectVisualSpecs(filteredFacts, { includeEstimates, maxCandidates: 6 });
  }, [facts, includeEstimates, selectedCategory]);

  const verifiedFactsCount = facts.filter((f) => f.verified).length;

  const handlePointSelect = (point: VisualSeriesPoint) => {
    const firstFactId = point.factIds?.[0];
    if (firstFactId && onSelectFact) {
      onSelectFact(firstFactId);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Storyboard Header: What is this document */}
      <div className="p-6 rounded-2xl bg-surface border border-border space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-accent-teal/10 text-accent-teal border border-accent-teal/20">
                Document At A Glance
              </span>
              <span className="text-xs text-text-muted">•</span>
              <span className="text-xs text-text-muted">{pageCount} Pages</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text tracking-tight">
              {documentName}
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-surface-raised border border-border text-center">
              <p className="text-[11px] text-text-muted font-medium">Verification Rate</p>
              <p className="text-base font-bold font-mono text-accent-teal dark:text-emerald-400">
                {verificationRate.toFixed(1)}%
              </p>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-surface-raised border border-border text-center">
              <p className="text-[11px] text-text-muted font-medium">Verified Facts</p>
              <p className="text-base font-bold font-mono text-text">{verifiedFactsCount}</p>
            </div>
          </div>
        </div>

        {/* 1-Minute Layman Synopsis */}
        <div className="p-4 rounded-xl bg-surface-raised/60 border border-border text-xs text-text-muted flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-accent-teal shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-text">Deterministic Visual Intelligence</p>
            <p className="mt-0.5 leading-relaxed">
              Every chart below was chosen deterministically from verified numerical records. Tap
              any figure or chart bar to inspect its exact quote on page.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Visual Cards Flow */}
      {visualSpecs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface border border-dashed border-border space-y-3">
          <FileText className="w-8 h-8 text-text-muted mx-auto" />
          <h3 className="text-sm font-semibold text-text">No Proven Charts Available</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Juris never generates speculative charts. When verified quantitative allocations are
            extracted, visual cards will appear automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {visualSpecs.map((spec: VisualSpec) => (
            <VisualCard
              key={spec.id}
              spec={spec}
              onSelectPoint={handlePointSelect}
              onOpenInsight={onOpenInsight}
            />
          ))}
        </div>
      )}
    </div>
  );
};
