// Client-side watchlist management using localStorage
class WatchlistStorage {
    static STORAGE_KEY = 'trading_watchlist';
    static DEFAULT_STOCKS = ['TAPICO', 'FOOLAD', 'SAIPA', 'IKCO', 'SHEPASAND'];

    // Get watchlist from localStorage
    static getWatchlist() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return Array.isArray(parsed) ? parsed : this.DEFAULT_STOCKS;
            }
            return this.DEFAULT_STOCKS;
        } catch (error) {
            console.error('Error reading watchlist from localStorage:', error);
            return this.DEFAULT_STOCKS;
        }
    }

    // Save watchlist to localStorage
    static saveWatchlist(symbols) {
        try {
            if (!Array.isArray(symbols)) {
                throw new Error('Watchlist must be an array');
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(symbols));
            return true;
        } catch (error) {
            console.error('Error saving watchlist to localStorage:', error);
            return false;
        }
    }

    // Add symbol to watchlist
    static addToWatchlist(symbol) {
        try {
            const currentList = this.getWatchlist();
            if (!currentList.includes(symbol)) {
                const newList = [...currentList, symbol];
                return this.saveWatchlist(newList);
            }
            return true; // Already exists
        } catch (error) {
            console.error('Error adding to watchlist:', error);
            return false;
        }
    }

    // Remove symbol from watchlist
    static removeFromWatchlist(symbol) {
        try {
            const currentList = this.getWatchlist();
            const newList = currentList.filter(s => s !== symbol);
            return this.saveWatchlist(newList);
        } catch (error) {
            console.error('Error removing from watchlist:', error);
            return false;
        }
    }

    // Check if symbol is in watchlist
    static isInWatchlist(symbol) {
        const watchlist = this.getWatchlist();
        return watchlist.includes(symbol);
    }

    // Clear watchlist
    static clearWatchlist() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Error clearing watchlist:', error);
            return false;
        }
    }

    // Reset to default watchlist
    static resetToDefault() {
        return this.saveWatchlist(this.DEFAULT_STOCKS);
    }
}

export default WatchlistStorage;