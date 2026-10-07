import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDocumentDetail, fetchJobEvents } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { Button, Badge, VerificationBadge, Card, ErrorState } from '../components/ui/index.js';
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  FileCheck,
  Activity,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { JobEvent, ProcessingStage } from '@juris/shared';

const PIPELINE_STAGES: { stage: ProcessingStage; label: string; desc: string }[] = [
  {
    stage: 'validating',
    label: 'File Validation',
    desc: 'Magic bytes, size check, SHA-256 integrity',
  },
  {
    stage: 'extracting',
    label: 'PDF Text Extraction',
    desc: 'Page-level coordinate and text stream extraction',
  },
  {
    stage: 'chunking',
    label: 'Document Segmentation',
    desc: 'Semantic paragraph and sentence chunking',
  },
  {
    stage: 'embedding',
    label: 'Vector Indexing',
    desc: 'Generating 768-dim deterministic embeddings',
  },
  {
    stage: 'fact_extraction',
    label: 'Structured LLM Extraction',
    desc: 'Extracting facts with quotes and citations',
  },
  {
    stage: 'verification',
    label: 'Verbatim Quote Verifier',
    desc: 'Normalizing and verifying fact numbers in text',
  },
  {
    stage: 'synthesis',
    label: 'Analysis Synthesis',
    desc: 'Compiling key findings, summaries, and risk factors',
  },
];

