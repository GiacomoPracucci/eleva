Authentication Flow Architecture
================================

This document outlines the architecture for handling JWT-based authentication in this application. It is designed to be robust, maintainable, and provide a smooth user experience by transparently managing user sessions and tokens.

* * * * *

## Core Concepts
----------------

Our architecture is built on several key concepts:

-   **JWT (Access & Refresh Tokens)**: We use a standard two-token system. The **Access Token** is short-lived and used to authenticate API requests. The **Refresh Token** is long-lived and is used to securely obtain a new access token when the old one expires, without forcing the user to log in again.

-   **Axios Interceptors**: These are functions that Axios runs before a request is sent or after a response is received. We use them to **automatically attach** the access token to every outgoing request and to **transparently handle** token refreshes when the API returns a `401 Unauthorized` error.

-   **Service Pattern**: We abstract all direct API communication into a dedicated `AuthService`. This separates our business logic (e.g., "logging a user in") from the implementation details of making HTTP requests. It makes the code cleaner and easier to test.

-   **Global State Management (Zustand)**: We use a Zustand store as a **single source of truth** for the application's authentication state (`user`, `isAuthenticated`, `isLoading`, `error`). This allows any component to access and react to changes in the user's session state without prop drilling.

-   **Route Protection**: We use wrapper components (`ProtectedRoute`, `PublicRoute`) to protect parts of the application. This ensures that only authenticated users can access private pages and that already-logged-in users are redirected away from public pages like the login form.

* * * * *

## Architecture Layers & Collaboration
--------------------------------------

The system is designed in four distinct layers, each with a clear responsibility. They collaborate in a top-down fashion, from the UI to the API.

#### 1. UI Layer (`ProtectedRoute`, `AuthProvider`, etc.)

-   **Responsibility**: To render the UI based on the authentication state and to protect routes.

-   **How it works**: These React components consume the state from the Zustand store via the `useAuth` hook. They do not contain any business logic themselves; they only dispatch actions (like `login()` or `logout()`) to the store.

#### 2. State Management Layer (`store/authStore.ts`)

-   **Responsibility**: To hold the global authentication state and manage state transitions. It acts as the "brain" of the client-side authentication.

-   **How it works**: This Zustand store exposes actions (`login`, `register`, `checkAuth`). When an action is called from the UI, the store calls the appropriate method in the `AuthService` and updates its own state (`isLoading`, `user`, `error`) based on the outcome of that call.

#### 3. Service Layer (`services/auth.ts`)

-   **Responsibility**: To encapsulate and define all authentication-related business logic.

-   **How it works**: The `AuthService` provides a clean API (e.g., `authService.login(credentials)`). It knows *how* to perform actions by calling the low-level API layer. For example, the `login` method knows that it needs to format the data as `form-urlencoded` before sending it.

#### 4. API Layer (`api.ts`)

-   **Responsibility**: To handle all raw HTTP communication with the backend.

-   **How it works**: This configured Axios instance is the foundation. Its interceptors automatically handle the mechanical parts of token management (attaching the bearer token and refreshing it). The rest of the application doesn't need to know about tokens; it just makes API calls through this instance.

* * * * *

## Key Workflows in Action
--------------------------

Understanding how the layers interact is best done through common user scenarios.

#### Application Load & Session Check

1.  The `AuthProvider` component mounts when the app loads.

2.  Its `useEffect` hook calls the `checkAuth()` action from the `useAuthStore`.

3.  `checkAuth()` checks if a token exists locally. If so, it calls `authService.getCurrentUser()`.

4.  `authService.getCurrentUser()` makes a `GET` request to `/users/me` using the `api` instance.

5.  The Axios request interceptor automatically adds the `Authorization: Bearer <token>` header.

6.  If the request is successful, the user data is returned, and the Zustand store updates its state: `isAuthenticated: true`, `user: {...}`. The UI reacts and shows the authenticated app state.

#### User Login

1.  A user fills out the login form and clicks "Submit".

2.  The login component calls the `login(credentials)` action from `useAuthStore`.

3.  The store sets `isLoading: true` and calls `authService.login(credentials)`.

4.  `authService` creates the `form-urlencoded` data and calls `api.post('/auth/login', ...)`.

5.  The backend validates the credentials and returns new access and refresh tokens.

6.  `authService` receives the tokens and calls `tokenManager.setTokens()` to save them in `localStorage`. Then it fetches the user profile.

7.  The user object is returned to the store, which updates its state: `isAuthenticated: true`, `user: {...}`, `isLoading: false`.

8.  The UI, subscribed to the store, automatically re-renders to show the protected part of the application.

#### Automatic Token Refresh (The Magic ✨)

1.  A user performs an action that triggers an API call (e.g., fetching data).

2.  The Axios request interceptor attaches the access token, but it has expired.

3.  The backend responds with a `401 Unauthorized` error.

4.  The Axios **response interceptor** catches this specific error.

5.  It pauses the original request and sends a new request to `/auth/refresh` using the refresh token.

6.  The backend validates the refresh token and issues a new pair of access/refresh tokens.

7.  The interceptor saves these new tokens using `tokenManager.setTokens()`.

8.  Finally, it **re-tries the original request** with the new access token.

9.  This time, the request succeeds. The user never knew anything happened.