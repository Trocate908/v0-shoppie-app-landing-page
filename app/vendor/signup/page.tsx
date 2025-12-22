"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
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
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
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
  "North Korea",
  "South Korea",
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
  "Macedonia",
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
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
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
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Swaziland",
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

export default function VendorSignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [shopName, setShopName] = useState("")
  const [shopDescription, setShopDescription] = useState("")
  const [country, setCountry] = useState("")
  const [city, setCity] = useState("")
  const [locationName, setLocationName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)

    if (password !== repeatPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Passwords do not match",
      })
      setIsLoading(false)
      return
    }

    if (!country || !city.trim() || !locationName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in country, city, and market location",
      })
      setIsLoading(false)
      return
    }

    try {
      const { data: existingUser } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .maybeSingle()

      if (existingUser) {
        toast({
          variant: "destructive",
          title: "Account Already Exists",
          description: "You already have a vendor account. Please login instead.",
        })
        setIsLoading(false)
        return
      }

      // Step 1: Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/vendor/dashboard`,
          data: {
            shop_name: shopName,
          },
        },
      })

      if (authError) {
        if (authError.message.includes("User already registered")) {
          throw new Error("This email is already registered. Please login instead.")
        }
        throw authError
      }

      if (!authData.user) throw new Error("Failed to create user account")

      // Step 2: Immediately sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        toast({
          title: "Account Created",
          description: "Please login to continue.",
        })
        await new Promise((resolve) => setTimeout(resolve, 1500))
        window.location.href = "/vendor/login"
        return
      }

      if (!signInData.user) throw new Error("Auto-login failed")

      // Step 3: Create or find location
      let locationId: string

      const { data: existingLocation } = await supabase
        .from("locations")
        .select("id")
        .eq("country", country)
        .eq("city", city.trim())
        .eq("market_name", locationName.trim())
        .maybeSingle()

      if (existingLocation) {
        locationId = existingLocation.id
      } else {
        const { data: newLocation, error: locationError } = await supabase
          .from("locations")
          .insert({
            country,
            city: city.trim(),
            market_name: locationName.trim(),
          })
          .select("id")
          .single()

        if (locationError) throw locationError
        if (!newLocation) throw new Error("Failed to create location")
        locationId = newLocation.id
      }

      // Step 4: Create vendor profile
      const { error: vendorError } = await supabase.from("vendors").insert({
        user_id: signInData.user.id,
        location_id: locationId,
        shop_name: shopName,
        shop_description: shopDescription,
        is_open: true,
      })

      if (vendorError) {
        if (vendorError.message.includes("duplicate")) {
          throw new Error("A vendor account already exists for this user. Please login instead.")
        }
        throw vendorError
      }

      toast({
        title: "Success!",
        description: "Your vendor account has been created. Redirecting...",
      })

      // Step 5: Redirect to dashboard
      await new Promise((resolve) => setTimeout(resolve, 1000))
      window.location.href = "/vendor/dashboard"
    } catch (error: unknown) {
      console.error("[v0] Signup error:", error)
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error instanceof Error ? error.message : "An error occurred during signup. Please try again.",
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Vendor Sign Up</CardTitle>
              <CardDescription>Create your vendor account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="vendor@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="repeat-password">Repeat Password</Label>
                    <Input
                      id="repeat-password"
                      type="password"
                      required
                      minLength={6}
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shop-name">Shop Name</Label>
                    <Input
                      id="shop-name"
                      type="text"
                      placeholder="My Shop"
                      required
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shop-description">Shop Description (optional)</Label>
                    <Textarea
                      id="shop-description"
                      placeholder="Brief description of your shop"
                      value={shopDescription}
                      onChange={(e) => setShopDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Country</Label>
                    <Select value={country} onValueChange={setCountry} required>
                      <SelectTrigger id="country">
                        <SelectValue placeholder="Select your country" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {COUNTRIES.map((countryName) => (
                          <SelectItem key={countryName} value={countryName}>
                            {countryName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      type="text"
                      placeholder="e.g., Nairobi, Lagos, Accra"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="location">Market Name</Label>
                    <Input
                      id="location"
                      type="text"
                      placeholder="e.g., Downtown Market"
                      required
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">The specific market where your shop is located</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Sign up"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  Already have an account?{" "}
                  <Link href="/vendor/login" className="underline underline-offset-4">
                    Login
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
