import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth.js';
import { fetchDocuments, deleteDocument } from '../lib/api.js';
import type { DocumentListItem } from '@juris/shared';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Dialog,
  EmptyState,
  Skeleton,
  ErrorState,
} from '../components/ui/index.js';
import {
  FileText,
  Upload,
  Search,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';

export const DocumentLibraryPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['documents', user?.id],
    queryFn: fetchDocuments,
    enabled: Boolean(user),
    refetchInterval: (query) => {
      // Auto-poll if any document is queued or processing
      const hasActive = query.state.data?.documents.some(
        (d) => d.status === 'queued' || d.status === 'processing',
      );
      return hasActive ? 3000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      setDeletingDocId(null);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const documents: DocumentListItem[] = data?.documents || [];

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return (
          <Badge variant="teal" className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ready</span>
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="teal" className="flex items-center gap-1 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Processing</span>
          </Badge>
        );
      case 'queued':
        return (
          <Badge variant="neutral" className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Queued</span>
          </Badge>
        );
      case 'failed':
        return (
          <Badge
            variant="neutral"
            className="flex items-center gap-1 text-failed border-failed-border"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Document Intelligence Library
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Upload, verify, and inspect civic documents with deterministic evidence citations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/upload">
            <Button variant="primary" className="flex items-center gap-2 shadow-sm">
              <Upload className="w-4 h-4" />
              <span>Upload Document</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            type="text"
            placeholder="Search documents by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['all', 'done', 'processing', 'queued', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider transition-colors ${
                statusFilter === st
                  ? 'bg-brand-navy text-[var(--btn-primary-text)] shadow-xs'
                  : 'bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-raised'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Document Grid / List */}
      {!user ? (
        <Card className="p-8 text-center max-w-lg mx-auto border-dashed">
          <ShieldCheck className="w-10 h-10 text-accent-teal mx-auto mb-3" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-1/2" />
              <div className="pt-4 border-t border-border flex justify-between">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-8" />
              </div>
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
              ? 'Try changing your search term or status filter.'
              : 'Upload a civic budget or legal policy document to extract facts and verify quotes.'
          }
          actionLabel="Upload Your First Document"
          onAction={() => window.location.assign('/upload')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => {
            const isProcessing = doc.status === 'queued' || doc.status === 'processing';
            return (
              <Card
                key={doc.id}
                className="flex flex-col justify-between hover:border-border-strong transition-all shadow-xs"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-2 rounded-lg bg-surface-raised border border-border text-brand-navy dark:text-brand-navy-hover shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>
                  <CardTitle
                    className="text-base font-semibold text-text mt-3 truncate"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </CardTitle>
                  <CardDescription className="text-xs text-text-subtle">
                    {doc.pageCount > 0 ? `${doc.pageCount} pages` : 'Calculating pages'} •{' '}
                    {formatBytes(doc.fileSizeBytes)}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                  <div className="text-[11px] font-mono text-text-subtle flex items-center justify-between pt-2 border-t border-border">
                    <span>Added {new Date(doc.createdAt).toLocaleDateString()}</span>
                    {doc.isSample && (
                      <span className="text-accent-teal font-semibold">Sample Doc</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    {isProcessing ? (
                      <Link to={`/documents/${doc.id}/progress`} className="w-full">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full flex items-center justify-center gap-1.5 text-xs"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-teal" />
                          <span>Track Progress</span>
                        </Button>
                      </Link>
                    ) : (
                      <Link to={`/documents/${doc.id}`} className="w-full">
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full flex items-center justify-center gap-1.5 text-xs"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>Inspect Facts & Text</span>
                        </Button>
                      </Link>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingDocId(doc.id)}
                      className="text-text-subtle hover:text-failed p-2"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={Boolean(deletingDocId)}
        onClose={() => setDeletingDocId(null)}
        title="Delete Document"
        description="Are you sure you want to delete this document? All extracted facts, vector embeddings, and citation analyses will be permanently removed."
      >
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setDeletingDocId(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deletingDocId && deleteMutation.mutate(deletingDocId)}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>Delete Document</span>
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
