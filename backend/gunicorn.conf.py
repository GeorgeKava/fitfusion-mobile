# Gunicorn Configuration for Production
# File: gunicorn.conf.py
# Usage: gunicorn -c gunicorn.conf.py app:app

import multiprocessing
import os

# Server Socket
bind = f"0.0.0.0:{os.getenv('PORT', '5001')}"
backlog = 2048

# Worker Processes
workers = multiprocessing.cpu_count() * 2 + 1  # Recommended formula
worker_class = 'gevent'  # Async worker for better performance with I/O-bound tasks
worker_connections = 1000
max_requests = 1000  # Restart workers after 1000 requests to prevent memory leaks
max_requests_jitter = 50  # Add randomness to prevent all workers restarting simultaneously
timeout = 120  # Increased timeout for AI/ML operations
keepalive = 5

# Server Mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# Logging
accesslog = '-'  # Log to stdout
errorlog = '-'  # Log to stderr
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = 'fitfusion-api'

# Security
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190

# Server hooks
def on_starting(server):
    """Called just before the master process is initialized."""
    print("🚀 Gunicorn server starting...")

def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    print("🔄 Gunicorn server reloading...")

def when_ready(server):
    """Called just after the server is started."""
    print(f"✅ Gunicorn server ready! Workers: {workers}")

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    pass

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    print(f"👷 Worker {worker.pid} spawned")

def pre_exec(server):
    """Called just before a new master process is forked."""
    print("🔄 Forking new master process...")

def worker_exit(server, worker):
    """Called just after a worker has been exited."""
    print(f"👋 Worker {worker.pid} exited")
