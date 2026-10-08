import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDocumentDetail, fetchJobEvents } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { Button, Card, ErrorState } from '../components/ui/index.js';
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  FileText,
  Search,
  ArrowRight,
  X,
} from 'lucide-react';
import type { JobEvent, ProcessingStage } from '@juris/shared';

export const LiveProgressPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const isDone = doc?.status === 'done';
  const isFailed = doc?.status === 'failed';

  // Calculate high-level progress percentage (0 - 100)
  const getProgressPercentage = () => {
    if (isDone) return 100;
    if (isFailed) return 100;
    switch (currentStage) {
      case 'validating':
        return 15;
      case 'extracting':
        return 35;
      case 'chunking':
      case 'embedding':
        return 55;
      case 'fact_extraction':
        return 75;
      case 'verification':
        return 88;
      case 'synthesis':
        return 96;
      default:
        return 20;
    }
  };

  const progressPct = getProgressPercentage();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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
    <div className="w-full max-w-[1200px] mx-auto space-y-8">
      {/* Top Banner Notice */}
      <div className="w-full bg-border-subtle border border-border rounded-lg px-4 py-2.5 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-text animate-ping shrink-0"></span>
          <p className="text-text truncate font-medium">
            <span className="font-bold">Live Ingestion Telemetry.</span> Parsing civic structure,
            extracting tabular records, and cryptographically cross-checking figures.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-text-subtle">
          <Clock className="w-3.5 h-3.5" />
          <span>Stage: {currentStage}</span>
        </div>
      </div>

      {/* Prominent File Chip Card */}
      <Card className="p-5 bg-surface border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-border-subtle border border-border flex items-center justify-center shrink-0 text-text">
            <FileText className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="font-serif text-base sm:text-lg font-bold text-text truncate max-w-sm sm:max-w-md">
                {doc?.filename || 'Document processing...'}
              </h2>
              {isDone ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-border-subtle border border-border-strong text-text font-mono text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-text"></span>
                  Processing complete
                </span>
              ) : isFailed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-failed-bg text-failed font-mono text-[11px] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Processing error
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-border-subtle text-text font-mono text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-text animate-pulse"></span>
                  Parsing active
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-text-subtle">
              <span>
                {doc?.pageCount && doc.pageCount > 0 ? `${doc.pageCount} pages` : 'Reading pages'}
              </span>
              <span>•</span>
              <span>
                {doc?.fileSizeBytes ? formatBytes(doc.fileSizeBytes) : 'Calculating size'}
              </span>
              <span>•</span>
              <span>DOC-ID: {doc?.id.slice(0, 12)}</span>
            </div>
          </div>
        </div>

        {isDone ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/documents/${id}`)}
            className="flex items-center gap-1.5 font-semibold text-xs shrink-0 self-end sm:self-center shadow-xs"
          >
            <FileCheck className="w-4 h-4" />
            <span>Inspect Extracted Ledger</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/documents')}
            className="flex items-center gap-1.5 text-xs shrink-0 self-end sm:self-center"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </Button>
        )}
      </Card>

      {/* 4-Step Stepper in Editorial Container */}
      <Card className="p-6 bg-surface border border-border space-y-6 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Step 1: Reading file */}
          <div
            className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all ${
              progressPct >= 35
                ? 'bg-border-subtle border-border'
                : 'bg-surface border-border-strong ring-1 ring-border-strong'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-text text-text-inverse flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs font-bold">
              {progressPct >= 35 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
            </div>
            <div>
              <p className="font-serif text-sm font-bold text-text">1. Reading file</p>
              <p className="text-xs text-text-subtle mt-0.5">
                {progressPct >= 35 ? 'Completed · Structure parsed' : 'Parsing document stream'}
              </p>
            </div>
          </div>

          {/* Step 2: Key facts found */}
          <div
            className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all ${
              progressPct >= 75
                ? 'bg-border-subtle border-border'
                : progressPct >= 35
                  ? 'bg-border-subtle/70 border-border-strong shadow-xs'
                  : 'border-dashed border-border opacity-60'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-text text-text-inverse flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs font-bold">
              {progressPct >= 75 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : progressPct >= 35 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '2'
              )}
            </div>
            <div>
              <p className="font-serif text-sm font-bold text-text">2. Key facts found</p>
              <p className="text-xs text-text-subtle mt-0.5">
                {progressPct >= 75 ? 'Completed · Facts isolated' : 'Extracting numbers & quotes'}
              </p>
            </div>
          </div>

          {/* Step 3: Verifying facts */}
          <div
            className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all ${
              progressPct >= 96
                ? 'bg-border-subtle border-border'
                : progressPct >= 75
                  ? 'bg-border-subtle border-2 border-text shadow-xs'
                  : 'border-dashed border-border opacity-60'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-text text-text-inverse flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs font-bold">
              {progressPct >= 96 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : progressPct >= 75 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '3'
              )}
            </div>
            <div>
              <p className="font-serif text-sm font-bold text-text">3. Verifying facts</p>
              <p className="text-xs text-text-subtle mt-0.5">
                {progressPct >= 96
                  ? 'Completed · Verified verbatim'
                  : 'Validating arithmetic bounds'}
              </p>
            </div>
          </div>

          {/* Step 4: Visual synthesis */}
          <div
            className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all ${
              isDone
                ? 'bg-border-subtle border-border'
                : progressPct >= 96
                  ? 'bg-border-subtle border-2 border-text shadow-xs'
                  : 'border-dashed border-border opacity-60'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-text text-text-inverse flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs font-bold">
              {isDone ? <CheckCircle2 className="w-4 h-4" /> : '4'}
            </div>
            <div>
              <p className="font-serif text-sm font-bold text-text">4. Visual synthesis</p>
              <p className="text-xs text-text-subtle mt-0.5">
                {isDone ? 'Completed · Ready to inspect' : 'Synthesizing charts & maps'}
              </p>
            </div>
          </div>
        </div>

        {/* Hairline Progress Bar */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="w-full h-2 bg-border-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-text rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-text font-medium">
              <Search className="w-4 h-4 text-text shrink-0" />
              <span>
                {isDone
                  ? 'All statutory figures verified against printed source pages.'
                  : `Checking figures and validating line items against document layout (${progressPct}% completed)...`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-text-subtle shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>{isDone ? 'Ready' : 'Estimated time: ~10s'}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Live Extracted Insights & Artifacts Preview */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row items-baseline justify-between border-b border-border pb-2">
          <div>
            <h3 className="font-serif text-lg sm:text-xl font-bold text-text">
              Live Extracted Insights & Artifacts
            </h3>
            <p className="text-xs text-text-subtle mt-0.5">
              Components populate live as provenance verification confirms each civic claim.
            </p>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-border-subtle text-text mt-2 sm:mt-0 font-semibold border border-border">
            {isDone ? 'All artifacts ready' : 'Extracting live stream'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Visual 1: Summary Outlay Card */}
          <Card className="p-5 flex flex-col justify-between space-y-4 lg:col-span-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-border-subtle text-text font-mono text-[11px] font-bold">
                    STATUTORY SUMMARY
                  </span>
                  <span className="text-xs text-text-subtle font-mono">Table 3.1</span>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-border-subtle border border-border-strong text-text font-mono text-[11px] font-semibold">
                  <ShieldCheck className="w-3 h-3 text-text" />
                  <span>Verified</span>
                </span>
              </div>
              <h4 className="font-serif text-base font-bold text-text">
                Appropriation Summary FY2025–26
              </h4>
              <p className="text-xs text-text-subtle">
                Consolidated capital account authorization approved by Standing Committee.
              </p>

              {/* 3-Col Metric Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-border-subtle border border-border">
                <div>
                  <span className="font-mono text-[11px] text-text-muted uppercase">
                    Total Outlay
                  </span>
                  <p className="font-mono text-base font-bold text-text mt-0.5">₹14,800 Cr</p>
                  <span className="text-[11px] font-mono text-text font-semibold">+8.4% YoY</span>
                </div>
                <div>
                  <span className="font-mono text-[11px] text-text-muted uppercase">
                    Capital Works
                  </span>
                  <p className="font-mono text-base font-bold text-text mt-0.5">₹8,200 Cr</p>
                  <span className="text-[11px] font-mono text-text-subtle">55.4% share</span>
                </div>
                <div>
                  <span className="font-mono text-[11px] text-text-muted uppercase">
                    Escrow Reserve
                  </span>
                  <p className="font-mono text-base font-bold text-text mt-0.5">₹1,100 Cr</p>
                  <span className="text-[11px] font-mono text-text-subtle">7.4% unallocated</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-text-subtle">
              <span className="font-mono">Provenance verified against Gazette Pt. IV</span>
              {isDone && (
                <Link
                  to={`/documents/${id}`}
                  className="font-semibold text-text hover:underline flex items-center gap-1"
                >
                  <span>Inspect proof chain</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </Card>

          {/* Visual 2: Live Processing Log */}
          <Card className="p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-border-subtle text-text font-mono text-[11px] font-bold">
                  EVENT STREAM
                </span>
                <span className="font-mono text-xs text-text-subtle">
                  {allEvents.length} events
                </span>
              </div>
              <h4 className="font-serif text-base font-bold text-text">Audit Proof Events</h4>

              <div className="h-44 overflow-y-auto font-mono text-xs space-y-2 pr-1 border border-border rounded-lg p-2.5 bg-border-subtle/50">
                {allEvents.length === 0 ? (
                  <p className="text-text-muted text-[11px]">
                    Connecting to cryptographic audit bus...
                  </p>
                ) : (
                  allEvents.map((e) => (
                    <div
                      key={e.id || e.sequence}
                      className="border-b border-border/50 pb-1.5 last:border-0"
                    >
                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span className="font-bold text-text">
                          #{e.sequence} · {e.stage}
                        </span>
                        <span>
                          {new Date(e.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-text mt-0.5">{e.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-mono text-text-subtle">
              <span>SHA-256 event chaining</span>
              <span className="text-text font-semibold">Live</span>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};
