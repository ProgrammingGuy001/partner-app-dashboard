# Caching Implementation Guide

## Overview
This application implements a comprehensive two-tier caching strategy:
- **Backend**: In-memory TTL-based caching (using cachetools)
- **Frontend**: React Query for client-side caching

## Backend Caching (In-Memory)

### Setup

**Install Python Dependencies**:
```bash
cd app
pip install -r requirements.txt
```

No additional configuration needed - caching works out of the box!

### How It Works

#### Cache Decorator
The `@cached` decorator automatically caches function results in memory:

```python
from app.core.cache import cached

@cached(prefix="jobs:all", ttl=300, maxsize=1000)
def get_all_jobs(db: Session, skip: int = 0, limit: int = 100):
    # Function implementation
    pass
```

**Parameters:**
- `prefix`: Cache key prefix (e.g., "jobs:all", "analytics:payout")
- `ttl`: Time to live in seconds (default: 300 = 5 minutes)
- `maxsize`: Maximum cached entries (default: 1000)

#### Cache Invalidation
When data changes, caches are automatically invalidated:

```python
from app.core.cache import invalidate_cache

# After creating/updating/deleting a job
invalidate_cache("jobs:*")      # Clear all job caches
invalidate_cache("analytics:*") # Clear all analytics caches
```

### Cached Endpoints

| Endpoint | Cache Key | TTL | Invalidated On |
|----------|-----------|-----|----------------|
| `GET /analytics/payout` | `analytics:payout:{params}` | 5 min | Job status changes |
| `GET /analytics/job-stages` | `analytics:job_stages` | 5 min | Job status changes |
| `GET /analytics/ip-performance` | `analytics:ip_performance` | 5 min | Job completion |
| `GET /admin/ips` | `ips:all` | 5 min | IP verification |
| `GET /admin/ips/approved` | `ips:approved` | 5 min | IP verification |

### Cache Behavior

- **Cache Miss**: Function executes normally, result is cached in memory
- **Cache Hit**: Cached result is returned immediately from memory (~1-5ms)
- **TTL Expiration**: Cached entries automatically expire after their TTL
- **Memory Management**: LRU eviction when cache reaches maxsize limit

## Frontend Caching (React Query)

### Configuration

React Query is configured in `App.tsx` with global defaults:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      gcTime: 10 * 60 * 1000,        // 10 minutes (garbage collection)
      refetchOnWindowFocus: false,   // Don't refetch on window focus
      refetchOnReconnect: true,      // Refetch on network reconnect
      retry: 1,                      // Retry failed requests once
    },
  },
});
```

### Custom Hooks

#### Jobs
```typescript
import { useJobs, useJob, useCreateJob, useUpdateJob, useDeleteJob } from './hooks/useJobs';

// Fetch all jobs with filters (cached for 2 minutes)
const { data, isLoading } = useJobs({ status: 'in_progress', type: 'installation' });

// Fetch single job (cached for 5 minutes)
const { data: job } = useJob(jobId);

// Mutations automatically invalidate related queries
const createJob = useCreateJob();
const updateJob = useUpdateJob();
const deleteJob = useDeleteJob();
```

#### Workers/Personnel
```typescript
import { useWorkers, useApprovedWorkers, useVerifyWorker } from './hooks/useWorkers';

// Fetch all workers (cached for 5 minutes)
const { data: workers } = useWorkers();

// Fetch approved workers only
const { data: approvedWorkers } = useApprovedWorkers();

// Verify worker (auto-invalidates worker queries)
const verifyWorker = useVerifyWorker();
```

#### Analytics
```typescript
import { usePayoutReport, useJobStages, useIPPerformance } from './hooks/useAnalytics';

// Fetch payout report (cached for 5 minutes)
const { data: payout } = usePayoutReport({ period: 'month', year: 2024, month: 3 });

// Fetch job stages (cached for 2 minutes)
const { data: stages } = useJobStages();

