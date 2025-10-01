import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Edit2, MoreVertical, Trash2 } from 'lucide-react';
import clsx from 'clsx';

import { Subject } from '@/types';
import { ICONS } from '@/constants/subjects';

interface SubjectCardProps {
  subject: Subject;
  onEdit: (subject: Subject) => void;
  onDelete: (id: number) => void;
  onArchive: (subject: Subject) => void;
  deletingSubjectId: number | null;
  onNavigate: (subject: Subject) => void;
}

const formatUpdatedAt = (updatedAt: string): string => {
  const date = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays >= 7) {
    return date.toLocaleDateString();
  }

  if (diffDays >= 1) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  if (diffHours >= 1) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes >= 1) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  }

  return 'Just now';
};

export const SubjectCard: React.FC<SubjectCardProps> = ({
  subject,
  onEdit,
  onDelete,
  onArchive,
  deletingSubjectId,
  onNavigate,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const iconGlyph = useMemo(() => {
    return ICONS.find((item) => item.name === subject.icon)?.icon ?? '📚';
  }, [subject.icon]);

  const accentColor = subject.color ?? '#3B82F6';

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleNavigate = () => {
    onNavigate(subject);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigate();
    }
  };

  const handleEdit: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    setIsMenuOpen(false);
    onEdit(subject);
  };

  const handleArchive: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    setIsMenuOpen(false);
    onArchive(subject);
  };

  const handleDelete: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    setIsMenuOpen(false);
    onDelete(subject.id);
  };

  const isDeleting = deletingSubjectId === subject.id;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            aria-hidden
          >
            {iconGlyph}
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900">{subject.name}</h2>
            {subject.description && (
              <p className="line-clamp-2 text-sm text-gray-600">{subject.description}</p>
            )}
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
              <button
                type="button"
                onClick={handleEdit}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
              >
                <Edit2 className="h-4 w-4" />
                Edit details
              </button>
              <button
                type="button"
                onClick={handleArchive}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
              >
                <Archive className="h-4 w-4" />
                {subject.is_archived ? 'Restore' : 'Archive'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className={clsx(
                  'flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition',
                  isDeleting
                    ? 'cursor-not-allowed text-red-300'
                    : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                )}
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600">
        {subject.category && <span className="rounded-full bg-gray-100 px-3 py-1">{subject.category}</span>}
        {subject.level && <span className="rounded-full bg-gray-100 px-3 py-1">Level: {subject.level}</span>}
        {subject.academic_year && <span className="rounded-full bg-gray-100 px-3 py-1">{subject.academic_year}</span>}
        {subject.is_archived && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Archived</span>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Updated {formatUpdatedAt(subject.updated_at)}</span>
        <span className="font-medium text-blue-600">Open workspace →</span>
      </div>
    </div>
  );
};

export default SubjectCard;
