import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDocumentDetail, fetchDocumentChunks } from '../lib/api.js';
import type { DocumentFactDetail } from '@juris/shared';
import {
  Button,
  Badge,
  VerificationBadge,
  Card,
  Quote,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Drawer,
  EmptyState,
  Skeleton,
  ErrorState,
} from '../components/ui/index.js';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  BookOpen,
  ArrowLeft,
  Sparkles,
  Filter,
  BarChart3,
} from 'lucide-react';

const DocumentVisuals = React.lazy(() =>
  import('../components/visuals/DocumentVisuals.js').then((m) => ({
    default: m.DocumentVisuals,
  })),
);

export const DocumentViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedFact, setSelectedFact] = useState<DocumentFactDetail | null>(null);
  const [activeTab, setActiveTab] = useState('facts');
  const [factFilter, setFactFilter] = useState<'all' | 'verified' | 'unverified' | 'failed'>('all');
  const [chunkSearch, setChunkSearch] = useState('');

  // 1. Fetch document metadata, facts, and synthesis
  const {
    data: doc,
    isLoading: isDocLoading,
    isError: isDocError,
    error: docError,
    refetch: refetchDoc,
  } = useQuery({
    queryKey: ['document', id],
    queryFn: () => (id ? fetchDocumentDetail(id) : Promise.reject('No ID')),
    enabled: Boolean(id),
  });

  // 2. Fetch document chunks
  const { data: chunksData, isLoading: isChunksLoading } = useQuery({
    queryKey: ['document-chunks', id, chunkSearch],
    queryFn: () => (id ? fetchDocumentChunks(id, chunkSearch) : Promise.reject('No ID')),
    enabled: Boolean(id) && activeTab === 'chunks',
  });

  if (isDocLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <Skeleton className="h-64 col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isDocError || !doc) {
    return (
      <ErrorState
        title="Document Not Found"
        message={docError instanceof Error ? docError.message : 'Unable to load document details.'}
        onRetry={() => refetchDoc()}
      />
    );
  }

  const allFacts = doc.facts || [];
  const verifiedCount = allFacts.filter((f) => f.verified).length;
  const failedCount = allFacts.filter((f) => !f.verified && f.failReason).length;
  const unverifiedCount = allFacts.length - verifiedCount - failedCount;

  const filteredFacts = allFacts.filter((fact) => {
    if (factFilter === 'verified') return fact.verified;
    if (factFilter === 'failed') return !fact.verified && fact.failReason;
    if (factFilter === 'unverified') return !fact.verified && !fact.failReason;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Top Header & Breadcrumb */}
      <div className="border-b border-border pb-6 space-y-4">
        <Link
          to="/documents"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Documents</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-text">
                {doc.filename}
              </h1>
              <Badge variant="teal">Processed</Badge>
            </div>
            <p className="text-xs text-text-subtle mt-1 font-mono">
              {doc.pageCount} Pages • SHA-256: {doc.sha256.substring(0, 12)}... • {allFacts.length}{' '}
              Facts Extracted ({verifiedCount} Verified)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to={`/documents/${doc.id}/progress`}>
              <Button variant="secondary" size="sm" className="text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-accent-teal" />
                <span>Audit Trail</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="facts" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="facts" className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent-teal" />
            <span>Extracted Facts ({allFacts.length})</span>
          </TabsTrigger>
          <TabsTrigger value="visuals" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent-teal" />
            <span>Visual Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-navy dark:text-brand-navy-hover" />
            <span>Executive Findings</span>
          </TabsTrigger>
          <TabsTrigger value="chunks" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>Text & Chunks</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Extracted Facts & Evidence */}
        <TabsContent value="facts" className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-surface border border-border">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-subtle" />
              <span className="text-xs font-semibold text-text uppercase tracking-wider">
                Filter Evidence:
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFactFilter('all')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  factFilter === 'all'
                    ? 'bg-brand-navy text-[var(--btn-primary-text)] shadow-xs'
                    : 'text-text-muted hover:text-text bg-surface-raised'
                }`}
              >
                All Facts ({allFacts.length})
              </button>
              <button
                onClick={() => setFactFilter('verified')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  factFilter === 'verified'
                    ? 'bg-verified-bg text-verified border border-verified-border font-bold'
                    : 'text-text-muted hover:text-verified bg-surface-raised'
                }`}
              >
                Verified ({verifiedCount})
              </button>
              <button
                onClick={() => setFactFilter('unverified')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  factFilter === 'unverified'
                    ? 'bg-unverified-bg text-unverified border border-unverified-border font-bold'
                    : 'text-text-muted hover:text-unverified bg-surface-raised'
                }`}
              >
                Unverified ({unverifiedCount})
              </button>
              {failedCount > 0 && (
                <button
                  onClick={() => setFactFilter('failed')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    factFilter === 'failed'
                      ? 'bg-failed-bg text-failed border border-failed-border font-bold'
                      : 'text-text-muted hover:text-failed bg-surface-raised'
                  }`}
                >
                  Failed ({failedCount})
                </button>
              )}
            </div>
          </div>

          {/* Facts Grid */}
          {filteredFacts.length === 0 ? (
            <EmptyState
              title="No Facts Found"
              description="No facts matched your selected filter."
              actionLabel="Show All Facts"
              onAction={() => setFactFilter('all')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredFacts.map((fact) => {
                const status = fact.verified
                  ? 'verified'
                  : fact.failReason
                    ? 'failed'
                    : 'unverified';
                return (
                  <Card
                    key={fact.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect citation for fact on page ${fact.page}: ${fact.quote}`}
                    onClick={() => setSelectedFact(fact)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedFact(fact);
                      }
                    }}
                    className="p-5 cursor-pointer hover:border-border-strong transition-all flex flex-col justify-between space-y-4 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-accent-teal"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-raised border border-border text-brand-navy dark:text-brand-navy-hover w-fit">
                            {fact.type}
                          </span>
                          {fact.label && (
                            <span className="text-xs font-medium text-text mt-1">{fact.label}</span>
                          )}
                        </div>
                        <VerificationBadge variant={status} page={fact.page} />
                      </div>

                      {fact.value !== null && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-mono font-bold text-text">
                            {fact.currency ? `${fact.currency} ` : ''}
                            {fact.value.toLocaleString()}
                          </span>
                          {fact.unit && (
                            <span className="text-xs text-text-subtle font-medium">
                              {fact.unit}
                            </span>
                          )}
                          {fact.period && (
                            <span className="text-xs font-mono text-text-muted ml-auto">
                              ({fact.period.basis !== 'none' ? `${fact.period.basis} ` : ''}
                              {fact.period.fiscalYear || ''})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Verbatim Quote Snippet */}
                      <Quote page={fact.page}>"{fact.quote}"</Quote>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-text-subtle">
                      <span>Click to inspect citation locator</span>
                      <ExternalLink className="w-3.5 h-3.5 text-accent-teal" />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab: Visual Analytics */}
        <TabsContent value="visuals" className="space-y-6">
          <React.Suspense
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-80 w-full" />
              </div>
            }
          >
            <DocumentVisuals facts={allFacts} documentName={doc.filename} />
          </React.Suspense>
        </TabsContent>

        {/* Tab 2: Executive Findings & Risks */}
        <TabsContent value="summary" className="space-y-6">
          <Card className="p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="font-serif text-xl font-bold text-text mb-2">Executive Summary</h2>
              <p className="text-sm text-text-muted leading-relaxed">
                {doc.analysis?.summary ||
                  'Deterministic summary generated from verified document facts.'}
              </p>
            </div>

            {doc.analysis?.keyFindings && doc.analysis.keyFindings.length > 0 && (
              <div className="pt-6 border-t border-border space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-verified" />
                  <span>Key Findings & Allocations</span>
                </h3>
                <ul className="space-y-2">
                  {doc.analysis.keyFindings.map((finding, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-text-muted flex items-start gap-2 bg-surface-raised p-3 rounded-md border border-border"
                    >
                      <span className="text-accent-teal font-bold shrink-0">•</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {doc.analysis?.risks && doc.analysis.risks.length > 0 && (
              <div className="pt-6 border-t border-border space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-unverified" />
                  <span>Fiscal & Policy Risk Factors</span>
                </h3>
                <ul className="space-y-2">
                  {doc.analysis.risks.map((risk, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-text-muted flex items-start gap-2 bg-unverified-bg/40 p-3 rounded-md border border-unverified-border"
                    >
                      <span className="text-unverified font-bold shrink-0">⚠️</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 3: Text & Chunks Browser */}
        <TabsContent value="chunks" className="space-y-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Search raw extracted text chunks..."
              value={chunkSearch}
              onChange={(e) => setChunkSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>

          {isChunksLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : !chunksData?.chunks || chunksData.chunks.length === 0 ? (
            <EmptyState
              title="No Chunks Found"
              description="No text chunks match your search query."
            />
          ) : (
            <div className="space-y-4">
              {chunksData.chunks.map((chunk) => (
                <Card key={chunk.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-text-subtle border-b border-border pb-2">
                    <span>
                      Page {chunk.pageNumber} • Chunk #{chunk.chunkIndex}
                    </span>
                    {chunk.rank !== undefined && (
                      <span className="text-accent-teal">Relevance Rank: {chunk.rank}</span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-text leading-relaxed whitespace-pre-wrap">
                    {chunk.content}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Fact Citation Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedFact)}
        onClose={() => setSelectedFact(null)}
        title="Fact & Verbatim Citation Inspector"
      >
        {selectedFact && (
          <div className="space-y-6 mt-4">
            <div className="p-4 rounded-lg bg-surface border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-brand-navy dark:text-brand-navy-hover">
                  {selectedFact.type}
                </span>
                <VerificationBadge
                  variant={
                    selectedFact.verified
                      ? 'verified'
                      : selectedFact.failReason
                        ? 'failed'
                        : 'unverified'
                  }
                  page={selectedFact.page}
                />
              </div>

              {selectedFact.value !== null && (
                <div className="text-2xl font-mono font-bold text-text">
                  {selectedFact.currency ? `${selectedFact.currency} ` : ''}
                  {selectedFact.value.toLocaleString()} {selectedFact.unit || ''}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                Verbatim Extracted Quote
              </h4>
              <div className="p-4 rounded-lg bg-quote-highlight border-l-4 border-quote-border text-text font-serif text-sm leading-relaxed">
                "{selectedFact.quote}"
              </div>
            </div>

            <div className="p-4 rounded-lg bg-surface border border-border text-xs space-y-2 font-mono text-text-muted">
              <div className="flex justify-between">
                <span>Page Locator:</span>
                <span className="text-text font-bold">Page {selectedFact.page}</span>
              </div>
              <div className="flex justify-between">
                <span>Verification Method:</span>
                <span className="text-text">{selectedFact.verificationMethod}</span>
              </div>
              {selectedFact.failReason && (
                <div className="flex justify-between text-failed">
                  <span>Failure Reason:</span>
                  <span>{selectedFact.failReason}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
