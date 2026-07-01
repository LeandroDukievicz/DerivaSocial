import { promises as fs } from 'fs';
import path from 'path';
import { config } from './config.ts';

export interface Record {
  guid: string;
  title: string;
  link: string;
  status: 'skipped_baseline' | 'generating' | 'pending' | 'approved' | 'published' | 'error' | 'discarded';
  shortId?: string;
  drafts?: Record_Drafts;
  results?: unknown;
  createdAt: string;
}
export type Record_Drafts = { [network: string]: string };

export interface State {
  seen: { [guid: string]: Record };
  pendingByShort: { [shortId: string]: string };
  tgOffset: number;
  initialized: boolean;
}

const file = () => path.join(config.dataDir, 'state.json');
let state: State;

export async function load(): Promise<State> {
  try {
    state = JSON.parse(await fs.readFile(file(), 'utf8'));
  } catch {
    state = { seen: {}, pendingByShort: {}, tgOffset: 0, initialized: false };
  }
  state.seen ??= {};
  state.pendingByShort ??= {};
  state.tgOffset ??= 0;
  return state;
}

export function get(): State {
  return state;
}

let saving: Promise<void> = Promise.resolve();
export function save(): Promise<void> {
  // serializa as escritas pra evitar corrida entre o loop do RSS e o do Telegram
  saving = saving.then(async () => {
    await fs.mkdir(config.dataDir, { recursive: true });
    const tmp = file() + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(state, null, 2));
    await fs.rename(tmp, file());
  }).catch((e) => console.error('erro salvando estado', e));
  return saving;
}
