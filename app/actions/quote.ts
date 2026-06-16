'use server';

export async function getQuoteOfTheDay() {
    try {
        // Fetch quote from ZenQuotes API (supports frontend-bypassed server requests)
        // revalidate caching it for 24 hours (86400 seconds)
        const res = await fetch('https://zenquotes.io/api/today', {
            next: { revalidate: 86400 }
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0 && data[0].q && data[0].a) {
                return { 
                    text: data[0].q, 
                    author: data[0].a 
                };
            }
        }
    } catch (err) {
        console.error("Error fetching quote of the day:", err);
    }

    // Default Fallback Quote
    return { 
        text: "Alone we can do so little; together we can do so much.", 
        author: "Helen Keller" 
    };
}
