import PDFList from '@/components/PDFList';
import PDFUpload from '@/components/PDFUpload';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ExamGPT
          </h1>
          <p className="text-lg text-gray-600">
            Upload and analyze your exam PDFs with AI
          </p>
        </div>
        <PDFUpload />
        <PDFList />
      </div>
    </div>
  );
}

