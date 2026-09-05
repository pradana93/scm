/**
 * Compatibility shim.
 *
 * The app previously imported `base44` from this module. The backend is now
 * Supabase, so this re-exports the Supabase-backed data client under the same
 * name and API surface. No Base44 SDK is involved.
 */
import { dataClient } from '@/api/dataClient';

export const base44 = dataClient;

export default base44;
