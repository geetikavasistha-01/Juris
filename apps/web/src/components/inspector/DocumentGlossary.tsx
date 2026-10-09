import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchGlossary } from '../../lib/api.js';
import { Card, Skeleton } from '../ui/index.js';
import { BookOpen, Search, Bookmark } from 'lucide-react';

export interface DocumentGlossaryProps {
  documentId: string;
  onSelectTermFact?: (factId: string) => void;
}

export const DocumentGlossary: React.FC<DocumentGlossaryProps> = ({
  documentId,
  onSelectTermFact,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['glossary', documentId],
    queryFn: () => fetchGlossary(documentId),
    enabled: Boolean(documentId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const terms = data?.terms || [];
  const filtered = terms.filter(
    (t) =>
      t.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.definition.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6" data-testid="document-glossary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-[var(--text)] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[var(--accent-teal)]" />
            Statutory Defined Terms &amp; Glossary
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Terms defined within the text of this act, gazette, or tender with verbatim quotes and
            page locations.
          </p>
        </div>
        <span className="font-mono text-xs px-2.5 py-1 rounded bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)]">
          {terms.length} Defined Terms
        </span>
      </div>

      {terms.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search defined statutory terms or concepts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg text-xs sm:text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text)] font-mono"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="p-8 text-center bg-[var(--surface)] border border-[var(--border)] space-y-2">
          <Bookmark className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
          <h4 className="font-serif font-bold text-[var(--text)] text-sm">
            {terms.length === 0 ? 'No Explicit Definitions' : 'No Matching Terms'}
          </h4>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
            {terms.length === 0
              ? 'This document does not contain explicit statutory definitions or defined clauses.'
              : 'Try adjusting your search query.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className="p-4 bg-[var(--surface)] border border-[var(--border)] space-y-2 hover:border-[var(--border-strong)] transition-colors cursor-pointer"
              onClick={() => onSelectTermFact && onSelectTermFact(item.factId)}
            >
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-sm text-[var(--text)] underline decoration-dotted underline-offset-4">
                  {item.term}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  Page {item.page}
                </span>
              </div>
              <p className="font-serif text-xs text-[var(--text-muted)] leading-relaxed italic line-clamp-3">
                &ldquo;{item.definition}&rdquo;
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
