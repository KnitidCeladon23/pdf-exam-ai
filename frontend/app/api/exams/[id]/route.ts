import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // params may itself be a Promise in Next dev — resolve if needed
    const resolvedParams = (params && typeof (params as any).then === 'function') ? await (params as any) : params;
    const id = typeof resolvedParams?.id === 'string' ? resolvedParams.id : await (resolvedParams?.id as unknown as Promise<string>);
    const response = await fetch(`${BACKEND_URL}/api/exams/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to fetch exam' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Exam fetch proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exam' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const body = await request.json();
    const resolvedParams = (params && typeof (params as any).then === 'function') ? await (params as any) : params;
    const id = typeof resolvedParams?.id === 'string' ? resolvedParams.id : await (resolvedParams?.id as unknown as Promise<string>);

    const response = await fetch(`${BACKEND_URL}/api/exams/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to update exam' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Exam update proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to update exam' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = (params && typeof (params as any).then === 'function') ? await (params as any) : params;
    const id = typeof resolvedParams?.id === 'string' ? resolvedParams.id : await (resolvedParams?.id as unknown as Promise<string>);

    const response = await fetch(`${BACKEND_URL}/api/exams/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to delete exam' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Exam delete proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to delete exam' },
      { status: 500 }
    );
  }
}
