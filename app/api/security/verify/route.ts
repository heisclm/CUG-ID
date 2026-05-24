import { NextResponse } from 'next/server';
import { verifyIDPayload } from '@/lib/qr';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  console.log('Verification API called');
  try {
    const body = await req.json();
    console.log('Request body:', body);
    const { qrString } = body;

    if (!qrString) {
      console.error('Missing QR string');
      return NextResponse.json({ error: 'Missing QR string' }, { status: 400 });
    }

    const verifiedData = verifyIDPayload(qrString);
    console.log('Verified data:', verifiedData);

    if (!verifiedData.valid) {
      console.error('Invalid QR:', verifiedData.error);
      return NextResponse.json({ error: verifiedData.error || 'Invalid QR Code signature' }, { status: 400 });
    }

    if (verifiedData.data.expired) {
      console.error('QR expired');
      return NextResponse.json({ error: 'This ID card has expired.', expired: true }, { status: 400 });
    }

    // Double check with database to ensure it's not revoked
    console.log('Checking database for student:', verifiedData.data.s);
    const idCardsRef = adminDb.collection('id_cards');
    const snapshot = await idCardsRef
      .where('studentId', '==', verifiedData.data.s)
      .where('status', '==', 'ACTIVE')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.error('No active ID found');
      return NextResponse.json({ error: 'No active ID card found for this student in the database.' }, { status: 404 });
    }

    const idCardData = snapshot.docs[0].data();
    console.log('ID card found');

    // Fetch clearance status from students collection
    const studentRef = adminDb.collection('students').doc(verifiedData.data.s);
    const studentDoc = await studentRef.get();
    const academicStatus = studentDoc.exists ? studentDoc.data()?.academicStatus : null;
    const isEligibleForCurrentExam = academicStatus ? (academicStatus.isEligibleForCurrentExam ?? false) : false;

    return NextResponse.json({
      verified: true,
      studentDetails: {
        ...idCardData,
        isEligibleForCurrentExam
      }
    });

  } catch (error) {
    console.error('Verification API error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
