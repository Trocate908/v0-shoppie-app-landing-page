import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("image_file")

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 })
    }

    const apiKey = process.env.REMOVE_BG_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Remove.bg API key not configured" }, { status: 500 })
    }

    const removeBgForm = new FormData()
    removeBgForm.append("image_file", file)
    removeBgForm.append("size", "auto")

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: removeBgForm,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("[remove-bg] API error:", response.status, errText)
      return NextResponse.json(
        { error: `Remove.bg error: ${response.statusText}` },
        { status: response.status },
      )
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
