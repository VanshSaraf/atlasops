FROM node:20-alpine

LABEL maintainer="AtlasOps"
LABEL description="Node.js sandbox for AtlasOps recovery validation"

WORKDIR /app

CMD ["node", "--version"]
