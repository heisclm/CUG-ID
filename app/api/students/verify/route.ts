import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { studentId } = await req.json();

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    const studentDoc = await adminDb.collection('students').doc(studentId).get();

    if (!studentDoc.exists) {
      return NextResponse.json(
        { error: 'Student ID not found in the database. Please contact administration.' },
        { status: 404 }
      );
    }

    const data = studentDoc.data()!;

    // Return strictly the non-sensitive fields needed for the UI
    return NextResponse.json({
      success: true,
      data: {
        fullName: data.fullName,
        department: data.department,
        program: data.program || 'N/A',
      },
    });
  } catch (error: any) {
    console.error('Error verifying student ID:', error);
    return NextResponse.json({ error: 'Failed to verify Student ID on server.' }, { status: 500 });
  }
}
