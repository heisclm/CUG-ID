import { v2 as cloudinary } from 'cloudinary';
import { NextRequest, NextResponse } from 'next/server';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const { file, folder, publicId } = await req.json();
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const uploadOptions: any = {
      folder: folder || 'cug_digital_id_photos',
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    // Upload base64 string to Cloudinary
    const result = await cloudinary.uploader.upload(file, uploadOptions);

    return NextResponse.json({ secure_url: result.secure_url });
  } catch (error: any) {
    console.error('Cloudinary upload API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}
