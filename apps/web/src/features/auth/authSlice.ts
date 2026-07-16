import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthResponse, UserDto } from '@academy/shared';

export type SessionStatus = 'unknown' | 'authenticated' | 'guest';

export interface AuthState {
  status: SessionStatus;
  user: UserDto | null;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
}

const initialState: AuthState = {
  status: 'unknown',
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
};

function applySession(state: AuthState, session: AuthResponse): void {
  state.status = 'authenticated';
  state.user = session.user;
  state.accessToken = session.accessToken;
  state.accessTokenExpiresAt = session.accessTokenExpiresAt;
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Login or register succeeded. */
    sessionStarted(state, action: PayloadAction<AuthResponse>) {
      applySession(state, action.payload);
    },
    /** A silent refresh succeeded (bootstrap or 401 recovery). */
    sessionRefreshed(state, action: PayloadAction<AuthResponse>) {
      applySession(state, action.payload);
    },
    /** No recoverable session — the user must log in. */
    sessionExpired(state) {
      state.status = 'guest';
      state.user = null;
      state.accessToken = null;
      state.accessTokenExpiresAt = null;
    },
    loggedOut(state) {
      state.status = 'guest';
      state.user = null;
      state.accessToken = null;
      state.accessTokenExpiresAt = null;
    },
  },
});

export const { sessionStarted, sessionRefreshed, sessionExpired, loggedOut } = authSlice.actions;
export const authReducer = authSlice.reducer;
