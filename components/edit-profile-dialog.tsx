"use client"

import type React from "react"
import { useState, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Edit, Camera, Loader2, User } from "lucide-react"
import Image from "next/image"

type VendorData = {
  id: string
  shop_name: string
  shop_description?: string
  location_id: string
  location: {
    name: string
    city: string
    country: string
  }
  whatsapp_number?: string
  profile_picture_url?: string
}

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "East Timor",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
]

export function EditProfileDialog({ vendor }: { vendor: VendorData }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shopName, setShopName] = useState(vendor.shop_name)
  const [shopDescription, setShopDescription] = useState(vendor.shop_description || "")
  const [whatsappNumber, setWhatsappNumber] = useState(vendor.whatsapp_number || "")
  const [country, setCountry] = useState(vendor.location.country)
  const [city, setCity] = useState(vendor.location.city)
  const [marketName, setMarketName] = useState(vendor.location.name)
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(
    vendor.profile_picture_url || null,
  )
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Profile picture must be under 5MB",
        variant: "destructive",
      })
      return
    }

    setProfilePictureFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setProfilePicturePreview(reader.result as string)
    reader.readAsDataURL(file)

    // Reset input
    e.target.value = ""
  }

  const handleSave = async () => {
    if (!shopName.trim() || !country || !city.trim() || !marketName.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (whatsappNumber && !/^\+?[1-9]\d{1,14}$/.test(whatsappNumber.replace(/\s/g, ""))) {
      toast({
        title: "Invalid WhatsApp number",
        description: "Please enter a valid WhatsApp number with country code (e.g., +265991234567)",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    const supabase = createBrowserClient()

    try {
      // Upload profile picture to Cloudinary if changed
      let profilePictureUrl = vendor.profile_picture_url || null

      if (profilePictureFile) {
        setUploadingPhoto(true)
        const uploadData = new FormData()
        uploadData.append("file", profilePictureFile)
        uploadData.append("upload_preset", "shoppieapp_products")
        uploadData.append("folder", `vendors/${vendor.id}/profile`)

        const cloudinaryResponse = await fetch("https://api.cloudinary.com/v1_1/dibqpzu1j/image/upload", {
          method: "POST",
          body: uploadData,
        })

        if (!cloudinaryResponse.ok) {
          throw new Error("Failed to upload profile picture")
        }

        const cloudinaryData = await cloudinaryResponse.json()
        profilePictureUrl = cloudinaryData.secure_url
        setUploadingPhoto(false)
      }
      const { data: existingLocation } = await supabase
        .from("locations")
        .select("id")
        .eq("country", country)
        .eq("city", city)
        .eq("market_name", marketName)
        .maybeSingle()

      let locationId = existingLocation?.id || vendor.location_id

      if (
        !existingLocation &&
        (country !== vendor.location.country || city !== vendor.location.city || marketName !== vendor.location.name)
      ) {
        const { data: newLocation, error: locationError } = await supabase
          .from("locations")
          .insert({ country, city, market_name: marketName })
          .select("id")
          .single()

        if (locationError) throw locationError
        locationId = newLocation.id
      }

      const { error: vendorError } = await supabase
        .from("vendors")
        .update({
          shop_name: shopName,
          shop_description: shopDescription || null,
          whatsapp_number: whatsappNumber || null,
          location_id: locationId,
          profile_picture_url: profilePictureUrl,
        })
        .eq("id", vendor.id)

      if (vendorError) throw vendorError

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated",
      })

      setOpen(false)
      window.location.reload()
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your shop details and location</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Profile Picture */}
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border bg-muted">
                  {profilePicturePreview ? (
                    <Image
                      src={profilePicturePreview}
                      alt="Profile picture preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors"
                  aria-label="Change profile picture"
                >
                  <Camera className="h-3.5 w-3.5 text-foreground" />
                </button>
              </div>
              <div className="flex-1 space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-3.5 w-3.5" />
                      {profilePicturePreview ? "Change Photo" : "Upload Photo"}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">JPG, PNG or WebP. Max 5MB.</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
              aria-label="Upload profile picture"
            />
          </div>

          <div className="border-t border-border" />
          <div className="space-y-2">
            <Label htmlFor="shop-name">Shop Name *</Label>
            <Input
              id="shop-name"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Enter shop name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shop-description">Shop Description</Label>
            <Textarea
              id="shop-description"
              value={shopDescription}
              onChange={(e) => setShopDescription(e.target.value)}
              placeholder="Describe your shop"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp-number">WhatsApp Number</Label>
            <Input
              id="whatsapp-number"
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+265991234567"
            />
            <p className="text-xs text-muted-foreground">
              Include country code. Buyers will be able to contact you via WhatsApp.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country *</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City *</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="market-name">Market/Location Name *</Label>
            <Input
              id="market-name"
              value={marketName}
              onChange={(e) => setMarketName(e.target.value)}
              placeholder="Enter market or location name"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || uploadingPhoto}>
            {loading ? (uploadingPhoto ? "Uploading photo..." : "Saving...") : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
