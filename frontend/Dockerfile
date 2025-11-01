FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set build-time environment variables
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Optional: Quick links for header
ARG VITE_DEMO_VIDEO_URL
ENV VITE_DEMO_VIDEO_URL=$VITE_DEMO_VIDEO_URL

ARG VITE_REPO_URL
ENV VITE_REPO_URL=$VITE_REPO_URL

ARG VITE_ARCH_URL
ENV VITE_ARCH_URL=$VITE_ARCH_URL

ARG VITE_AI_STUDIO_URL
ENV VITE_AI_STUDIO_URL=$VITE_AI_STUDIO_URL

# Build the app
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
