"use client";
import React, { useEffect, useState } from 'react';

type Exam = {
  id: number;
  url: string;
  subject: string | null;
  createdAt?: string;
};

export default function PDFList() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchExams() {
      try {
        setLoading(true);
        const res = await fetch('/api/exams');
        if (!res.ok) throw new Error('Failed to fetch exams');
        const data = await res.json();
        if (mounted) {
          setExams(data || []);
          setError(null);
        }
      } catch (err: any) {
        console.error('Failed to load exams', err);
        if (mounted) setError(err?.message || 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchExams();

    // Listen for uploads completed to refresh list
    const handler = () => fetchExams();
    window.addEventListener('pdfsUploaded', handler as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('pdfsUploaded', handler as EventListener);
    };
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Loading PDFs…</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;

  if (!exams || exams.length === 0) return <div className="text-sm text-gray-500">No uploaded PDFs yet.</div>;

  

  async function handleDelete(id: number) {
    const ok = confirm('Delete this uploaded PDF? This will remove the record.');
    if (!ok) return;
    try {
      setDeletingId(id);
      const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete');
      }
      setExams((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      console.error('Delete failed', err);
      alert(err?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 text-black">
      <h3 className="text-lg font-semibold mb-3">List of Uploaded Exam PDF Files</h3>
      <ul className="space-y-3">
        {exams.map((exam) => {
          const url = exam.url || '';
          const filename = url.startsWith('/uploads/') ? url.replace(/^\/uploads\//, '') : url;
          const proxyLink = `/api/uploads/${encodeURIComponent(filename)}`;

          return (
            <li key={exam.id} className="p-3 bg-white rounded-md shadow-sm flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">{filename}</div>
                <div className="text-xs text-gray-500">{exam.subject || 'Unknown subject'}</div>
                {exam.createdAt && <div className="text-xs text-gray-400">Uploaded {new Date(exam.createdAt).toLocaleString()}</div>}
              </div>
              <div className="flex items-center gap-2">
                <a href={proxyLink} target="_blank" rel="noreferrer" className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm">Open</a>
                <button
                  onClick={() => handleDelete(exam.id)}
                  disabled={deletingId === exam.id}
                  className="px-3 py-1 bg-red-600 text-white rounded-md text-sm disabled:opacity-50"
                >
                  {deletingId === exam.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
