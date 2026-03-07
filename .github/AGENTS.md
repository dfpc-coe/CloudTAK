# Project Guidelines

This project uses Vue 3 with a Bootstrap Theme called Tabler. The agent must follow strict TypeScript conventions
and always avoid the use of `any` type. The project is structured to promote modularity and maintainability, with a clear separation of concerns between components, features, and utilities.

## Directories

*   `api/` - Backend API Server
*   `api/web/` - Contains Frontend Vue3 components
*   `tasks/pmtiles` - Contains PMTiles Server
*   `tasks/events` - Contains Event handling server

## Commands

*   `npm install` - Install project dependencies.
*   `npm run lint` - Run ESLint checks.
*   `npm run check` - Run TypeScript type checks.

## Testing

The user usually runs a dev server for development and testing, if you are getting 401 errors when trying to run tests, 
this is likely due to the dev server running. If this is the case, prompt the user to ensure it is shut down before running tests.
