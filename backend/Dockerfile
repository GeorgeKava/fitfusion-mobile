# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for ChromaDB and other packages
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements-azure.txt requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy chroma_db to a backup location so it can be restored if persistent storage is empty
# This preserves the 2,918 exercises even when Azure File Share mounts at /app/chroma_db
RUN if [ -d /app/chroma_db ]; then \
        cp -r /app/chroma_db /app/chroma_db_image_backup && \
        ls -la /app/chroma_db && \
        echo "✅ ChromaDB backup created with $(ls -1 /app/chroma_db | wc -l) items"; \
    fi

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py
ENV PYTHONPATH=/app

# Create startup script that initializes persistent storage
RUN echo '#!/bin/bash\n\
# Initialize persistent storage with ChromaDB data if needed\n\
# Check if persistent storage is empty or has a tiny database (< 1MB means no exercises)\n\
CHROMA_DB_SIZE=0\n\
if [ -f /app/chroma_db/chroma.sqlite3 ]; then\n\
    CHROMA_DB_SIZE=$(stat -f%z /app/chroma_db/chroma.sqlite3 2>/dev/null || stat -c%s /app/chroma_db/chroma.sqlite3 2>/dev/null || echo 0)\n\
fi\n\
\n\
if [ -d /app/chroma_db_image_backup ] && [ "$CHROMA_DB_SIZE" -lt 1000000 ]; then\n\
    echo "📦 Initializing persistent storage with 2,918 exercises (current size: $CHROMA_DB_SIZE bytes)..."\n\
    rm -rf /app/chroma_db/*\n\
    cp -r /app/chroma_db_image_backup/* /app/chroma_db/\n\
    echo "✅ Persistent storage initialized with $(ls -lh /app/chroma_db/chroma.sqlite3 | awk '\''{print $5}'\'') database"\n\
else\n\
    echo "✅ Persistent storage already initialized ($CHROMA_DB_SIZE bytes)"\n\
fi\n\
# Start gunicorn (HTTP - Cloudflare will handle HTTPS)\n\
exec gunicorn --bind 0.0.0.0:8000 --workers 1 --timeout 600 --access-logfile - --error-logfile - --chdir /app app:app\n\
' > /app/startup.sh && chmod +x /app/startup.sh

# Run startup script
CMD ["/app/startup.sh"]
