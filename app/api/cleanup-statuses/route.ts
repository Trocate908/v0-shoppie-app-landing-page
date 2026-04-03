import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    // Use service role client so we can delete from storage without RLS restrictions
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Step 1: Fetch all expired statuses BEFORE deleting rows so we have their media_urls
    const { data: expired, error: fetchError } = await serviceClient
      .from("shop_statuses")
      .select("id, media_url, media_type")
      .lt("expires_at", new Date().toISOString())

    if (fetchError) {
      console.error("[cleanup-statuses] Failed to fetch expired statuses:", fetchError.message)
      return NextResponse.json({ error: "Failed to fetch expired statuses" }, { status: 500 })
    }

    if (!expired || expired.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, message: "No expired statuses found" })
    }

    // Step 2: Extract storage paths from media_urls (only image/video — text has no file)
    // Files are stored in the "product-images" bucket under {vendorId}/statuses/{filename}
    // Full URL: https://<project>.supabase.co/storage/v1/object/public/product-images/{vendorId}/statuses/{filename}
    const storagePaths: string[] = expired
      .filter((s) => s.media_type !== "text" && s.media_url)
      .map((s) => {
        try {
          const url = new URL(s.media_url)
          // pathname: /storage/v1/object/public/product-images/<path...>
          const parts = url.pathname.split("/product-images/")
          return parts.length > 1 ? decodeURIComponent(parts[1]) : null
        } catch {
          return null
        }
      })
      .filter(Boolean) as string[]

    // Step 3: Delete storage files in batches
    let storageDeletedCount = 0
    if (storagePaths.length > 0) {
      const { data: storageResult, error: storageError } = await serviceClient.storage
        .from("product-images")
        .remove(storagePaths)

      if (storageError) {
        console.error("[cleanup-statuses] Storage deletion error:", storageError.message)
        // Continue anyway — we still want to delete the DB rows
      } else {
        storageDeletedCount = storageResult?.length ?? 0
      }
    }

    // Step 4: Delete the expired rows from the database
    const expiredIds = expired.map((s) => s.id)
    const { error: deleteError } = await serviceClient
      .from("shop_statuses")
      .delete()
      .in("id", expiredIds)

    if (deleteError) {
      console.error("[cleanup-statuses] DB deletion error:", deleteError.message)
      return NextResponse.json({ error: "Failed to delete expired status rows" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deleted: expired.length,
      storageFilesDeleted: storageDeletedCount,
      message: `Deleted ${expired.length} expired status(es) and ${storageDeletedCount} storage file(s)`,
    })
  } catch (err) {
    console.error("[cleanup-statuses] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to clean up expired statuses and their storage files.",
  })
}
