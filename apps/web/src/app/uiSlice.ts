import { createListenerMiddleware, createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'academy.themeMode';

function loadThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export interface UiState {
  themeMode: ThemeMode;
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: (): UiState => ({ themeMode: loadThemeMode() }),
  reducers: {
    themeModeChanged(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
  },
});

export const { themeModeChanged } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;

/** Persists UI preferences outside the reducer (reducers stay pure). */
export const persistUiListener = createListenerMiddleware();
persistUiListener.startListening({
  actionCreator: themeModeChanged,
  effect: (action) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, action.payload);
    } catch {
      // Storage unavailable (private mode) — the preference just won't persist.
    }
  },
});
