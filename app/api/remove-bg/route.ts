import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.REMOVE_BG_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Background removal is not configured." }, { status: 500 })
    }

    const formData = await req.formData()
    const imageFile = formData.get("image_file")
    const imageUrl = formData.get("image_url")

    if (!imageFile && !imageUrl) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    const removeBgForm = new FormData()
    removeBgForm.append("size", "auto")

    if (imageUrl && typeof imageUrl === "string") {
      // Remote URL — let remove.bg fetch it server-to-server (no browser CORS issues)
      removeBgForm.append("image_url", imageUrl)
    } else if (imageFile && typeof imageFile !== "string") {
      // Local file upload
      if (imageFile.size === 0) {
        return NextResponse.json({ error: "Image file is empty" }, { status: 400 })
      }
      removeBgForm.append("image_file", imageFile)
    } else {
      return NextResponse.json({ error: "Invalid image input" }, { status: 400 })
    }

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: removeBgForm,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("[remove-bg] API error:", response.status, errText)
      let friendlyError = `Remove.bg error (${response.status})`
      try {
        const parsed = JSON.parse(errText)
        const msg = parsed?.errors?.[0]?.title || parsed?.error || errText
        if (msg) friendlyError = msg
      } catch { if (errText) friendlyError = errText }
      return NextResponse.json({ error: friendlyError }, { status: response.status })
    }

    const imageBuffer = await response.arrayBuffer()
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(imageBuffer.byteLength),
      },
    })
  } catch (err) {
    console.error("[remove-bg] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
