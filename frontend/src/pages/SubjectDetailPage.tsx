import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import clsx from 'clsx';

import { subjectService } from '@/services/subjects';
import { Subject } from '@/types';
import { ICONS } from '@/constants/subjects';
import DocumentUpload from '@/components/documents/DocumentUpload';
import { DocumentLibrarySection } from '@/components/documents/DocumentLibrarySection';
import { useDocumentsStore } from '@/store/documentsStore';

type TabId = 'documents' | 'notes' | 'flashcards' | 'settings';

const TABS: Array<{ id: TabId; label: string; isEnabled: boolean }> = [
  { id: 'documents', label: 'Documents', isEnabled: true },
  { id: 'notes', label: 'Notes', isEnabled: false },
  { id: 'flashcards', label: 'Flashcards', isEnabled: false },
  { id: 'settings', label: 'Settings', isEnabled: false },
];

const SubjectDetailPage: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('documents');
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const subjectNumericId = useMemo(() => {
    const parsed = Number(subjectId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [subjectId]);

  const fetchDocuments = useDocumentsStore((state) => state.fetchDocuments);

  useEffect(() => {
    if (subjectNumericId === null) {
      setError('Invalid subject identifier.');
      setIsLoading(false);
      return;
    }

    let isSubscribed = true;
    setIsLoading(true);
    subjectService
      .getSubject(subjectNumericId)
      .then((data) => {
        if (!isSubscribed) return;
        setSubject(data);
        setError(null);
      })
      .catch((err: any) => {
        if (!isSubscribed) return;
        const detail = err?.response?.data?.detail;
        setError(detail || 'Unable to load subject details.');
      })
      .finally(() => {
        if (!isSubscribed) return;
        setIsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [subjectNumericId]);

  const subjectIcon = useMemo(() => {
    if (!subject) return '📚';
    return ICONS.find((item) => item.name === subject.icon)?.icon ?? '📚';
  }, [subject]);

  const subjectColor = useMemo(() => {
    if (!subject?.color) return '#e0ecff';
    return subject.color;
  }, [subject?.color]);

  const handleUploadComplete = async () => {
    if (subjectNumericId === null) return;
    await fetchDocuments(subjectNumericId, 1, true);
    setShowUploadPanel(false);
    setUploadError(null);
  };

  const handleUploadError = (message: string) => {
    setUploadError(message);
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-gray-600">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="mt-4 text-sm">Loading subject workspace…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50/60 p-8 text-red-700">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-6 w-6 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-semibold">We hit a snag</h1>
            <p className="mt-2 text-sm">{error}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </button>
              <Link
                to="/subjects"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                View all subjects
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!subject || subjectNumericId === null) {
    return null;
  }

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <nav className="text-sm text-gray-500">
          <Link to="/subjects" className="font-medium text-gray-500 transition hover:text-gray-700">
            My Subjects
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{subject.name}</span>
        </nav>

        <header className="flex flex-col gap-6 rounded-3xl bg-white p-8 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{ backgroundColor: subjectColor + '20' }}
              aria-hidden
            >
              {subjectIcon}
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <BookOpen className="h-4 w-4" />
                  Subject workspace
                </div>
                <h1 className="mt-1 text-3xl font-bold text-gray-900">{subject.name}</h1>
              </div>
              {subject.description && (
                <p className="max-w-2xl text-sm text-gray-600">{subject.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600">
                {subject.category && (
                  <span className="rounded-full bg-gray-100 px-3 py-1">{subject.category}</span>
                )}
                {subject.level && (
                  <span className="rounded-full bg-gray-100 px-3 py-1">Level: {subject.level}</span>
                )}
                {subject.academic_year && (
                  <span className="rounded-full bg-gray-100 px-3 py-1">Academic year: {subject.academic_year}</span>
                )}
                {subject.is_archived && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Archived</span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 rounded-2xl bg-white px-4 py-2 shadow-sm">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const isDisabled = !tab.isEnabled;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (isDisabled) return;
                  setActiveTab(tab.id);
                }}
                className={clsx(
                  'inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100',
                  isDisabled && !isActive && 'cursor-not-allowed opacity-60'
                )}
                aria-pressed={isActive}
                disabled={isDisabled}
              >
                {tab.label}
                {isDisabled && tab.id !== 'documents' && (
                  <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'documents' && (
        <div className="space-y-6">
          {uploadError && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>{uploadError}</span>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="ml-auto text-xs font-medium underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {showUploadPanel && (
            <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Add a new document</h2>
                  <p className="text-sm text-gray-500">Upload files to enrich this subject’s library.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadPanel(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
              <DocumentUpload
                subjectId={subjectNumericId}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </div>
          )}

          <DocumentLibrarySection
            subjectId={subjectNumericId}
            onRequestUpload={() => setShowUploadPanel(true)}
          />
        </div>
      )}
    </div>
  );
};

export default SubjectDetailPage;
