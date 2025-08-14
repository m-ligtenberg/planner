# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a space-themed calendar/planning application called "Space Planner" designed for coordinating time between two users: Gio and Admin. It's a full-stack web application deployed on Railway.

### Architecture

- **Backend**: Express.js server (`server.js`) with RESTful API
- **Frontend**: Vanilla JavaScript SPA with space-themed UI (`public/`)
- **Data Storage**: File-based JSON storage (`data/planner-data.json`)
- **Deployment**: Railway platform with health checks

### Key Components

- **Server (`server.js`)**: Main Express server with comprehensive API endpoints for calendar data management
- **Frontend (`public/app.js`)**: Client-side application with calendar rendering, admin controls, and data synchronization
- **UI (`public/index.html`, `public/style.css`)**: Space-themed interface with multiple screens (opening, calendar, dashboard, admin)

### Data Model

The application manages several data types:
- `unavailableDates`: Admin-set blocked dates
- `gioSelectedDates`: User-selected available dates
- `confirmedPlans`: Finalized meeting plans with details
- `recurringPatterns`: Weekly recurring unavailable periods
- `appleCalendarConnected`: Integration status flag

### API Endpoints

- `/api/health` - Health check for Railway deployment
- `/api/planner-data` - GET/POST for complete data management
- `/api/unavailable-dates` - PUT for admin date blocking
- `/api/gio-selections` - PUT for user date selection
- `/api/confirmed-plans` - POST/DELETE for plan management
- `/api/recurring-patterns` - POST/DELETE for recurring schedules
- `/api/export` - GET data backup
- `/api/import` - POST data restore

## Development Commands

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Install dependencies
npm install
```

## Security Notes

- Admin password is hardcoded in `public/app.js:16` as `ADMIN_PASSWORD = 'spaceman2024'`
- CSP headers are configured in helmet middleware
- CORS is configured for Railway deployment
- File operations use fs-extra for safety

## Railway Deployment

- Health check endpoint: `/api/health`
- Environment variables: `NODE_ENV`, `PORT`, `RAILWAY_PUBLIC_DOMAIN`
- Build command: `npm install`
- Start command: `npm start`
- Data persistence via file system in `data/` directory