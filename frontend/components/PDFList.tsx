"use client";
import React, { useEffect, useState } from 'react';

type Exam = {
  id: number;
  url: string;
  name: string;
  subject: string | null;
  createdAt?: string;
};

export default function PDFList() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [savingId, setSavingId] = useState<number | null>(null);

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

  function handleEdit(exam: Exam) {
    setEditingId(exam.id);
    setEditingName(exam.name || '');
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditingName('');
  }

  async function handleSave(id: number) {
    if (!editingName.trim()) {
      alert('Filename cannot be empty');
      return;
    }

    try {
      setSavingId(id);
      const res = await fetch(`/api/exams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update');
      }

      const updatedExam = await res.json();
      setExams((prev) =>
        prev.map((e) => (e.id === id ? { ...e, name: updatedExam.name } : e))
      );
      setEditingId(null);
      setEditingName('');
    } catch (err: any) {
      console.error('Update failed', err);
      alert(err?.message || 'Update failed');
    } finally {
      setSavingId(null);
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
              <div className="flex-1 mr-4">
                {editingId === exam.id ? (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Edit filename:</label>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <div className="text-xs text-gray-400 mt-1">File: {filename}</div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-gray-800">{exam.name || filename}</div>
                    <div className="text-xs text-gray-500">File: {filename}</div>
                    {exam.createdAt && <div className="text-xs text-gray-400">Uploaded {new Date(exam.createdAt).toLocaleString()}</div>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingId === exam.id ? (
                  <>
                    <button
                      onClick={() => handleSave(exam.id)}
                      disabled={savingId === exam.id}
                      className="px-3 py-1 bg-green-600 text-white rounded-md text-sm disabled:opacity-50"
                    >
                      {savingId === exam.id ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={savingId === exam.id}
                      className="px-3 py-1 bg-gray-400 text-white rounded-md text-sm disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <a href={proxyLink} target="_blank" rel="noreferrer" className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Open PDF</a>
                    <a href={`/exam/${exam.id}`} className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">View Exam</a>
                    <button
                      onClick={() => handleEdit(exam)}
                      className="px-3 py-1 bg-yellow-600 text-white rounded-md text-sm hover:bg-yellow-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(exam.id)}
                      disabled={deletingId === exam.id}
                      className="px-3 py-1 bg-red-600 text-white rounded-md text-sm disabled:opacity-50 hover:bg-red-700"
                    >
                      {deletingId === exam.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
