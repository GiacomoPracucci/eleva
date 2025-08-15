/**
 * @file This file configures a custom Axios instance for making API requests.
 * It includes interceptors to automatically handle JWT (JSON Web Token) authentication,
 * including adding the access token to every request and refreshing it when it expires.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Token } from '@/types';

/**
 * A pre-configured instance of Axios.
 * All API requests in the application should be made through this instance.
 */
const api = axios.create({
    // The base URL for all API requests. It tries to get it from environment variables (Vite-specific),
    // falling back to a local development server URL.
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
    // Default headers to be sent with every request.
    headers: {
        'Content-Type': 'application/json'
    },
});

// Define constant keys to avoid magic strings and typos when accessing localStorage.
const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * A utility object to abstract the logic of handling tokens in localStorage.
 * This makes the code cleaner and easier to maintain, as all token-related
 * localStorage operations are centralized here.
 */
export const tokenManager = {
    /** Retrieves the access token from localStorage. */
    getToken: () => localStorage.getItem(TOKEN_KEY),

    /** Retrieves the refresh token from localStorage. */
    getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),

    /** Saves both the access and refresh tokens to localStorage. */
    setTokens: (token: Token) => {
        localStorage.setItem(TOKEN_KEY, token.access_token);
        localStorage.setItem(REFRESH_TOKEN_KEY, token.refresh_token);
    },

    /** Removes both tokens from localStorage, effectively logging the user out. */
    clearTokens: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
};

/**
 * Request Interceptor: This function runs before each request is sent.
 * Its purpose is to automatically add the `Authorization` header with the
 * Bearer token to every outgoing API request.
 */
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Get the token from our token manager.
        const token = tokenManager.getToken();
        
        // If a token exists and the request has a headers object, add the token to the header.
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Return the modified config object so the request can proceed.
        return config;
    },
    (error) => {
        // If an error occurs during request setup, reject the promise to propagate the error.
        return Promise.reject(error);
    }
)

/**
 * Response Interceptor: This function runs for every response received from the API.
 * Its main purpose is to handle API errors, specifically `401 Unauthorized` errors,
 * which usually indicate an expired access token.
 */
api.interceptors.response.use(
    // The first function handles successful responses (status 2xx).
    // It simply returns the response, letting it pass through.
    (response) => response,

    // The second function handles errors. It's an async function because
    // it needs to wait for the token refresh process.
    async (error: AxiosError) => {
        // Get the original request configuration that led to this error.
        // We cast it and add a custom `_retry` property.
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // The core logic: check if the error is a 401 and if we haven't already retried this request.
        // The `_retry` flag is crucial to prevent an infinite loop if the refresh token call also fails with a 401.
        if (error.response?.status == 401 && !originalRequest._retry) {
            // Mark this request as having been retried.
            originalRequest._retry = true;

            try {
                const refreshToken = tokenManager.getRefreshToken();
                if (!refreshToken) {
                    // If there's no refresh token, we can't do anything.
                    throw new Error('No refresh token');
                }

                // Make a request to the token refresh endpoint.
                // NOTE: We use the global `axios` instance here, NOT our `api` instance.
                // This is to avoid triggering the request interceptor, which would
                // add the old, expired access token to this refresh request.
                const response = await axios.post<Token> (
                    `${api.defaults.baseURL}/auth/refresh`,
                    { refresh_token: refreshToken }
                );

                // If the refresh is successful, save the new tokens.
                tokenManager.setTokens(response.data);

                // Update the Authorization header on the original request with the new access token.
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
                }
                
                // Resend the original request with the new token. The response of this new
                // request will be returned to the original caller.
                return api(originalRequest); 
            } catch (refreshError) {
                // If the token refresh process fails (e.g., the refresh token is also invalid),
                // we must log the user out.
                tokenManager.clearTokens();
                // Redirect the user to the login page.
                window.location.href = '/login';
                
                // Reject the promise to stop any further actions in the original call chain.
                return Promise.reject(refreshError);
            }
        }

        // For any other error (e.g., 500, 404) or if it's a failed retry,
        // just pass the error along.
        return Promise.reject(error);
    } 
)

export default api;