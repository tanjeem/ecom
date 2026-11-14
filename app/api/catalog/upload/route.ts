import { NextRequest, NextResponse } from 'next/server';
import { signPhotoUpload } from '@/lib/productUploads';

export const dynamic = 'force-dynamic';

/** Body `{ fileName }` → a signed URL the browser uploads one product photo to. */
export async function POST(req: NextRequest) {
  try {
    const { fileName } = await req.json();
    return NextResponse.json(await signPhotoUpload(String(fileName || 'photo.jpg')));
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not prepare the upload' }, { status: 500 });
  }
}