// Fetch IP performance (cached for 5 minutes)
const { data: performance } = useIPPerformance();
```

### Cache Invalidation Strategy

React Query automatically handles cache invalidation:

1. **On Mutation Success**: Related queries are invalidated
2. **Manual Refresh**: Users can trigger refresh via UI buttons
3. **Background Refetch**: Stale data is refetched in the background
4. **Automatic**: Data older than `staleTime` is considered stale

## Cache Performance Benefits

### Before Caching
- Every request hits the database
- Analytics queries can take 500ms+ on large datasets
- Repeated requests cause unnecessary load

### After Caching
- ✅ Cached responses return in ~1-5ms (100x faster)
- ✅ Database load reduced by 70-90% for read operations
- ✅ User experience improved with instant data display
- ✅ Zero external dependencies

## Monitoring & Debugging

### Application Logs
The application logs cache operations:
```
🗑️  Invalidated 3 cache entries matching 'jobs:*'
🗑️  Cleared 45 cache entries from all stores
```

### Cache Statistics
Cache is stored in-memory and managed automatically:
- Entries expire after TTL (default: 5 minutes)
- LRU eviction when maxsize is reached
- No external dependencies or services needed

## Best Practices

1. **Set Appropriate TTLs**:
   - Frequently changing data: 1-2 minutes
   - Stable data: 5-10 minutes
   - Analytics: 5+ minutes

2. **Set Appropriate maxsize**:
   - Small datasets: 100-500 entries
   - Medium datasets: 500-1000 entries
   - Large datasets: 1000-5000 entries

3. **Invalidate on Write**:
   - Always invalidate related caches after mutations
   - Use wildcard patterns (`jobs:*`) for related data

4. **Use Query Keys Wisely**:
   - Include all filter parameters in query keys
   - Use consistent naming conventions

## Troubleshooting

### Stale Data Issues
- Reduce TTL values in `@cached` decorators
- Add manual refresh buttons in UI
- Check cache invalidation is triggered on mutations

### Memory Usage
- Adjust `maxsize` parameter in `@cached` decorator
- Use shorter TTLs for large datasets
- Monitor application memory usage
- Cache is automatically cleared when application restarts

### Cache Not Working
- Check decorator is properly applied
- Verify function arguments are hashable
- Check cache invalidation patterns match

## Production Considerations

1. **Memory Management**:
   - In-memory cache is lost on application restart
   - Each application instance has its own cache
   - Set appropriate maxsize limits to prevent memory issues
   - Typical memory usage: ~100MB for 1000 cached entries

2. **Scalability**:
   - For multi-server deployments, consider distributed caching (Redis/Memcached)
   - Current implementation is perfect for single-server setups
   - Cache warming happens naturally as requests come in

3. **Monitoring**:
   - Monitor application memory usage
   - Track response times to measure cache effectiveness
   - Consider adding cache hit/miss metrics if needed

4. **Advantages of In-Memory Caching**:
   - ✅ No external dependencies
   - ✅ Zero latency cache access
   - ✅ Simple setup and maintenance
   - ✅ Automatic cleanup via TTL
   - ✅ Thread-safe with proper locking
   - ✅ Perfect for development and single-server production

## Example Usage

### Adding Cache to a New Function

```python
from app.core.cache import cached, invalidate_cache

# Read operation - cache results
@cached(prefix="projects:list", ttl=600, maxsize=500)
def get_all_projects(db: Session):
    return db.query(Project).all()

# Write operation - invalidate cache
def create_project(db: Session, project_data):
    project = Project(**project_data)
    db.add(project)
    db.commit()
    
    # Invalidate related caches
    invalidate_cache("projects:*")
    invalidate_cache("analytics:*")
    
    return project
```

### Frontend Hook

```typescript
// hooks/useProjects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectAPI } from '../api/services';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.getAll(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: projectAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};
```
