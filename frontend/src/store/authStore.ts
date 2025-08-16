/**
 * @file Defines the Zustand store for global authentication state management.
 * This store is the single source of truth for the user's authentication status,
 * user data, loading states, and any related errors.
 */

import { create } from 'zustand';
import { User, LoginCredentials, UserCreate } from '@/types';
import { authService } from '@/services/auth';

/**
 * Defines the shape of the authentication store, including its state and actions.
 */
interface AuthState {
  // --- State Properties ---

  /** The current authenticated user object, or null if not logged in. */
  user: User | null;
  /** A boolean flag indicating if the user is currently authenticated. */
  isAuthenticated: boolean;
  /** A boolean flag that is true during asynchronous operations (e.g., login, register). */
  isLoading: boolean;
  /** Holds an error message string if an action fails, otherwise null. */
  error: string | null;

  // --- Actions ---

  /** Action to log in a user. */
  login: (credentials: LoginCredentials) => Promise<void>;
  /** Action to register a new user. */
  register: (userData: UserCreate) => Promise<void>;
  /** Action to log the current user out. */
  logout: () => Promise<void>;
  /** Action to check and validate the current user's session, typically on app startup. */
  checkAuth: () => Promise<void>;
  /** Action to manually clear any existing error messages. */
  clearError: () => void;
}

/**
 * Creates the authentication store using Zustand.
 * The store encapsulates all state and logic related to user authentication.
 */
export const useAuthStore = create<AuthState>((set) => ({
  // --- Initial State ---
  user: null,
  isAuthenticated: false,
  isLoading: false, // Set to `true` initially if you run `checkAuth` on app load
  error: null,

  // --- Actions Implementation ---

  /**
   * Logs a user in by calling the authService and updates the state accordingly.
   */
  login: async (credentials) => {
    // Set loading state and clear any previous errors.
    set({ isLoading: true, error: null });
    try {
      const user = await authService.login(credentials);
      // On success, update the state with user data and set authenticated flag.
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error: any) {
      // On failure, update the state with an error message.
      // `error.response?.data?.detail` is a common pattern for detailed error messages from FastAPI backends.
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Login failed. Please check your credentials.'
      });
      // Re-throw the error so the UI component can also handle it if needed (e.g., for toast notifications).
      throw error;
    }
  },

  /**
   * Registers a new user and then automatically logs them in on success.
   */
  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      // First, register the new user. The `authService.register` call returns the created user.
      const user = await authService.register(userData);
      // For a better user experience, automatically log the user in after successful registration.
      await authService.login({
        username: userData.username,
        password: userData.password,
      });
      // Update the state to reflect the new, logged-in user.
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Registration failed. Please try again.'
      });
      throw error;
    }
  },

  /**
   * Logs the user out by calling the authService and clearing the local state.
   */
  logout: async () => {
    set({ isLoading: true });
    try {
      // Attempt to log out on the server.
      await authService.logout();
    } catch (error) {
      // Even if the server call fails, we should still clear the client-side session.
      console.error("Server logout failed, but proceeding with client-side logout.", error);
    } finally {
        // Always reset the state to logged-out, regardless of whether the API call succeeded or failed.
        set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
        });
    }
  },

  /**
   * Checks if the user's session is still valid, for example when the application first loads.
   */
  checkAuth: async () => {
    // First, check if a token exists locally. This avoids a pointless API call if there's no token.
    if (!authService.isAuthenticated()) {
      set({ user: null, isAuthenticated: false });
      return;
    }

    set({ isLoading: true });
    try {
      // If a token exists, try to fetch the user's profile to validate it.
      // The Axios interceptor will handle token refresh if needed.
      const user = await authService.getCurrentUser();
      set({
        user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error) {
      // If fetching the user fails (e.g., token is invalid/expired and refresh fails),
      // the user is not authenticated.
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  },

  /**
   * A simple utility action to clear the error state.
   */
  clearError: () => set({ error: null }),
}));