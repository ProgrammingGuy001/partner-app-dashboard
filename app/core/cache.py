from functools import wraps, lru_cache
from typing import Any, Callable
from cachetools import TTLCache
import hashlib
import json

# In-memory cache stores with TTL
_cache_stores = {}

def get_cache_store(prefix: str, ttl: int, maxsize: int = 1000):
    """Get or create a TTL cache store for a specific prefix"""
    key = f"{prefix}:{ttl}"
    if key not in _cache_stores:
        _cache_stores[key] = TTLCache(maxsize=maxsize, ttl=ttl)
    return _cache_stores[key]

def make_cache_key(*args, **kwargs) -> str:
    """Generate cache key from function arguments"""
    # Skip first arg (db Session) and create a hashable key
    key_parts = []
    for arg in args[1:]:  # Skip db Session
        if hasattr(arg, '__dict__'):
            continue  # Skip complex objects
        key_parts.append(str(arg))
    
    for k, v in sorted(kwargs.items()):
        if v is not None and not hasattr(v, '__dict__'):
            key_parts.append(f"{k}={v}")
    
    key_string = ":".join(key_parts)
    # Hash long keys to keep them manageable
    if len(key_string) > 100:
        return hashlib.md5(key_string.encode()).hexdigest()
    return key_string

def cached(prefix: str, ttl: int = 300, maxsize: int = 1000):
    """
    Decorator for caching function results in memory with TTL
    
    Args:
        prefix: Cache key prefix
        ttl: Time to live in seconds (default: 300 = 5 minutes)
        maxsize: Maximum number of cached items (default: 1000)
    """
    def decorator(func: Callable) -> Callable:
        cache_store = get_cache_store(prefix, ttl, maxsize)
        
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # Generate cache key
            cache_key = make_cache_key(*args, **kwargs)
            full_key = f"{prefix}:{cache_key}" if cache_key else prefix
            
            try:
                # Try to get from cache
                if full_key in cache_store:
                    return cache_store[full_key]
                
                # Execute function and cache result
                result = func(*args, **kwargs)
                cache_store[full_key] = result
                return result
                
            except Exception as e:
                print(f"Cache error: {e}")
                return func(*args, **kwargs)
        
        wrapper.cache_store = cache_store
        return wrapper
    return decorator

def invalidate_cache(pattern: str):
    """Delete all cache entries matching pattern (supports wildcards)"""
    try:
        count = 0
        for store_key, cache_store in _cache_stores.items():
            keys_to_delete = []
            
            # Handle wildcard patterns
            if pattern.endswith("*"):
                prefix_match = pattern[:-1]
                for key in list(cache_store.keys()):
                    if key.startswith(prefix_match):
                        keys_to_delete.append(key)
            else:
                if pattern in cache_store:
                    keys_to_delete.append(pattern)
            
            # Delete matching keys
            for key in keys_to_delete:
                del cache_store[key]
                count += 1
        
        if count > 0:
            print(f"🗑️  Invalidated {count} cache entries matching '{pattern}'")
    except Exception as e:
        print(f"Cache invalidation error: {e}")

def clear_all_cache():
    """Clear all cache stores"""
    try:
        total_cleared = sum(len(store) for store in _cache_stores.values())
        for cache_store in _cache_stores.values():
            cache_store.clear()
        print(f"🗑️  Cleared {total_cleared} cache entries from all stores")
    except Exception as e:
        print(f"Cache clear error: {e}")
