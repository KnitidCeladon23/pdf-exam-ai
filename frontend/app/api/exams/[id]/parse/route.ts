import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // params may itself be a Promise in Next dev — resolve if needed
    const resolvedParams = (params && typeof (params as any).then === 'function') ? await (params as any) : params;
    const id = typeof resolvedParams?.id === 'string' ? resolvedParams.id : await (resolvedParams?.id as unknown as Promise<string>);
    
    const response = await fetch(`${BACKEND_URL}/api/exams/${id}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to parse exam' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Exam parse proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to parse exam' },
      { status: 500 }
    );
  }
}
