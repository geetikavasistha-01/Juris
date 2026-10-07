import React from 'react';
import type { ProofType } from '@juris/shared';
import {
  ShieldCheck,
  Eye,
  Calculator,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface ProofBadgeProps {
  proofType: ProofType | string;
  className?: string;
  showIcon?: boolean;
}

export const ProofBadge: React.FC<ProofBadgeProps> = ({
  proofType,
  className = '',
  showIcon = true,
}) => {
  switch (proofType) {
    case 'VERIFIED':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 ${className}`}
          title="Mechanically verified: verbatim quote and value proven on page"
        >
          {showIcon && <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
          <span>VERIFIED</span>
        </span>
      );

    case 'VERIFIED_OCR':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 ${className}`}
          title="Verified via high-confidence OCR token crosscheck"
        >
          {showIcon && <Eye className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />}
          <span>OCR MATCH</span>
        </span>
      );

    case 'COMPUTED':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 ${className}`}
          title="Deterministically computed: verified across two independent implementations"
        >
          {showIcon && <Calculator className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
          <span>COMPUTED</span>
        </span>
      );

    case 'DERIVED':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 ${className}`}
          title="Derived arithmetic fact computed strictly from 100% verified inputs"
        >
          {showIcon && <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
          <span>DERIVED</span>
        </span>
      );

    case 'USER_CONFIRMED':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 ${className}`}
          title="Manually confirmed by human reviewer"
        >
          {showIcon && <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
          <span>USER CONFIRMED</span>
        </span>
      );

    case 'ESTIMATED':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-raised text-text-muted border border-dashed border-border ${className}`}
          title="Estimated or approximate value (read from graphic or chart)"
        >
          {showIcon && <HelpCircle className="w-3 h-3 text-text-muted" />}
          <span>ESTIMATED</span>
        </span>
      );

    case 'CONFLICT':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 ${className}`}
          title="Discrepancy detected: multiple verified sources disagree on this figure"
        >
          {showIcon && <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
          <span>CONFLICT</span>
        </span>
      );

    case 'REJECTED':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 ${className}`}
          title="Verification check failed: number or quote absent from source text"
        >
          {showIcon && <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
          <span>REJECTED</span>
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-raised text-text-muted border border-border ${className}`}
        >
          {showIcon && <HelpCircle className="w-3 h-3 text-text-muted" />}
          <span>UNVERIFIABLE</span>
        </span>
      );
  }
};
