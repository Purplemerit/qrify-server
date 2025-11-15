// IP Geolocation service using a free API
export interface LocationData {
  country?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}

export async function getLocationFromIP(ip: string): Promise<LocationData> {
  try {
    console.log('Getting location for IP:', ip);
    
    // Skip for localhost/private IPs
    if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      console.log('Skipping location lookup for local/private IP:', ip);
      return {
        country: 'Unknown',
        city: 'Unknown',
        region: 'Unknown'
      };
    }

    console.log('Making API request to ipapi.co for IP:', ip);
    
    // Using ipapi.co free service (1000 requests per day)
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Raw geolocation response:', data);
    
    const locationData = {
      country: data.country_name || 'Unknown',
      city: data.city || 'Unknown', 
      region: data.region || 'Unknown',
      latitude: data.latitude ? parseFloat(data.latitude) : undefined,
      longitude: data.longitude ? parseFloat(data.longitude) : undefined
    };
    
    console.log('Processed location data:', locationData);
    return locationData;
  } catch (error) {
    console.error('Failed to get location from IP:', error);
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown'
    };
  }
}