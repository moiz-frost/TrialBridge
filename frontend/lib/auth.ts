"use client";

const ACCESS_TOKEN_KEY = "trialbridge_access_token";
const REFRESH_TOKEN_KEY = "trialbridge_refresh_token";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getAccessToken(): string {
  if (!isBrowser()) return "";
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function getRefreshToken(): string {
  if (!isBrowser()) return "";
  return window.localStorage.getItem(REFRESH_TOKEN_KEY) || "";
}

export function setAuthTokens(access: string, refresh: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearAuthTokens(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasAuthToken(): boolean {
  return !!getAccessToken();
}
