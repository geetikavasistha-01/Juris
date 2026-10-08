import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth.js';
import { fetchDocuments, deleteDocument } from '../lib/api.js';
import type { DocumentListItem } from '@juris/shared';
import { Button, Card, Dialog, EmptyState, Skeleton, ErrorState } from '../components/ui/index.js';
import {
  FileText,
  Upload,
  Search,
  Trash2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Download,
  Table as TableIcon,
  LayoutGrid,
  FileSpreadsheet,
  MapPin,
  Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react';

export const DocumentLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [deletingDoc, setDeletingDoc] = useState<DocumentListItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['documents', user?.id],
    queryFn: fetchDocuments,
    enabled: Boolean(user),
    refetchInterval: (query) => {
      const hasActive = query.state.data?.documents.some(
        (d) => d.status === 'queued' || d.status === 'processing',
      );
      return hasActive ? 3000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      setDeletingDoc(null);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const documents: DocumentListItem[] = data?.documents || [];

  const totalBytesUsed = documents.reduce((acc, d) => acc + (d.fileSizeBytes || 0), 0);
  const totalMbUsed = (totalBytesUsed / (1024 * 1024)).toFixed(1);

  const filteredDocuments = documents
    .filter((doc) => {
      const matchesSearch =
        doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'ready' && doc.status === 'done') ||
        (statusFilter === 'processing' &&
          (doc.status === 'processing' || doc.status === 'queued')) ||
        (statusFilter === 'failed' && doc.status === 'failed');
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'pdf' && doc.filename.toLowerCase().endsWith('.pdf')) ||
        (typeFilter === 'spreadsheet' &&
          (doc.filename.toLowerCase().endsWith('.csv') ||
            doc.filename.toLowerCase().endsWith('.xlsx') ||
            doc.filename.toLowerCase().endsWith('.tsv'))) ||
        (typeFilter === 'spatial' &&
          (doc.filename.toLowerCase().endsWith('.geojson') ||
            doc.filename.toLowerCase().endsWith('.kml') ||
            doc.filename.toLowerCase().endsWith('.gpx'))) ||
        (typeFilter === 'image' &&
          (doc.filename.toLowerCase().endsWith('.png') ||
            doc.filename.toLowerCase().endsWith('.jpg') ||
            doc.filename.toLowerCase().endsWith('.jpeg') ||
            doc.filename.toLowerCase().endsWith('.tiff')));
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'newest')
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest')
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'name') return a.filename.localeCompare(b.filename);
      if (sortBy === 'size') return b.fileSizeBytes - a.fileSizeBytes;
      return 0;
    });

  const countReady = documents.filter((d) => d.status === 'done').length;
  const countProcessing = documents.filter(
    (d) => d.status === 'processing' || d.status === 'queued',
  ).length;
  const countFailed = documents.filter((d) => d.status === 'failed').length;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFormatIcon = (filename: string) => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.tsv')) {
      return <FileSpreadsheet className="w-4 h-4 text-text" />;
    }
    if (lower.endsWith('.geojson') || lower.endsWith('.kml') || lower.endsWith('.gpx')) {
      return <MapPin className="w-4 h-4 text-text" />;
    }
    if (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.tiff')
    ) {
      return <ImageIcon className="w-4 h-4 text-text" />;
    }
    return <FileText className="w-4 h-4 text-text" />;
  };

  const getDocClassification = (filename: string) => {
    const lower = filename.toLowerCase();
    if (lower.includes('budget') || lower.includes('expenditure') || lower.includes('fiscal')) {
      return 'Municipal Budget';
    }
    if (lower.includes('policy') || lower.includes('notification') || lower.includes('gazette')) {
      return 'Government Notification';
    }
    if (lower.includes('judgment') || lower.includes('order') || lower.includes('ruling')) {
      return 'Judicial Ruling';
    }
    if (lower.includes('ward') || lower.includes('gis') || lower.endsWith('.geojson')) {
      return 'Spatial Ward Map';
    }
    return 'Civic Docket';
  };

  const exportCatalogJson = () => {
    const catalog = filteredDocuments.map((d) => ({
      id: d.id,
      filename: d.filename,
      status: d.status,
      pages: d.pageCount,
      sizeBytes: d.fileSizeBytes,
      createdAt: d.createdAt,
    }));
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `juris-document-catalog-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isError) {
    return (
      <ErrorState
        title="Failed to Load Documents"
        message={
          error instanceof Error
            ? error.message
            : 'An error occurred while fetching your documents.'
        }
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto space-y-8">
      {/* Top Breadcrumb & Storage Quota */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border text-xs">
        <div className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-text-muted">
          <span className="hover:text-text cursor-pointer" onClick={() => navigate('/upload')}>
            Archive
          </span>
          <span className="text-border-strong">/</span>
          <span className="hover:text-text cursor-pointer">Civic Dockets</span>
          <span className="text-border-strong">/</span>
          <span className="text-text font-bold">Repository Master</span>
        </div>

        <div className="flex items-center gap-2 bg-border-subtle px-3 py-1 rounded-full border border-border">
          <span className="w-2 h-2 rounded-full bg-text"></span>
          <span className="font-mono text-text-subtle">
            {documents.length} of 50 documents used
          </span>
          <span className="text-border-strong">•</span>
          <span className="font-mono font-semibold text-text">{totalMbUsed} MB quota</span>
        </div>
      </div>

      {/* Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-text">
            Document Library
          </h1>
          <p className="text-sm sm:text-base text-text-subtle mt-1 max-w-2xl">
            Repository of ingested civic notifications, municipal orders, and statutory gazettes
            with cryptographic provenance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={exportCatalogJson}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Catalog</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/upload')}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </Button>
        </div>
      </div>

      {/* Controls & Search Toolbar */}
      <Card className="p-4 bg-surface border border-border space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by document title, docket number, or gazette ref (⌘K)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-12 py-2 bg-border-subtle/60 border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-text focus:ring-2 focus:ring-border-subtle transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <kbd className="font-mono text-[10px] bg-border-subtle text-text-subtle px-1.5 py-0.5 rounded uppercase border border-border">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Type Filter & Sort & Mode */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-border-subtle/60 border border-border text-text text-xs rounded-lg px-3 py-2 cursor-pointer focus:outline-none hover:bg-border-subtle transition-colors font-medium"
            >
              <option value="all">All Types</option>
              <option value="pdf">PDF Documents</option>
              <option value="spreadsheet">Spreadsheets (CSV, XLSX)</option>
              <option value="spatial">Spatial (GeoJSON, KML)</option>
              <option value="image">Images & Scans</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'name' | 'size')}
              className="bg-border-subtle/60 border border-border text-text text-xs rounded-lg px-3 py-2 cursor-pointer focus:outline-none hover:bg-border-subtle transition-colors font-medium"
            >
              <option value="newest">Date added (Newest first)</option>
              <option value="oldest">Date added (Oldest first)</option>
              <option value="name">Document title (A–Z)</option>
              <option value="size">File size (Largest first)</option>
            </select>

            {/* View Mode Switch */}
            <div className="flex items-center bg-border-subtle p-0.5 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                aria-label="Table view"
                className={`p-1.5 rounded transition-all ${
                  viewMode === 'table'
                    ? 'bg-surface text-text shadow-xs'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                className={`p-1.5 rounded transition-all ${
                  viewMode === 'grid'
                    ? 'bg-surface text-text shadow-xs'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Tabs / Quick Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-full font-mono text-xs transition-all ${
                statusFilter === 'all'
                  ? 'bg-text text-text-inverse font-bold shadow-xs'
                  : 'bg-border-subtle text-text hover:bg-border'
              }`}
            >
              All <span className="ml-1 opacity-80">{documents.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ready')}
              className={`px-3 py-1 rounded-full font-mono text-xs transition-all ${
                statusFilter === 'ready'
                  ? 'bg-text text-text-inverse font-bold shadow-xs'
                  : 'bg-border-subtle text-text hover:bg-border'
              }`}
            >
              Ready <span className="ml-1 font-bold text-text">{countReady}</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('processing')}
              className={`px-3 py-1 rounded-full font-mono text-xs transition-all ${
                statusFilter === 'processing'
                  ? 'bg-text text-text-inverse font-bold shadow-xs'
                  : 'bg-border-subtle text-text hover:bg-border'
              }`}
            >
              Processing <span className="ml-1 font-bold">{countProcessing}</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1 rounded-full font-mono text-xs transition-all ${
                statusFilter === 'failed'
                  ? 'bg-failed text-text-inverse font-bold shadow-xs'
                  : 'bg-border-subtle text-text hover:bg-border'
              }`}
            >
              Failed <span className="ml-1 font-bold">{countFailed}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-text-subtle font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-text" />
            <span>Audit integrity auto-sync: active</span>
          </div>
        </div>
      </Card>

      {/* Main Ledger Content */}
      {!user ? (
        <Card className="p-8 text-center max-w-lg mx-auto border-dashed">
          <ShieldCheck className="w-10 h-10 text-text mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-text">
            Sign In to Access Your Documents
          </h3>
          <p className="text-xs text-text-muted mt-1 mb-6">
            Sign in with your email or continue as a demo guest to upload, verify facts, and inspect
            allocations.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/login">
              <Button variant="primary">Sign In / Demo Guest</Button>
            </Link>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 flex items-center justify-between">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
            </Card>
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <EmptyState
          title={
            searchQuery || statusFilter !== 'all'
              ? 'No Matching Documents'
              : 'No Documents Uploaded Yet'
          }
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Try changing your search query or status filter.'
              : 'Upload a civic budget or legal policy document to extract facts and verify quotes.'
          }
          actionLabel="Upload Your First Document"
          onAction={() => navigate('/upload')}
        />
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <Card className="overflow-hidden border border-border shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-border-subtle border-b border-border text-text font-mono text-xs uppercase tracking-wider select-none">
                  <th className="py-3 px-4 font-semibold">Document Name & Docket</th>
                  <th className="py-3 px-4 font-semibold">Classification</th>
                  <th className="py-3 px-4 font-semibold">Date Ingested</th>
                  <th className="py-3 px-4 font-semibold">Evidentiary Veracity</th>
                  <th className="py-3 px-4 font-semibold">Ingest Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text text-xs sm:text-sm">
                {filteredDocuments.map((doc) => {
                  const isProcessing = doc.status === 'queued' || doc.status === 'processing';
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-border-subtle/50 transition-colors group cursor-pointer"
                      onClick={() =>
                        navigate(
                          isProcessing ? `/documents/${doc.id}/progress` : `/documents/${doc.id}`,
                        )
                      }
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded bg-border-subtle border border-border flex items-center justify-center shrink-0 mt-0.5">
                            {getFormatIcon(doc.filename)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <Link
                              to={`/documents/${doc.id}`}
                              className="font-serif font-bold text-text hover:underline truncate max-w-xs sm:max-w-md"
                            >
                              {doc.filename}
                            </Link>
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-subtle mt-0.5">
                              <span>
                                {doc.pageCount > 0
                                  ? `${doc.pageCount} pages`
                                  : formatBytes(doc.fileSizeBytes)}
                              </span>
                              <span>•</span>
                              <span className="text-text font-medium">{doc.id.slice(0, 12)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-border-subtle border border-border text-[11px] font-mono font-medium text-text">
                          {getDocClassification(doc.filename)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                        <div className="font-mono text-xs text-text">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </div>
                        <div className="font-mono text-[10px] text-text-subtle">
                          {new Date(doc.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-mono text-text">
                          <ShieldCheck className="w-3.5 h-3.5 text-text" />
                          <span>100% Provenance Trace</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                        {doc.status === 'done' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-border-subtle border border-border-strong text-text font-mono text-[11px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-text"></span>
                            Ready
                          </span>
                        ) : isProcessing ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-border-subtle text-text font-mono text-[11px] font-semibold animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Processing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-failed-bg text-failed font-mono text-[11px] font-semibold">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap align-middle text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              navigate(
                                isProcessing
                                  ? `/documents/${doc.id}/progress`
                                  : `/documents/${doc.id}`,
                              )
                            }
                            className="text-xs h-8 px-2.5"
                          >
                            {isProcessing ? 'Track' : 'Inspect'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingDoc(doc)}
                            className="text-text-muted hover:text-failed h-8 w-8 p-0"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => {
            const isProcessing = doc.status === 'queued' || doc.status === 'processing';
            return (
              <Card
                key={doc.id}
                className="flex flex-col justify-between hover:border-border-strong transition-all shadow-xs p-5"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-9 h-9 rounded-lg bg-border-subtle border border-border flex items-center justify-center shrink-0 text-text">
                      {getFormatIcon(doc.filename)}
                    </div>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-border-subtle text-text border border-border">
                      {getDocClassification(doc.filename)}
                    </span>
                  </div>

                  <div>
                    <h3
                      className="font-serif font-bold text-base text-text truncate"
                      title={doc.filename}
                    >
                      {doc.filename}
                    </h3>
                    <p className="text-xs font-mono text-text-subtle mt-0.5">
                      {doc.pageCount > 0 ? `${doc.pageCount} pages` : 'Calculating'} •{' '}
                      {formatBytes(doc.fileSizeBytes)}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] font-mono text-text-subtle">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        navigate(
                          isProcessing ? `/documents/${doc.id}/progress` : `/documents/${doc.id}`,
                        )
                      }
                      className="text-xs flex items-center gap-1"
                    >
                      <span>{isProcessing ? 'Track' : 'Inspect'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingDoc(doc)}
                      className="text-text-muted hover:text-failed p-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CASCADE DELETE CONFIRMATION DIALOG (Stitch AI Matcha Style) */}
      <Dialog
        isOpen={Boolean(deletingDoc)}
        onClose={() => setDeletingDoc(null)}
        title="Permanent Docket Deletion"
        description="This action irrevocably purges the statutory document along with all cryptographic artifacts and citation analyses."
      >
        <div className="space-y-4 text-xs text-text mt-2">
          <div className="p-3 rounded-lg bg-border-subtle border border-border flex items-center gap-2 font-mono">
            <FileText className="w-4 h-4 text-text shrink-0" />
            <span className="font-bold truncate">{deletingDoc?.filename}</span>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-text">
              The following cascading records will be deleted:
            </p>
            <ul className="space-y-1 list-disc list-inside text-text-subtle font-mono text-[11px]">
              <li>Extracted factual ledger claims & arithmetic proof bounds</li>
              <li>Vector search embeddings & semantic chunk registry</li>
              <li>Synthesized visual models (treemaps, sankey charts, GIS layers)</li>
              <li>Verification logs and provenance citation chains</li>
            </ul>
          </div>

          <div className="p-2.5 rounded-lg bg-failed-bg border border-failed-border text-failed text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>This deletion cannot be undone. All proof hashes will be retired.</span>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setDeletingDoc(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingDoc && deleteMutation.mutate(deletingDoc.id)}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Purge Docket Permanently</span>
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
