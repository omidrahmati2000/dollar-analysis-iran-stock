// Unified search service for stocks and currencies
class SearchService {
    static BASE_URL = 'http://localhost:8000/api/v2';
    
    // Search both stocks and currencies
    static async searchAll(query, limit = 20) {
        if (!query || query.length < 2) {
            return { stocks: [], currencies: [] };
        }

        try {
            const [stocksResponse, currenciesResponse] = await Promise.all([
                fetch(`${this.BASE_URL}/stocks/search?q=${encodeURIComponent(query)}&limit=${limit}`),
                fetch(`${this.BASE_URL}/currencies/search?q=${encodeURIComponent(query)}&limit=${limit}`)
            ]);

            const stocks = stocksResponse.ok ? await stocksResponse.json() : [];
            const currencies = currenciesResponse.ok ? await currenciesResponse.json() : [];

            return { stocks, currencies };
        } catch (error) {
            console.error('Error searching:', error);
            return { stocks: [], currencies: [] };
        }
    }

    // Search only stocks
    static async searchStocks(query, limit = 20) {
        if (!query || query.length < 2) {
            return [];
        }

        try {
            const response = await fetch(`${this.BASE_URL}/stocks/search?q=${encodeURIComponent(query)}&limit=${limit}`);
            return response.ok ? await response.json() : [];
        } catch (error) {
            console.error('Error searching stocks:', error);
            return [];
        }
    }

    // Search only currencies
    static async searchCurrencies(query, limit = 20) {
        if (!query || query.length < 2) {
            return [];
        }

        try {
            const response = await fetch(`${this.BASE_URL}/currencies/search?q=${encodeURIComponent(query)}&limit=${limit}`);
            return response.ok ? await response.json() : [];
        } catch (error) {
            console.error('Error searching currencies:', error);
            return [];
        }
    }

    // Filter local data (fallback when API search is not available)
    static filterLocalData(data, query, searchFields = ['symbol', 'company_name', 'currency_code', 'currency_name']) {
        if (!query || query.length < 2 || !Array.isArray(data)) {
            return [];
        }

        const lowerQuery = query.toLowerCase();
        
        return data.filter(item => {
            return searchFields.some(field => {
                const value = item[field];
                if (typeof value === 'string') {
                    return value.toLowerCase().includes(lowerQuery);
                }
                return false;
            });
        });
    }
}

export default SearchService;