export async function POST() {
  console.log('Upload test API called');
  return Response.json({ message: 'Upload test API working!' });
}