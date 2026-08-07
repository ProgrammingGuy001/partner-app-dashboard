"""Distance maths for the job-site geofence.

Attendance is never blocked on the result — the check-in paths record how far off
the fix was and whether it landed inside the fence, and leave the decision to
whoever reads the export.
"""

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6371000.0

# Mirrors Job.geofence_radius's ORM-side default. That default only applies to rows
# inserted through the ORM, so jobs predating the geofence migration carry NULL.
DEFAULT_GEOFENCE_RADIUS_M = 100


def distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two WGS84 points, in metres."""
    lat1_r, lat2_r = radians(lat1), radians(lat2)
    d_lat = lat2_r - lat1_r
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(lat1_r) * cos(lat2_r) * sin(d_lon / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def geofence_status(job, latitude: float, longitude: float) -> tuple[float | None, bool | None]:
    """Return (distance_m, within) for a fix against a job's map pin.

    (None, None) when the job has no pin — "not evaluable", deliberately distinct
    from False ("outside"), so the export can tell an unfenced site apart from a
    genuine miss.
    """
    # getattr, not attribute access: callers pass partial job projections, and a job
    # without the columns is "no pin" rather than an error.
    job_lat = getattr(job, "latitude", None)
    job_lon = getattr(job, "longitude", None)
    if job_lat is None or job_lon is None:
        return None, None
    distance = distance_meters(latitude, longitude, job_lat, job_lon)
    radius = getattr(job, "geofence_radius", None) or DEFAULT_GEOFENCE_RADIUS_M
    if radius <= 0:
        radius = DEFAULT_GEOFENCE_RADIUS_M
    return round(distance, 2), distance <= radius


def nearest_job_status(jobs, latitude: float, longitude: float):
    """Match a fix against many sites: (job_id, distance_m, within) for the closest one.

    Supervisors check in without naming a site, so the nearest pin is the only thing
    to measure against. A fix outside every fence still reports the nearest job and
    its distance — "how far off" is the useful number. (None, None, None) when no
    job has a pin at all.
    """
    best = None
    for job in jobs:
        if job.latitude is None or job.longitude is None:
            continue
        distance = distance_meters(latitude, longitude, job.latitude, job.longitude)
        if best is None or distance < best[1]:
            radius = job.geofence_radius or DEFAULT_GEOFENCE_RADIUS_M
            if radius <= 0:
                radius = DEFAULT_GEOFENCE_RADIUS_M
            best = (job.id, distance, distance <= radius)
    if best is None:
        return None, None, None
    return best[0], round(best[1], 2), best[2]
