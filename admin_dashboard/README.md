# Admin Dashboard

A modern, functional React admin dashboard for managing jobs, analytics, and administrative tasks.

## Features

- **Authentication**: Secure login system with JWT tokens
- **Jobs Management**: Create, update, delete, and track job statuses (created, in_progress, paused, completed)
- **Analytics Dashboard**: 
  - Payout summaries by period (week, month, quarter, year)
  - Job stage distribution charts
  - IP performance metrics
- **Admin Controls**: Verify IP users by phone number
- **Responsive Design**: Built with Tailwind CSS for a modern, mobile-friendly UI

## Tech Stack

- React 18 + TypeScript
- Vite
- React Router v6
- TanStack Query (React Query)
- Axios
- Recharts (for analytics charts)
- Tailwind CSS
- Lucide React (icons)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Backend API running on port 8000 (or update `.env` file)

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create a `.env` file in the root directory:

```
VITE_API_BASE_URL=http://localhost:8000
```

## Default Login

Use the credentials created in your backend system to login.

## Available Routes

- `/login` - Authentication page
- `/dashboard` - Main dashboard
- `/dashboard/jobs` - Jobs management
- `/dashboard/analytics` - Analytics and reports
- `/dashboard/admin` - Admin controls

## API Integration

The dashboard integrates with the following backend endpoints:

- **Auth**: `/auth/login`, `/auth/signup`
- **Jobs**: `/jobs/` (CRUD operations + start/pause/finish)
- **Analytics**: `/analytics/payout`, `/analytics/job-stages`, `/analytics/ip-performance`
- **Admin**: `/admin/verify-ip/{phone_number}`

## Features by Page

### Jobs Management
- Create new jobs with all required details
- Edit existing jobs
- Delete jobs
- Start/pause/finish jobs with optional notes
- Filter jobs by status
- Search jobs by name, customer, or city

### Analytics
- View total jobs and payouts for selected period
- Interactive charts showing job distribution
- IP performance metrics table
- Period selection (week, month, quarter, year)

### Admin Controls
- Verify IP users by phone number
- View verification status
- Quick access to admin information

## Development

The project structure:

```
src/
├── api/           # API service layer
├── components/    # Reusable components
├── pages/         # Page components
├── hooks/         # Custom hooks (reserved)
├── types/         # TypeScript types (reserved)
└── utils/         # Utility functions (reserved)
```

## License

MIT

