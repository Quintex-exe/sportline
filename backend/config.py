import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class APIConfig:
    """API Configuration for FOOTINT Value Tracker"""
    
    # ── FOOTBALL-DATA.ORG API ──────────────────────────────────────────
    FOOTBALL_DATA_API_KEY = os.getenv('FOOTBALL_DATA_API_KEY', 'free-tier')
    FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4'
    FOOTBALL_DATA_RATE_LIMIT = {
        'calls_per_minute': 10,
        'calls_per_day': 100
    }
    
    # ── TRANSFERMARKT API ──────────────────────────────────────────────
    TRANSFERMARKT_API_KEY = os.getenv('TRANSFERMARKT_API_KEY', 'free-tier')
    TRANSFERMARKT_BASE_URL = 'https://transfermarkt-api.vercel.app'
    TRANSFERMARKT_RATE_LIMIT = {
        'calls_per_minute': 60,
        'calls_per_day': 5000
    }
    
    # ── STATSBOMB API ──────────────────────────────────────────────────
    STATSBOMB_API_KEY = os.getenv('STATSBOMB_API_KEY', '')
    STATSBOMB_BASE_URL = 'https://api.statsbomb.com'
    STATSBOMB_RATE_LIMIT = {
        'calls_per_minute': 30,
        'calls_per_day': 1000
    }
    
    # ── SOFASCORE API (no auth needed) ─────────────────────────────────
    SOFASCORE_BASE_URL = 'https://api.sofascore.com'
    SOFASCORE_USER_AGENT = os.getenv('SOFASCORE_USER_AGENT', 
                                      'Mozilla/5.0 (FOOTINT/1.0)')
    SOFASCORE_RATE_LIMIT = {
        'calls_per_minute': 120,
        'calls_per_day': 10000
    }
    
    # ── FEATURE FLAGS ──────────────────────────────────────────────────
    ENABLE_VALUE_TRACKING = os.getenv('ENABLE_VALUE_TRACKING', 'true').lower() == 'true'
    CACHE_EXPIRY_MS = int(os.getenv('CACHE_EXPIRY_MS', '300000'))
    RATE_LIMIT_MODE = os.getenv('RATE_LIMIT_MODE', 'strict')
    DEBUG_VALUE_TRACKER = os.getenv('DEBUG_VALUE_TRACKER', 'false').lower() == 'true'

class FlaskConfig:
    """Flask Server Configuration"""
    
    FLASK_ENV = os.getenv('FLASK_ENV', 'production')
    DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 3000))
    
    # CORS Settings
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')
    
    # SocketIO Settings
    SOCKETIO_ASYNC_MODE = 'threading'
    SOCKETIO_MESSAGE_QUEUE = os.getenv('SOCKETIO_MESSAGE_QUEUE', None)

class CacheConfig:
    """Cache Configuration"""
    
    MAX_FEED_ITEMS = int(os.getenv('MAX_FEED_ITEMS', '500'))
    VALUE_CACHE_TTL = int(os.getenv('VALUE_CACHE_TTL', '300'))  # seconds
    API_RESPONSE_CACHE_TTL = int(os.getenv('API_RESPONSE_CACHE_TTL', '600'))  # seconds

# Export main config
Config = type('Config', (APIConfig, FlaskConfig, CacheConfig), {})

def print_config():
    """Print active configuration (safe - no secrets)"""
    print("\n" + "="*60)
    print("FOOTINT VALUE TRACKER CONFIGURATION")
    print("="*60)
    print(f"Environment: {FlaskConfig.FLASK_ENV}")
    print(f"Debug Mode: {FlaskConfig.DEBUG}")
    print(f"Value Tracking: {APIConfig.ENABLE_VALUE_TRACKING}")
    print(f"Cache TTL: {CacheConfig.VALUE_CACHE_TTL}s")
    print(f"Rate Limit Mode: {APIConfig.RATE_LIMIT_MODE}")
    print(f"Football-Data API: {'✓ Configured' if APIConfig.FOOTBALL_DATA_API_KEY else '✗ Not configured'}")
    print(f"Sofascore API: ✓ Always Available")
    print(f"Transfermarkt API: ✓ Always Available")
    print("="*60 + "\n")

if __name__ == '__main__':
    print_config()
