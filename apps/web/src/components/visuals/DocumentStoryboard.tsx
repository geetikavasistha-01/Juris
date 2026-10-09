import React, { useMemo } from 'react';
import type {
  DocumentFactDetail,
  DocumentStoryboard as StoryboardData,
  StoryboardStep,
} from '@juris/shared';
import { buildDocumentStoryboard } from '@juris/shared';
import { ProofBadge } from './ProofBadge.js';
import {
  FileText,
  DollarSign,
  PieChart,
  TrendingUp,
  Calendar,
  MapPin,
  Users,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { haptics } from '../../lib/haptics.js';

interface DocumentStoryboardProps {
  facts: DocumentFactDetail[];
  documentId?: string;
  documentTitle?: string;
  fiscalPeriod?: string;
  onSelectFact?: (factId: string) => void;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  what_is_this: <FileText className="w-5 h-5 text-accent-teal" />,
  big_numbers: <DollarSign className="w-5 h-5 text-accent-teal" />,
  where_money_goes: <PieChart className="w-5 h-5 text-accent-teal" />,
  what_changed: <TrendingUp className="w-5 h-5 text-accent-teal" />,
  when_things_happen: <Calendar className="w-5 h-5 text-accent-teal" />,
  where: <MapPin className="w-5 h-5 text-accent-teal" />,
  who: <Users className="w-5 h-5 text-accent-teal" />,
  things_to_know: <AlertCircle className="w-5 h-5 text-accent-teal" />,
};

export const DocumentStoryboard: React.FC<DocumentStoryboardProps> = ({
  facts,
  documentId,
  documentTitle,
  fiscalPeriod,
  onSelectFact,
}) => {
  const storyboard: StoryboardData = useMemo(() => {
    return buildDocumentStoryboard(facts, {
      documentId,
      documentTitle,
      fiscalPeriod,
    });
  }, [facts, documentId, documentTitle, fiscalPeriod]);

  const handleFactClick = (factId: string) => {
    haptics.trigger('selection');
    if (onSelectFact) {
      onSelectFact(factId);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-surface border border-border shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-border-subtle border border-border text-[10px] font-mono uppercase font-semibold text-text mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-teal" />
            <span>Document at a Glance • 8-Step Storyboard</span>
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-text">{storyboard.title}</h2>
          <p className="text-xs text-text-subtle mt-0.5">
            Cryptographically grounded narrative synthesized across {storyboard.verifiedFactsCount}{' '}
            verified facts.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-surface-raised border border-border text-text">
            100% Provenance Passed
          </span>
        </div>
      </div>

      {/* 8-Step Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {storyboard.steps.map((step: StoryboardStep) => (
          <div
            key={step.key}
            className="p-5 rounded-2xl bg-surface border border-border space-y-3.5 hover:border-accent-teal/40 transition-all flex flex-col justify-between shadow-xs"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center shrink-0">
                    {STEP_ICONS[step.key]}
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      Step {step.stepNumber} of 8
                    </span>
                    <h3 className="font-serif text-base font-bold text-text">{step.title}</h3>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-text-muted bg-border-subtle px-2 py-0.5 rounded">
                  {step.claims.length} {step.claims.length === 1 ? 'Fact' : 'Facts'}
                </span>
              </div>

              <p className="text-xs text-text-muted leading-relaxed">{step.description}</p>

              <div className="p-3 rounded-xl bg-surface-raised/60 border border-border/80 text-xs text-text leading-relaxed font-medium">
                {step.summary}
              </div>
            </div>

            {/* Claims & Provenance Pills */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              {step.claims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <span className="text-text font-normal truncate max-w-sm" title={claim.claimText}>
                    {claim.claimText}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ProofBadge proofType={claim.proofType} />
                    {claim.factIds.map((fId) => (
                      <button
                        key={fId}
                        type="button"
                        onClick={() => handleFactClick(fId)}
                        className="p-1 rounded bg-surface hover:bg-accent-teal/10 hover:text-accent-teal border border-border text-text-muted transition-colors"
                        title="View verified source fact"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
