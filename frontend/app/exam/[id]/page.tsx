"use client";
import { use } from 'react';
import ExamViewer from '@/components/ExamViewer';

export default function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <main className="min-h-screen bg-gray-50">
      <ExamViewer examId={parseInt(id)} />
    </main>
  );
}