// ===== Google Places API Integration =====
// Using Google Maps JavaScript API to avoid CORS issues

// API Key Management
function getApiKey() {
    return localStorage.getItem('googlePlacesApiKey') || '';
}

function saveApiKey(apiKey) {
    localStorage.setItem('googlePlacesApiKey', apiKey);
}

function hasApiKey() {
    return getApiKey().length > 0;
}

// Usage Tracking
function getUsageData() {
    const stored = localStorage.getItem('apiUsageData');
    if (!stored) {
        return {
            month: new Date().getMonth(),
            year: new Date().getFullYear(),
            searchCount: 0
        };
    }
    return JSON.parse(stored);
}

function saveUsageData(data) {
    localStorage.setItem('apiUsageData', JSON.stringify(data));
}

function incrementUsageCount() {
    const usage = getUsageData();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Reset if new month
    if (usage.month !== currentMonth || usage.year !== currentYear) {
        usage.month = currentMonth;
        usage.year = currentYear;
        usage.searchCount = 0;
    }

    usage.searchCount++;
    saveUsageData(usage);
    updateUsageDisplay();
}

function updateUsageDisplay() {
    const usage = getUsageData();
    const costPerSearch = 0.037; // Geocoding + Places API
    const estimatedCost = usage.searchCount * costPerSearch;
    const freeQuota = 200;
    const remaining = Math.max(0, freeQuota - estimatedCost);

    document.getElementById('monthlySearchCount').textContent = usage.searchCount;
    document.getElementById('estimatedCost').textContent = `$${estimatedCost.toFixed(2)}`;
    document.getElementById('freeQuotaRemaining').textContent = `$${remaining.toFixed(2)}`;
}

// Load Google Maps JavaScript API
function loadGoogleMapsAPI(apiKey) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.google && window.google.maps) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ja`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Google Maps API の読み込みに失敗しました'));
        document.head.appendChild(script);
    });
}

// Search for places using Google Maps JavaScript API
// Fetches all available results using pagination (no limit)
async function searchPlaces(location, keyword) {
    const apiKey = getApiKey();

    try {
        // Load Google Maps API if not already loaded
        await loadGoogleMapsAPI(apiKey);

        // Create a geocoder to convert location to coordinates
        const geocoder = new google.maps.Geocoder();

        return new Promise((resolve, reject) => {
            geocoder.geocode({ address: location }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;

                    // Create a map element (hidden)
                    let mapDiv = document.getElementById('hidden-map');
                    if (!mapDiv) {
                        mapDiv = document.createElement('div');
                        mapDiv.id = 'hidden-map';
                        mapDiv.style.display = 'none';
                        document.body.appendChild(mapDiv);
                    }

                    const map = new google.maps.Map(mapDiv, {
                        center: location,
                        zoom: 15
                    });

                    const service = new google.maps.places.PlacesService(map);
                    const request = {
                        location: location,
                        radius: 20000, // 20km radius
                        keyword: keyword,
                        language: 'ja'
                    };

                    let allPlaces = [];

                    // Function to process results and fetch next page if available
                    const processResults = (results, status, pagination) => {
                        if (status === google.maps.places.PlacesServiceStatus.OK) {
                            // Add current page results
                            const places = results.map(place => ({
                                id: place.place_id,
                                name: place.name,
                                address: place.vicinity || '',
                                rating: place.rating || 0,
                                userRatingsTotal: place.user_ratings_total || 0,
                                types: place.types || [],
                                location: {
                                    lat: place.geometry.location.lat(),
                                    lng: place.geometry.location.lng()
                                }
                            }));

                            allPlaces = allPlaces.concat(places);

                            // Check if there's a next page
                            if (pagination && pagination.hasNextPage) {
                                // Fetch next page after a short delay (required by Google API)
                                setTimeout(() => {
                                    pagination.nextPage();
                                }, 2000);
                            } else {
                                // No more pages, return all results
                                incrementUsageCount();
                                resolve(allPlaces);
                            }
                        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                            incrementUsageCount();
                            resolve(allPlaces.length > 0 ? allPlaces : []);
                        } else {
                            reject(new Error(`検索エラー: ${status}`));
                        }
                    };

                    // Start the search
                    service.nearbySearch(request, processResults);
                } else {
                    reject(new Error(`住所の検索に失敗しました: ${status}`));
                }
            });
        });
    } catch (error) {
        throw error;
    }
}

// Test API Key
async function testApiKey(apiKey) {
    try {
        await loadGoogleMapsAPI(apiKey);
        return { success: true, message: '接続成功！APIキーは有効です。' };
    } catch (error) {
        return { success: false, message: 'APIキーが無効です。正しいキーを入力してください。' };
    }
}

// ===== Place Details API =====

// Get detailed information about a place
async function getPlaceDetails(placeId) {
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('APIキーが設定されていません');
        }

        await loadGoogleMapsAPI(apiKey);

        return new Promise((resolve, reject) => {
            const map = new google.maps.Map(document.createElement('div'));
            const service = new google.maps.places.PlacesService(map);

            const request = {
                placeId: placeId,
                fields: [
                    'name',
                    'formatted_address',
                    'formatted_phone_number',
                    'international_phone_number',
                    'website',
                    'opening_hours',
                    'rating',
                    'user_ratings_total',
                    'reviews',
                    'photos',
                    'geometry'
                ]
            };

            service.getDetails(request, (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    // Increment usage count
                    incrementUsageCount();

                    // Format the response
                    const details = {
                        name: place.name,
                        address: place.formatted_address,
                        phone: place.formatted_phone_number || place.international_phone_number,
                        website: place.website,
                        rating: place.rating,
                        ratingsTotal: place.user_ratings_total,
                        reviews: place.reviews ? place.reviews.slice(0, 3) : [], // Get first 3 reviews
                        photos: place.photos ? place.photos.slice(0, 5).map(photo => photo.getUrl({ maxWidth: 400 })) : [],
                        location: place.geometry ? {
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng()
                        } : null,
                        openingHours: place.opening_hours ? {
                            isOpen: place.opening_hours.isOpen(),
                            weekdayText: place.opening_hours.weekday_text
                        } : null
                    };

                    resolve(details);
                } else {
                    reject(new Error(`詳細情報の取得に失敗しました: ${status}`));
                }
            });
        });
    } catch (error) {
        throw error;
    }
}

// Get Street View URL
function getStreetViewUrl(lat, lng, apiKey) {
    const size = '600x400';
    const fov = 90; // Field of view
    const heading = 0; // Compass heading
    const pitch = 0; // Camera pitch

    return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&fov=${fov}&heading=${heading}&pitch=${pitch}&key=${apiKey}`;
}

// Get Street View Static Image URL (for embedding)
function getStreetViewStaticUrl(lat, lng) {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    return getStreetViewUrl(lat, lng, apiKey);
}
