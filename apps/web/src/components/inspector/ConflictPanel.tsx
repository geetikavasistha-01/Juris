import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchConflicts } from '../../lib/api.js';
import { Card, Skeleton } from '../ui/index.js';
import { Split, AlertCircle, ShieldAlert } from 'lucide-react';

export interface ConflictPanelProps {
  documentId: string;
}

export const ConflictPanel: React.FC<ConflictPanelProps> = ({ documentId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['conflicts', documentId],
    queryFn: () => fetchConflicts(documentId),
    enabled: Boolean(documentId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const conflicts = data?.conflicts || [];

  return (
    <div className="space-y-6" data-testid="conflicts-panel">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-[var(--text)] flex items-center gap-2">
            <Split className="w-5 h-5 text-[var(--failed)]" />
            Contradictory Source Findings (CONFLICT)
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            When two verified passages or tables cite conflicting figures for the same subject and
            period, Juris presents both side-by-side rather than silently guessing.
          </p>
        </div>
        <span className="font-mono text-xs px-2.5 py-1 rounded bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)]">
          {conflicts.length} Identified Conflicts
        </span>
      </div>

      {conflicts.length === 0 ? (
        <Card className="p-8 text-center bg-[var(--surface)] border border-[var(--border)] space-y-2">
          <AlertCircle className="w-8 h-8 text-[var(--verified)] mx-auto" />
          <h4 className="font-serif font-bold text-[var(--text)] text-sm">
            No Internal Contradictions
          </h4>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
            All extracted facts across different sections and tables remain mathematically and
            semantically consistent.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {conflicts.map((c) => (
            <Card
              key={c.id}
              className="p-5 bg-[var(--surface)] border border-[var(--failed-border)] space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[var(--failed)]" />
                  <span className="font-serif font-bold text-sm text-[var(--text)]">
                    {c.subject} {c.period ? `(${c.period})` : ''}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-[var(--failed)] bg-[var(--failed-bg)] px-2 py-0.5 rounded border border-[var(--failed-border)]">
                  Discrepancy: {c.difference.toLocaleString()}
                </span>
              </div>

              {/* Side-by-Side Sources */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Source A */}
                <div className="p-3.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                    <span className="font-bold text-[var(--text)]">Primary Source A</span>
                    <span>Page {c.sourceA.page}</span>
                  </div>
                  <div className="font-mono text-base font-bold text-[var(--text)]">
                    {c.sourceA.value.toLocaleString()}
                  </div>
                  <p className="font-serif italic text-xs text-[var(--text-muted)] line-clamp-2">
                    &ldquo;{c.sourceA.quote}&rdquo;
                  </p>
                </div>

                {/* Source B */}
                <div className="p-3.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                    <span className="font-bold text-[var(--text)]">Conflicting Source B</span>
                    <span>Page {c.sourceB.page}</span>
                  </div>
                  <div className="font-mono text-base font-bold text-[var(--text)]">
                    {c.sourceB.value.toLocaleString()}
                  </div>
                  <p className="font-serif italic text-xs text-[var(--text-muted)] line-clamp-2">
                    &ldquo;{c.sourceB.quote}&rdquo;
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
