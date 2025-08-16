import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    console.log('Simple upload API called');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const bucketId = formData.get('bucketId') as string;
    
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!bucketId) {
      return Response.json({ error: 'No bucket ID provided' }, { status: 400 });
    }

    console.log(`File received: ${file.name} (${file.type}, ${file.size} bytes) for bucket: ${bucketId}`);
    
    return Response.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      bucketId,
      message: 'File received successfully (no processing yet)'
    });

  } catch (error) {
    console.error('Simple upload error:', error);
    return Response.json({ 
      error: 'Failed to process uploaded file',
      details: error.message 
    }, { status: 500 });
  }
}