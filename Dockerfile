# Use the latest Node.js runtime as a parent image
FROM node:alpine

# Set the working directory
WORKDIR /usr/src/app

# Install Docker CLI and dependencies
RUN apk add --no-cache \
    curl \
    py-pip \
    python3-dev \
    libffi-dev \
    openssl-dev \
    gcc \
    libc-dev \
    make \
    bash \
    docker-cli \
    smartmontools

RUN apk add --no-cache \
    wget \
    bash \
    tar \
    build-base \
    gcc \
    g++ \
    make \
    linux-headers

# Set SnapRAID version to "latest"
ENV SNAPRAID_VERSION=latest

# Download, extract, and install SnapRAID
RUN wget -qO- https://api.github.com/repos/amadvance/snapraid/releases/${SNAPRAID_VERSION} \
    | grep "browser_download_url.*tar.gz" \
    | cut -d '"' -f 4 \
    | wget -i - -O snapraid.tar.gz \
    && tar -xzf snapraid.tar.gz \
    && cd snapraid-* \
    && ./configure \
    && make \
    && make install \
    && cd .. \
    && rm -rf snapraid.tar.gz snapraid-*

# Copy package.json and package-lock.json
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

VOLUME /mnt /config

# Run the script
CMD ["node", "dist/index.js"]
