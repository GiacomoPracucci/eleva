/**
 * @file This file defines the AuthService, a centralized service for handling
 * all authentication-related operations such as login, logout, registration,
 * and user session management.
 */

import api, { tokenManager } from './api';
import { User, UserCreate, Token, LoginCredentials, PasswordResetRequest } from '@/types';

/**
 * A service class to encapsulate all authentication-related API calls and logic.
 * This keeps the components clean and separates concerns.
 */
class AuthService {

    /**
     * Logs in a user with the provided credentials.
     * @param credentials - The user's username and password.
     * @returns A Promise that resolves to the authenticated user's data.
     */
    async login(credentials: LoginCredentials): Promise<User> {
        // FastAPI's standard OAuth2 login endpoint expects data in a form-data format,
        // not JSON. URLSearchParams is the standard web API to create this format.
        const formData = new URLSearchParams();
        formData.append('username', credentials.username);
        formData.append('password', credentials.password);

        // Make the POST request to the login endpoint.
        const { data: tokens } = await api.post<Token>('/auth/login', formData, {
            headers: {
                // We must explicitly set the Content-Type header for the server to understand the request.
                'Content-Type': 'application/x-www-form-urlencoded'
            },
        });
        // If login is successful, store the received tokens.
        tokenManager.setTokens(tokens);

        // After setting the tokens, fetch the full user profile.
        // The request interceptor in `api.ts` will now automatically add the new token.
        const user = await this.getCurrentUser();
        return user;
    }


    /**
     * Registers a new user with the provided data.
     * @param userData - The data for the new user account.
     * @returns A Promise that resolves to the newly created user's data.
     */
    async register(userData: UserCreate): Promise<User> {
        const { data } = await api.post<User>('/auth/register', userData);
        return data;
    }

    /**
     * Logs the current user out.
     * It attempts to notify the backend and clears local tokens regardless of the outcome.
     */
    async logout(): Promise<void> {
        try {
            // It's good practice to inform the backend about the logout,
            // allowing it to invalidate the refresh token if needed.
            await api.post('/auth/logout');
        } catch (error) {
            // If the API call fails, we still want to log the user out on the client side.
            // We can log the error for debugging purposes but shouldn't block the logout.
            console.error('Logour error: ', error);
        } finally {
            // The `finally` block ensures that tokens are always cleared,
            // whether the `try` block succeeded or failed. This is crucial for a secure logout.
            tokenManager.clearTokens();
        }
    }

    /**
     * Fetches the profile data of the currently authenticated user.
     * @returns A Promise that resolves to the current user's data.
     */
    async getCurrentUser(): Promise<User> {
        // This request will have the 'Authorization' header automatically attached by the Axios interceptor.
        const { data } = await api.get<User>('/users/me');
        return data;
    }

    /**
     * Checks if a user is currently authenticated on the client side.
     * @returns `true` if an access token exists, otherwise `false`.
     */
    isAuthenticated(): boolean {
        // The double bang (!!) is a concise way to convert a value to a boolean.
        // If `getToken()` returns a token (a truthy string), !!'some_token' becomes true.
        // If it returns `null` (falsy), !!null becomes false.
        return !!tokenManager.getToken();
    }

    /**
     * Sends a request to the server to initiate a password reset process for a user.
     * @param data - An object containing the user's email.
     */
    async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
        // TODO: This endpoint is a placeholder and needs to be implemented in the backend.  
        await api.post('/auth/password-reset', data);
    }


    /**
     * Manually refreshes the access token using the stored refresh token.
     * NOTE: This is often not needed if the Axios response interceptor is already handling
     * automatic token refreshes on 401 errors.
     * @returns A Promise that resolves to the new set of tokens.
     */
    async refreshToken(): Promise<Token> {
        const refreshToken = tokenManager.getRefreshToken();
        if (!refreshToken) {
        throw new Error('No refresh token available');
        }

        const { data } = await api.post<Token>('/auth/refresh', {
        refresh_token: refreshToken,
        });
        // Store the new tokens to be used for subsequent requests.
        tokenManager.setTokens(data);
        return data;
    }

}

/**
 * A singleton instance of the AuthService.
 * Exporting an instance ensures that the same service object is used throughout the application,
 * maintaining a consistent state.
 */
export const authService = new AuthService();