// IP Geolocation service using a free API
export interface LocationData {
  country?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}

export async function getLocationFromIP(ip: string): Promise<LocationData> {
  let targetIP = ip; // Declare in function scope
  
  try {
    console.log('🌍 Getting location for IP:', ip);
    
    // For localhost/private IPs, get the actual public IP and use that for geolocation
    if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      console.log('🌍 Local/private IP detected, getting public IP instead...');
      try {
        targetIP = await getPublicIP();
        console.log('🌍 Found public IP:', targetIP);
      } catch (error) {
        console.error('🌍 Failed to get public IP:', error);
        return {
          country: 'Unknown',
          city: 'Unknown',
          region: 'Unknown'
        };
      }
    }

    console.log('🌍 Making API request to ipapi.co for IP:', targetIP);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      // Using ipapi.co free service (1000 requests per day)
      const response = await fetch(`https://ipapi.co/${targetIP}/json/`, {
        headers: {
          'User-Agent': 'QRify-Stats/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
    
      if (!response.ok) {
        console.error(`🌍 HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
        
        // If rate limited, try alternative service
        if (response.status === 429) {
          console.log('🌍 Rate limited, trying alternative service...');
          return await getLocationFromIPFallback(ip);
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🌍 Raw geolocation response:', data);
      
      // Check if the API returned an error
      if (data.error) {
        console.error('🌍 API returned error:', data.error);
        return await getLocationFromIPFallback(ip);
      }
      
      const locationData = {
        country: data.country_name || 'Unknown',
        city: data.city || 'Unknown', 
        region: data.region || 'Unknown',
        latitude: data.latitude ? parseFloat(data.latitude) : undefined,
        longitude: data.longitude ? parseFloat(data.longitude) : undefined
      };
      
      console.log('🌍 Processed location data:', locationData);
      return locationData;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('🌍 Failed to get location from IP:', error);
    
    // Don't try fallback if aborted due to timeout
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      console.log('🌍 Request timed out, skipping fallback');
      return {
        country: 'Unknown',
        city: 'Unknown',
        region: 'Unknown'
      };
    }
    
    return await getLocationFromIPFallback(targetIP || ip);
  }
}

// Fallback geolocation service using ip-api.com
async function getLocationFromIPFallback(ip: string): Promise<LocationData> {
  try {
    console.log('🌍 Using fallback service for IP:', ip);
    
    // For localhost/private IPs, we should have already resolved to public IP
    // But just in case, don't skip here - the IP should already be public
    if (!ip) {
      return {
        country: 'Unknown',
        city: 'Unknown', 
        region: 'Unknown'
      };
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      // Using ip-api.com free service (no key required, 1000/month)
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName,lat,lon`, {
        headers: {
          'User-Agent': 'QRify-Stats/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
    
      if (!response.ok) {
        console.error('🌍 Fallback service HTTP error:', response.status);
        throw new Error(`Fallback HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🌍 Fallback geolocation response:', data);
      
      if (data.status !== 'success') {
        console.error('🌍 Fallback API returned error status:', data.status);
        throw new Error(`Fallback API error: ${data.status}`);
      }
      
      return {
        country: data.country || 'Unknown',
        city: data.city || 'Unknown',
        region: data.regionName || 'Unknown',
        latitude: data.lat ? parseFloat(data.lat) : undefined,
        longitude: data.lon ? parseFloat(data.lon) : undefined
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('🌍 Fallback geolocation also failed:', error);
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown'
    };
  }
}

// Helper function to get the public IP address
async function getPublicIP(): Promise<string> {
  try {
    console.log('🌍 Getting public IP address...');
    
    // Try multiple services in case one is down
    const services = [
      'https://api.ipify.org?format=text',
      'https://ifconfig.me/ip',
      'https://icanhazip.com',
      'https://checkip.amazonaws.com'
    ];
    
    for (const service of services) {
      try {
        console.log(`🌍 Trying service: ${service}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(service, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'QRify-Stats/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const publicIP = (await response.text()).trim();
          console.log(`🌍 Got public IP from ${service}: ${publicIP}`);
          return publicIP;
        }
      } catch (error) {
        console.log(`🌍 Service ${service} failed:`, error);
        continue; // Try next service
      }
    }
    
    throw new Error('All public IP services failed');
  } catch (error) {
    console.error('🌍 Failed to get public IP:', error);
    throw error;
  }
}