# Tubely - TypeScript File Server

An educational project for learning large file storage and management in web applications. This project demonstrates how to handle video files, thumbnails, and other large assets using TypeScript and modern file storage techniques.

## About

Tubely is a file management application that helps users manage their video assets. It allows you to upload, store, serve, and add metadata to video files while also managing thumbnails and other video metadata. This project teaches the fundamentals of handling large files in web applications, from local filesystem storage to cloud-based solutions.

## Technologies

- **TypeScript** - Type-safe JavaScript for better development experience
- **Bun** - Fast JavaScript runtime and package manager
- **SQLite** - Lightweight database for metadata storage
- **FFMPEG** - Video processing and thumbnail generation

## Getting Started

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Setup

Copy the environment example file:

```bash
cp .env.example .env
```

### 3. Run the Application

```bash
bun run src/index.ts
```

The server will start and display a URL in the console. Open this URL in your browser to access the Tubely application.

## What You'll Learn

- Understanding the difference between "large" files and small structured data
- Local filesystem management for file storage
- Video streaming and performance optimization
- File upload and processing workflows
- Metadata management for media files
- Thumbnail generation and serving

## Database

The application automatically generates a SQLite database called `tubely.db` in the root directory when you first run the server. This database stores all structured data including user accounts, video metadata, and other application data.

## Caching

The application uses HTTP caching headers to control how browsers cache static assets like thumbnails and videos. The `noCacheMiddleware` sets the following header on all assets served from the `/assets` directory:

- `Cache-Control: no-store` - Tells the browser not to cache the resource at all. The browser must fetch the resource from the server every time.

### Common Cache-Control Values

- **`no-store`**: Don't cache this resource at all. Always fetch fresh from the server.
- **`no-cache`**: Cache the resource, but always revalidate with the server before using it. Despite the name, it does allow caching!
- **`max-age=3600`**: Cache this resource for 1 hour (3600 seconds) without checking the server.
- **`stale-while-revalidate`**: Serve stale content immediately while fetching a fresh copy in the background.

For dynamic content like user-uploaded thumbnails that may change frequently, `no-store` ensures users always see the latest version immediately after uploading.

## Project Structure

- `src/` - Main application source code
- `src/api/` - API endpoints for file operations
- `src/db/` - Database models and operations
- `src/app/` - Frontend application files
- `assets/` - Local file storage directory (created on first run)
- `tubely.db` - SQLite database file (created on first run)