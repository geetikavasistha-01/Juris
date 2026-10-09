import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchReviewQueue, approveReviewItem, rejectReviewItem } from '../../lib/api.js';
import { Button, Card, Skeleton } from '../ui/index.js';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react';

export interface ReviewQueuePanelProps {
  documentId: string;
  onFactApproved?: () => void;
}

export const ReviewQueuePanel: React.FC<ReviewQueuePanelProps> = ({
  documentId,
  onFactApproved,
}) => {
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['review-queue', documentId],
    queryFn: () => fetchReviewQueue(documentId),
    enabled: Boolean(documentId),
  });

  const approveMutation = useMutation({
    mutationFn: (itemId: string) => approveReviewItem(documentId, itemId),
    onSuccess: () => {
      setActionMessage('Fact confirmed and transitioned to USER_CONFIRMED.');
      queryClient.invalidateQueries({ queryKey: ['review-queue', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      if (onFactApproved) onFactApproved();
      setTimeout(() => setActionMessage(null), 4000);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (itemId: string) => rejectReviewItem(documentId, itemId),
    onSuccess: () => {
      setActionMessage('Fact rejected and removed from verified totals.');
      queryClient.invalidateQueries({ queryKey: ['review-queue', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      setTimeout(() => setActionMessage(null), 4000);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="review-queue-loading">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const items = data?.items || [];
  const pendingItems = items.filter((i) => i.status === 'pending');
  const resolvedItems = items.filter((i) => i.status !== 'pending');

  return (
    <div className="space-y-6" data-testid="review-queue-panel">
      {/* Header notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-[var(--text)] flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[var(--accent-teal)]" />
            Human Review Queue
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Audit low-confidence OCR transcriptions and estimated chart values. Only human review
            marks items approved.
          </p>
        </div>
        <span className="font-mono text-xs px-2.5 py-1 rounded bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)]">
          {pendingItems.length} Pending Actions
        </span>
      </div>

      {actionMessage && (
        <div className="rounded-md border border-[var(--verified-border)] bg-[var(--verified-bg)] p-3 text-xs text-[var(--verified)] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Pending Items List */}
      {pendingItems.length === 0 ? (
        <Card className="p-8 text-center bg-[var(--surface)] border border-[var(--border)] space-y-2">
          <ShieldCheck className="w-8 h-8 text-[var(--verified)] mx-auto" />
          <h4 className="font-serif font-bold text-[var(--text)] text-sm">All Items Reviewed</h4>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
            Zero pending review queue items remain. All figures in this document are verified by
            primary proofs or confirmed by an analyst.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingItems.map((item) => (
            <Card
              key={item.id}
              className="p-5 bg-[var(--surface)] border border-[var(--unverified-border)] space-y-4 shadow-sm"
              data-testid={`review-item-${item.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-base text-[var(--text)]">
                      {item.label}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--unverified-bg)] border border-[var(--unverified-border)] text-[var(--unverified)]">
                      <AlertTriangle className="w-3 h-3" />
                      Pending Review
                    </span>
                  </div>
                  <p className="text-xs text-[var(--unverified)] font-medium">{item.reason}</p>
                </div>

                {item.ocrConfidence !== undefined && (
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      OCR Confidence
                    </span>
                    <span
                      className={`font-mono font-bold text-xs ${
                        item.ocrConfidence < 80
                          ? 'text-[var(--unverified)]'
                          : 'text-[var(--verified)]'
                      }`}
                    >
                      {item.ocrConfidence.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Verbatim snippet if available */}
              {item.rawQuote && (
                <div className="p-3 rounded bg-[var(--surface-raised)] border border-[var(--border)] font-serif italic text-xs text-[var(--text)]">
                  &ldquo;{item.rawQuote}&rdquo;
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border-subtle)]">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => rejectMutation.mutate(item.id)}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                  className="flex items-center gap-1.5 text-xs text-[var(--failed)] border-[var(--failed-border)] hover:bg-[var(--failed-bg)]"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject Fact</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => approveMutation.mutate(item.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-[var(--verified)] text-white hover:opacity-90"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm &amp; Approve Fact</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Resolved History */}
      {resolvedItems.length > 0 && (
        <div className="pt-4 border-t border-[var(--border)] space-y-3">
          <h4 className="font-mono text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Review History ({resolvedItems.length})
          </h4>
          <div className="space-y-2">
            {resolvedItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-md bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  {item.status === 'approved' ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--verified)]" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[var(--failed)]" />
                  )}
                  <span className="font-semibold text-[var(--text)]">{item.label}</span>
                </div>
                <span className="capitalize text-[var(--text-muted)]">
                  {item.status === 'approved' ? 'USER_CONFIRMED' : 'REJECTED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
