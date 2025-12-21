import { NextResponse } from 'next/server'

export async function GET() {
  return new NextResponse('export {}\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