export const LiveProgressPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [realtimeEvents, setRealtimeEvents] = useState<JobEvent[]>([]);

  // 1. Fetch document metadata with polling fallback
  const {
    data: doc,
    isError: isDocError,
    error: docError,
    refetch: refetchDoc,
  } = useQuery({
    queryKey: ['document', id],
    queryFn: () => (id ? fetchDocumentDetail(id) : Promise.reject('No ID')),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'done' || status === 'failed' ? false : 1000;
    },
  });

  // 2. Fetch job events stream with polling fallback
  const { data: eventsData, refetch: refetchEvents } = useQuery({
    queryKey: ['document-events', id],
    queryFn: () => (id ? fetchJobEvents(id) : Promise.reject('No ID')),
    enabled: Boolean(id),
    refetchInterval: () => {
      const status = doc?.status;
      return status === 'done' || status === 'failed' ? false : 1000;
    },
  });

  // 3. Supabase Realtime Subscription
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`doc-progress-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_events', filter: `document_id=eq.${id}` },
        (payload) => {
          const newEvent = payload.new as JobEvent;
          setRealtimeEvents((prev) => {
            if (prev.some((e) => e.id === newEvent.id)) return prev;
            return [...prev, newEvent].sort((a, b) => a.sequence - b.sequence);
          });
          refetchDoc();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, refetchDoc]);

  // Combine polled events with realtime events
  const allEvents: JobEvent[] = [...(eventsData?.events || []), ...realtimeEvents].filter(
    (event, index, self) => index === self.findIndex((e) => e.id === event.id),
  );
  allEvents.sort((a, b) => a.sequence - b.sequence);

  const lastEvent = allEvents.length > 0 ? allEvents[allEvents.length - 1] : undefined;
  const currentStage: ProcessingStage =
    (doc?.job?.stage as ProcessingStage) || (lastEvent ? lastEvent.stage : 'validating');
  const isDone =
    doc?.status === 'done' || (currentStage === 'synthesis' && lastEvent?.stage === 'synthesis');
  const isFailed = doc?.status === 'failed';

  const getStageStatus = (stage: ProcessingStage, index: number) => {
    if (isFailed) {
      if (stage === currentStage) return 'failed';
    }
    if (isDone) return 'completed';

    const stageOrder: ProcessingStage[] = [
      'validating',
      'extracting',
      'chunking',
      'embedding',
      'fact_extraction',
      'verification',
      'synthesis',
    ];
    const currentIndex = stageOrder.indexOf(currentStage);
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'pending';
  };

  if (isDocError) {
    return (
      <ErrorState
        title="Document Not Found"
        message={
          docError instanceof Error ? docError.message : 'Unable to find or track this document.'
        }
        onRetry={() => {
          refetchDoc();
          refetchEvents();
        }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-text">
              Ingestion Pipeline Status
            </h1>
            {isDone ? (
              <VerificationBadge variant="verified" customLabel="Finished" />
            ) : isFailed ? (
              <VerificationBadge variant="failed" customLabel="Failed" />
            ) : (
              <Badge variant="teal" className="flex items-center gap-1 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing</span>
              </Badge>
            )}
          </div>
          <p className="text-sm font-mono text-text-muted mt-1 truncate max-w-xl">
            {doc?.filename || 'Loading document metadata...'}
          </p>
        </div>

        {isDone && (
          <Link to={`/documents/${id}`}>
            <Button variant="primary" className="flex items-center gap-2 shadow-sm">
              <FileCheck className="w-4 h-4" />
              <span>Inspect Extracted Facts</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        )}
      </div>

      {/* Stepper Pipeline */}
      <Card className="p-6 sm:p-8">
        <h2 className="text-base font-semibold text-text mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent-teal" />
          <span>Multi-Stage Verification Stepper</span>
        </h2>

        <div className="space-y-6">
          {PIPELINE_STAGES.map((item, index) => {
            const status = getStageStatus(item.stage, index);
            return (
              <div key={item.stage} className="flex items-start gap-4 relative">
                {/* Stepper Line */}
                {index < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={`absolute left-4 top-8 -bottom-6 w-0.5 ${
                      status === 'completed' ? 'bg-verified' : 'bg-border'
                    }`}
                  />
                )}

                {/* Status Indicator Icon */}
                <div className="z-10 shrink-0">
                  {status === 'completed' && (
                    <div className="w-8 h-8 rounded-full bg-verified-bg border border-verified-border text-verified flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  {status === 'active' && (
                    <div className="w-8 h-8 rounded-full bg-surface-raised border-2 border-accent-teal text-accent-teal flex items-center justify-center animate-spin">
                      <Loader2 className="w-4 h-4" />
                    </div>
                  )}
                  {status === 'pending' && (
                    <div className="w-8 h-8 rounded-full bg-surface-raised border border-border text-text-subtle flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  )}
                  {status === 'failed' && (
                    <div className="w-8 h-8 rounded-full bg-failed-bg border border-failed-border text-failed flex items-center justify-center">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Stage Info */}
                <div className="flex-1 pt-1">
                  <div className="flex items-center justify-between">
                    <h3
                      className={`text-sm font-semibold ${
                        status === 'completed'
                          ? 'text-text'
                          : status === 'active'
                            ? 'text-accent-teal font-bold'
                            : status === 'failed'
                              ? 'text-failed'
                              : 'text-text-subtle'
                      }`}
                    >
                      {item.label}
                    </h3>
                    <span className="text-[11px] font-mono text-text-subtle uppercase tracking-wider">
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Live Pipeline Events Log */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-text mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-navy dark:text-brand-navy-hover" />
            <span>Verifiable Event Audit Stream</span>
          </span>
          <span className="text-xs font-mono text-text-subtle">
            {allEvents.length} events recorded
          </span>
        </h3>

        <div
          role="region"
          aria-label="Processing event logs"
          tabIndex={0}
          className="bg-surface-raised border border-border rounded-lg p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-2 focus:outline-none focus:ring-2 focus:ring-focus-ring"
        >
          {allEvents.length === 0 ? (
            <p className="text-text-subtle">Waiting for initial stage events...</p>
          ) : (
            allEvents.map((evt) => (
              <div
                key={evt.id || evt.sequence}
                className="flex items-start gap-3 py-1 border-b border-border/50 last:border-0"
              >
                <span className="text-accent-teal font-semibold">#{evt.sequence}</span>
                <span className="text-text-subtle text-[11px] shrink-0">
                  {new Date(evt.createdAt).toLocaleTimeString()}
                </span>
                <span className="text-text font-medium">{evt.message}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
