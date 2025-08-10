# Heap Analytics Setup

## Overview
This application has been configured with Heap Analytics to track user behavior and provide insights into user interactions. The setup handles both anonymous and authenticated users.

## Configuration

### Heap Script
The Heap analytics script is loaded in `app/layout.tsx` with the environment ID `506851683`.

### User Identification

#### Anonymous Users
- Anonymous users are assigned a persistent ID stored in `localStorage` as `heap_anonymous_id`
- The ID format is: `anon_[random_string]_[timestamp]`
- Additional properties tracked:
  - `User Type`: 'anonymous'
  - `Anonymous ID`: The persistent anonymous ID
  - `First Visit`: Timestamp of first visit
  - `Session Count`: Number of sessions

#### Authenticated Users
- Authenticated users are identified with their Supabase user ID
- Additional properties tracked:
  - `Email`: User's email address
  - `User ID`: Supabase user ID
  - `Created At`: Account creation timestamp
  - `Last Sign In`: Last sign-in timestamp
  - `Email Confirmed`: Whether email is confirmed
  - `User Type`: 'authenticated'

## Components

### HeapProvider (`components/analytics/HeapProvider.tsx`)
- Handles user identification for both anonymous and authenticated users
- Automatically creates persistent anonymous IDs
- Tracks session counts and first visit dates
- Manages user properties based on authentication status

### useHeapAnalytics Hook (`hooks/useHeapAnalytics.ts`)
- Provides easy-to-use functions for tracking events
- Automatically includes user ID and user type in all events
- Functions available:
  - `trackEvent(eventName, properties)`: Track custom events
  - `addUserProperties(properties)`: Add user properties
  - `identify(userId)`: Manually identify a user
  - `resetIdentity()`: Reset user identity
  - `getCurrentUserId()`: Get current user ID

## Tracked Events

### Authentication Events
- `Auth Login Attempted`: When user attempts to log in
- `Auth Login Initiated`: When OAuth flow is initiated
- `Auth Login Failed`: When login fails
- `Auth Login Error`: When login encounters an error
- `Auth Sign In Success`: When user successfully signs in
- `Auth Sign Out Success`: When user successfully signs out
- `Auth Logout`: When user manually logs out
- `Auth Skipped`: When user skips authentication

### Analysis Events
- `Capture Started`: When website capture begins
- `Capture Completed`: When website capture completes successfully

### Event Properties
All events automatically include:
- `userId`: Current user ID (anonymous or authenticated)
- `userType`: 'anonymous' or 'authenticated'
- `timestamp`: Event timestamp

## Usage Examples

### Tracking Custom Events
```typescript
import { useHeapAnalytics } from '@/hooks/useHeapAnalytics'

function MyComponent() {
  const { trackEvent } = useHeapAnalytics()
  
  const handleButtonClick = () => {
    trackEvent('Button Clicked', {
      buttonName: 'analyze',
      page: 'dashboard'
    })
  }
}
```

### Adding User Properties
```typescript
import { useHeapAnalytics } from '@/hooks/useHeapAnalytics'

function MyComponent() {
  const { addUserProperties } = useHeapAnalytics()
  
  const updateUserPlan = (plan: string) => {
    addUserProperties({
      'Plan': plan,
      'Plan Updated': new Date().toISOString()
    })
  }
}
```

## Data Privacy
- Anonymous IDs are stored locally and persist across sessions
- No personally identifiable information is sent for anonymous users
- Authenticated users are identified with their Supabase user ID
- All tracking respects user privacy and browser settings

## Testing
- Check browser console for Heap tracking logs
- Look for messages starting with "📊 Heap:" for successful tracking
- Look for messages starting with "❌ Heap:" for errors
- Verify user identification in Heap dashboard 