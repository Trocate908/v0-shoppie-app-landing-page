"use client"

// ShopShareButton is a thin wrapper around the unified ShareButton with type="shop"
import ShareButton from "@/components/share-button"

interface ShopShareButtonProps {
  shopName: string
  vendorId: string
  location?: string
}

export default function ShopShareButton({ shopName, vendorId, location }: ShopShareButtonProps) {
  return (
    <ShareButton
      type="shop"
      shopName={shopName}
      vendorId={vendorId}
      location={location}
      variant="outline"
      size="sm"
      showLabel
    />
  )
}
