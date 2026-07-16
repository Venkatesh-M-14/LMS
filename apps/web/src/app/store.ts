import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '../features/auth/authSlice';
import { uiReducer, persistUiListener } from './uiSlice';
import { bindApiClient } from '../shared/api/client';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
  },
  middleware: (getDefault) => getDefault().prepend(persistUiListener.middleware),
});

// The API client needs the current access token and a way to update the
// session after silent refreshes — bound once here, at composition time.
bindApiClient(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
