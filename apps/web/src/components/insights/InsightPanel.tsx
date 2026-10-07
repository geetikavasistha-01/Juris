import React, { useMemo } from 'react';
import type { VisualSpec, DocumentFactDetail, InsightClaim } from '@juris/shared';
import { generateDeterministicInsights } from '@juris/shared';
import { ProofBadge } from '../visuals/ProofBadge.js';
import { Sparkles, ShieldCheck, ExternalLink, X, Info } from 'lucide-react';
import { haptics } from '../../lib/haptics.js';

interface InsightPanelProps {
  spec: VisualSpec;
  facts: DocumentFactDetail[];
  onSelectFact?: (factId: string) => void;
  onClose?: () => void;
}

export const InsightPanel: React.FC<InsightPanelProps> = ({
  spec,
  facts,
  onSelectFact,
  onClose,
}) => {
  const insight = useMemo(() => {
    return generateDeterministicInsights(spec, facts);
  }, [spec, facts]);

  const factsMap = useMemo(() => {
    return new Map(facts.map((f) => [f.id, f]));
  }, [facts]);

  const handleFactClick = (factId: string) => {
    haptics.trigger('selection');
    if (onSelectFact) {
      onSelectFact(factId);
    }
  };

  return (
    <div className="rounded-2xl bg-surface border border-border p-5 space-y-4 shadow-sm animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-teal/10 flex items-center justify-center text-accent-teal">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-text">
              Plain-Language Proven Insights
            </h3>
            <p className="text-[11px] text-text-muted">{spec.title} • 100% mechanically grounded</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-raised text-text-muted border border-border">
            Deterministic Engine
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-raised transition-colors"
              aria-label="Close insight panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Summary Banner */}
      <div className="p-3.5 rounded-xl bg-surface-raised/80 border border-border text-xs leading-relaxed text-text">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-accent-teal shrink-0 mt-0.5" />
          <p className="font-medium text-text">{insight.summary}</p>
        </div>
      </div>

      {/* Structured Claims List */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-text-muted flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>Grounded Claims & Citations</span>
        </h4>

        <div className="space-y-2.5">
          {insight.claims.map((claim: InsightClaim) => (
            <div
              key={claim.id}
              className="p-3.5 rounded-xl bg-surface-raised/40 border border-border space-y-2.5 hover:border-accent-teal/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-text font-normal leading-relaxed">{claim.claimText}</p>
                <ProofBadge proofType={claim.proofType} />
              </div>

              {/* Cited Facts Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60">
                <span className="text-[10px] text-text-muted">Sources:</span>
                {claim.factIds.map((fId: string) => {
                  const fact = factsMap.get(fId);
                  const label = fact ? `${fact.label} (${fact.value})` : `Fact #${fId.slice(0, 8)}`;
                  return (
                    <button
                      key={fId}
                      type="button"
                      onClick={() => handleFactClick(fId)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface hover:bg-accent-teal/10 hover:text-accent-teal border border-border hover:border-accent-teal/30 text-text-muted transition-all"
                      title="Inspect exact fact quote on page"
                    >
                      <span>{label}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
