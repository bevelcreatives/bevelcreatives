import sys
import os

# Make the Website root importable so 'admin' package resolves
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from admin.app import wsgi_app as app  # noqa: E402  (Vercel looks for 'app')
