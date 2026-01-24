
# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/code

# Set work directory
WORKDIR /code

# Install system dependencies (gcc might be needed for some python packages)
RUN apt-get update && apt-get install -y --no-install-recommends gcc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt /code/
RUN pip install --no-cache-dir -r requirements.txt

# Copy project resources into 'app' directory to maintain package structure
COPY . /code/app/

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]