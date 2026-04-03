FROM python:3.12-slim

LABEL maintainer="AtlasOps"
LABEL description="Python sandbox for AtlasOps recovery validation"

WORKDIR /app

# Pre-install common test tools
RUN pip install --no-cache-dir pytest flake8 pylint 2>/dev/null || true

CMD ["python", "--version"]
