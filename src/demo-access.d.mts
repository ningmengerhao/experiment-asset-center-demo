export interface DemoAccount { id: string; name: string; role: string; domains: string[]; ownedExperimentIds: string[] }
export const DEMO_STATE_STORAGE_KEY: string;
export const TEST_ACCOUNTS: DemoAccount[];
export const INITIAL_METRICS: any[];
export const INITIAL_SAMPLE_SOURCES: any[];
export function createInitialDemoState(): any;
export function loadDemoState(storage?: Storage): any;
export function saveDemoState(state: any, storage?: Storage): boolean;
export function getAccount(accountId: string | null): DemoAccount | null;
export function canAccess(state: any, account: DemoAccount | null, permission: string, resource?: any): boolean;
export function validateSampleSql(sql: string): { valid: boolean; error: string };
export function validateFilterCondition(condition: string): { valid: boolean; error: string };
export function appendFilterCondition(sql: string, condition: string): string;
export function resolveHistoricalSnapshot(source: any, startDate: string, endDate: string): any;
