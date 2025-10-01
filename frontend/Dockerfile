# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS build
WORKDIR /app

# Allow overriding API URL and other frontend build-time values
ARG VITE_API_URL=/api/v1
ARG VITE_APP_NAME=Eleva
ARG VITE_APP_VERSION=1.0.0
ARG VITE_ENABLE_PROFILE_UPLOAD=true
ARG VITE_ENABLE_AI_FEATURES=false

# Expose the values to the Vite build
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_APP_NAME=${VITE_APP_NAME} \
    VITE_APP_VERSION=${VITE_APP_VERSION} \
    VITE_ENABLE_PROFILE_UPLOAD=${VITE_ENABLE_PROFILE_UPLOAD} \
    VITE_ENABLE_AI_FEATURES=${VITE_ENABLE_AI_FEATURES}

# Install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --loglevel error

# Copy the remaining source files
COPY frontend .

# Build the production-ready static assets
RUN npm run build

# ----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Copy custom Nginx configuration for SPA + API proxying
COPY frontend/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
