You are my senior software engineer and technical lead. We are building this project together over many iterations. Your goal is to create a production-quality personal application, not just make it work.

# Project Overview

We are building a personal travel tracking web application called "Waypoint" (temporary name).

This application is only for me. It is not a SaaS product and does not need multiple users.

There should be:
- no user accounts
- no authentication
- no login system
- no user management

The application is a private travel journal that allows me to record road trips, visualize routes on maps, track kilometers driven, and generate beautiful Instagram-ready travel maps.

The application should work perfectly on both:
- desktop/laptop
- iPhone

It should be installable as a Progressive Web App (PWA), making it feel like a native mobile application.

The codebase should be clean, scalable, and maintainable.

---

# Tech Stack

Use modern technologies.

## Frontend

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion

## Data Storage

This is a single-user application.

Use:
- Supabase PostgreSQL as the cloud database

Do NOT implement:
- authentication
- users
- profiles
- permissions

The database should simply store my personal travel data.

The reason for using Supabase is:
- access from both iPhone and laptop
- reliable cloud storage
- easy backups
- compatibility with Vercel deployment

## Maps

Use:

- MapLibre GL
- OpenStreetMap

Do not use Google Maps APIs.

## Routing

Use an OpenStreetMap-compatible routing engine capable of calculating real driving routes.

Possible options:
- OSRM
- GraphHopper
- Valhalla

The routing system must support:
- realistic road distances
- route geometry
- driving directions
- toll road preferences

## Deployment

Use:

- GitHub
- Vercel

---

# Development Principles

Follow professional software engineering practices.

Use:

- reusable components
- clean folder structure
- TypeScript everywhere
- strict typing
- modular architecture
- maintainable code
- clear naming conventions

Always explain important architectural decisions before implementing them.

Do not generate large amounts of code without explaining what you are creating.

Build incrementally.

---

# UI / UX Design

The application should feel like a premium consumer product.

Design inspiration:

- Apple
- Airbnb
- Notion

Requirements:

- modern minimal interface
- beautiful typography
- smooth animations
- rounded cards
- dark mode
- light mode
- responsive design
- mobile-first approach

The application should feel polished on iPhone.

---

# Database Structure

Create a clean database schema.

Entities:

## Trips

Fields:

- id
- title
- description
- start date
- end date
- cover image
- created date
- total kilometers driven
- route preference

## Locations

Fields:

- id
- trip id
- name
- latitude
- longitude
- country
- city
- arrival date
- departure date
- notes
- order number

Locations must preserve the order in which they were visited.

Example:

Belgium
↓
Paris
↓
Lyon
↓
Barcelona

## Route Data

Store:

- calculated distance
- route geometry
- routing options
- whether toll roads were allowed
- last calculated timestamp

---

# Main Features

## Dashboard

Display:

- countries visited
- cities visited
- number of trips
- number of locations
- total kilometers driven
- longest road trip
- latest trip

---

# Trip Management

I should be able to:

- create trips
- edit trips
- delete trips
- add locations
- remove locations
- reorder locations

Each trip represents a journey.

Example:

Summer Roadtrip 2026

Antwerp
→
Paris
→
Barcelona
→
Nice

---

# Location Management

I should be able to:

- search locations
- add locations to trips
- view them on the map
- add notes
- upload photos

Use OpenStreetMap geocoding.

---

# Map Features

Create an interactive map.

Requirements:

- world map
- markers for visited locations
- route lines connecting locations
- zoom controls
- smooth animations
- trip-specific colors
- clickable markers

Clicking a location should show:

- location name
- date visited
- trip information
- notes

---

# Kilometers Driven

This is one of the core features.

The application must track actual kilometers driven, not straight-line distance.

For every trip:

Example:

Antwerp
↓
Paris
↓
Lyon
↓
Barcelona

Calculate:

Antwerp → Paris distance

+

Paris → Lyon distance

+

Lyon → Barcelona distance

=

Total kilometers driven

The distance should be based on actual road routes.

---

# Toll Road Options

When creating or editing a trip, I should be able to choose:

## Route preference

Options:

1. Allow toll roads
2. Avoid toll roads

The selected option must influence:

- calculated route
- displayed map route
- total kilometers driven

Store this preference with every trip.

Example:

France roadtrip

Route preference:
Avoid toll roads

The app recalculates the route accordingly.

---

# Statistics

Display:

- total kilometers driven
- kilometers per year
- kilometers per trip
- longest road trip
- average trip length
- countries visited
- cities visited

---

# Instagram Map Export

Create a feature to export beautiful travel maps.

Supported formats:

- 1080 × 1350 Instagram portrait
- 1080 × 1920 Instagram story

Export:

- high-resolution PNG

Customization:

- dark theme
- light theme
- route colors
- markers
- trip title
- kilometers driven
- dates

The output should look like a professional travel graphic.

---

# Progressive Web App

The application should:

- install on iPhone
- have an app icon
- work with mobile gestures
- load quickly
- have responsive layouts

---

# Development Workflow

Build the project in milestones.

Never implement everything at once.

For every milestone:

1. Explain the plan
2. Explain the architecture
3. Implement the feature
4. Run tests
5. Fix errors
6. Commit changes

Keep Git history clean with meaningful commit messages.

---

# Git Workflow

Initialize Git.

Create commits regularly.

Push changes to GitHub when appropriate.

---

# First Task

Start by creating the project.

Set up:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase connection
- MapLibre
- ESLint
- Prettier
- Husky
- PWA configuration

Create the folder structure.

Create the database schema.

Create a beautiful landing page/dashboard skeleton.

Do not continue to the next milestone until this foundation is working correctly.