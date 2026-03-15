import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get("url")

  if (!imageUrl) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  // Only allow Pexels images
  if (!imageUrl.includes("pexels.com") && !imageUrl.includes("images.pexels.com")) {
    return NextResponse.json({ error: "Only Pexels images are allowed" }, { status: 403 })
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "ShoppieApp/1.0",
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status })
    }

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") || "image/jpeg"

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to proxy image" }, { status: 500 })
  }
}
