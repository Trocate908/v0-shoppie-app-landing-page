import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query")
  const page = searchParams.get("page") || "1"
  const perPage = searchParams.get("per_page") || "15"

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 })
  }

  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Pexels API key not configured" }, { status: 500 })
  }

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&orientation=square`

    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch from Pexels" }, { status: response.status })
    }

    const data = await response.json()

    const photos = data.photos.map((photo: any) => ({
      id: photo.id,
      url: photo.src.large,
      thumb: photo.src.medium,
      photographer: photo.photographer,
      alt: photo.alt || query,
    }))

    return NextResponse.json({
      photos,
      total_results: data.total_results,
      page: data.page,
      per_page: data.per_page,
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
