"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Location {
  id: string
  country: string
  city: string
  market_name: string
}

interface LocationSelectorProps {
  locations: Location[]
}

export default function LocationSelector({ locations }: LocationSelectorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedCountry, setSelectedCountry] = useState<string>("")
  const [selectedCity, setSelectedCity] = useState<string>("")
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [isNavigating, setIsNavigating] = useState(false)

  // Get unique countries
  const countries = useMemo(() => {
    const uniqueCountries = Array.from(new Set(locations.map((loc) => loc.country)))
    return uniqueCountries.sort()
  }, [locations])

  // Get cities for selected country
  const availableCities = useMemo(() => {
    if (!selectedCountry) return []
    const cities = Array.from(
      new Set(locations.filter((loc) => loc.country === selectedCountry).map((loc) => loc.city)),
    )
    return cities.sort()
  }, [locations, selectedCountry])

  // Get markets for selected city
  const availableMarkets = useMemo(() => {
    if (!selectedCountry || !selectedCity) return []
    return locations
      .filter((loc) => loc.country === selectedCountry && loc.city === selectedCity)
      .map((loc) => ({ id: loc.id, name: loc.market_name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [locations, selectedCountry, selectedCity])

  const handleCountryChange = (value: string) => {
    setSelectedCountry(value)
    setSelectedCity("")
    setSelectedLocation("")
  }

  const handleCityChange = (value: string) => {
    setSelectedCity(value)
    setSelectedLocation("")
  }

  const handleSubmit = () => {
    if (selectedCountry && selectedCity && selectedLocation) {
      setIsNavigating(true)
      router.push(`/products?location=${selectedLocation}`)
    } else {
      toast({
        variant: "destructive",
        title: "Selection Required",
        description: "Please select country, city, and market",
      })
    }
  }

  const isSubmitDisabled = !selectedCountry || !selectedCity || !selectedLocation || isNavigating

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="space-y-6">
        {/* Country Selection */}
        <div className="space-y-2">
          <Label htmlFor="country" className="text-sm font-medium">
            Country
          </Label>
          <Select value={selectedCountry} onValueChange={handleCountryChange}>
            <SelectTrigger id="country" className="w-full">
              <SelectValue placeholder="Select your country" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {countries.length > 0 ? (
                countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-center text-sm text-muted-foreground">No locations available yet</div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* City Selection */}
        <div className="space-y-2">
          <Label htmlFor="city" className="text-sm font-medium">
            City
          </Label>
          <Select value={selectedCity} onValueChange={handleCityChange} disabled={!selectedCountry}>
            <SelectTrigger id="city" className="w-full">
              <SelectValue placeholder={selectedCountry ? "Select your city" : "Select country first"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {availableCities.length > 0 ? (
                availableCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  {selectedCountry ? "No cities available" : "Select a country first"}
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Market Selection */}
        <div className="space-y-2">
          <Label htmlFor="market" className="text-sm font-medium">
            Market
          </Label>
          <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={!selectedCity}>
            <SelectTrigger id="market" className="w-full">
              <SelectValue placeholder={selectedCity ? "Select your market" : "Select city first"} />
            </SelectTrigger>
            <SelectContent>
              {availableMarkets.length > 0 ? (
                availableMarkets.map((market) => (
                  <SelectItem key={market.id} value={market.id}>
                    {market.name}
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  {selectedCity ? "No markets in this city" : "Select a city first"}
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Submit Button */}
        <Button onClick={handleSubmit} disabled={isSubmitDisabled} size="lg" className="w-full gap-2">
          {isNavigating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <MapPin className="h-5 w-5" />
              View Market Products
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
