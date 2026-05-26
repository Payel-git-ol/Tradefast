import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { ThemeName } from './theme.js';
import type { ExchangeName } from './exchanges.js';

const PREF_PATH = join(homedir(), '.lostfast', 'preferences.json');

export interface UserPreferences {
  theme?: ThemeName;
  exchange?: ExchangeName;
}

export async function loadPreferences(): Promise<UserPreferences> {
  try {
    const raw = await readFile(PREF_PATH, 'utf8');
    return JSON.parse(raw) as UserPreferences;
  } catch {
    return {};
  }
}

export async function savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  const dir = dirname(PREF_PATH);
  await mkdir(dir, { recursive: true });
  const current = await loadPreferences();
  const next = { ...current, ...prefs };
  await writeFile(PREF_PATH, JSON.stringify(next, null, 2));
}

export async function saveTheme(name: ThemeName): Promise<void> {
  await savePreferences({ theme: name });
}

export async function saveExchange(name: ExchangeName): Promise<void> {
  await savePreferences({ exchange: name });
}
