import { supabase } from '@/lib/supabaseClient';

/**
 * Supabase-backed replacement for the Base44 SDK client.
 *
 * It intentionally mirrors the Base44 API surface that this app already uses:
 *   client.entities.<Entity>.list / filter / get / create / bulkCreate / update / delete / deleteMany / subscribe
 *   client.auth.me / updateMe / logout / redirectToLogin
 *   client.integrations.Core.UploadFile
 *   client.functions.invoke('manageUsers', { action, ... })
 *   client.users.inviteUser
 *
 * This keeps every existing call site working while the backend is Supabase.
 */

// Entity name -> Postgres table
const TABLES = {
  Shipment: 'shipments',
  Outlet: 'outlets',
  Item: 'items',
  Vendor: 'vendors',
  Warehouse: 'warehouses',
  MasterPackingItem: 'master_packing_items',
  StockItem: 'stock_items',
  StockMovement: 'stock_movements',
  Production: 'productions',
  ProductionRequest: 'production_requests',
  ProductionProcess: 'production_processes',
  Receipt: 'receipts',
  ReceiptProcess: 'receipt_processes',
  ReceiptVerification: 'receipt_verifications',
  FeaturePermission: 'feature_permissions',
  User: 'app_users',
  UserRequest: 'user_requests',
};

const DEFAULT_LIMIT = 1000;

/** Parse a Base44 sort string ("-created_date" / "name") into Supabase order args. */
function parseSort(sort) {
  if (!sort || typeof sort !== 'string') return null;
  const descending = sort.startsWith('-');
  const column = descending ? sort.slice(1) : sort;
  if (!column) return null;
  return { column, ascending: !descending };
}

/**
 * Apply a Base44/Mongo-style filter object to a Supabase query.
 * Supports: equality, $gte, $lte, $gt, $lt, $ne, $in.
 */
function applyFilter(query, filter) {
  if (!filter || typeof filter !== 'object') return query;

  for (const [field, condition] of Object.entries(filter)) {
    if (condition === undefined) continue;

    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
      for (const [operator, value] of Object.entries(condition)) {
        if (value === undefined) continue;
        switch (operator) {
          case '$gte': query = query.gte(field, value); break;
          case '$lte': query = query.lte(field, value); break;
          case '$gt': query = query.gt(field, value); break;
          case '$lt': query = query.lt(field, value); break;
          case '$ne': query = query.neq(field, value); break;
          case '$in': query = query.in(field, Array.isArray(value) ? value : [value]); break;
          default: query = query.eq(field, value); break;
        }
      }
      continue;
    }

    query = query.eq(field, condition);
  }

  return query;
}

function unwrap({ data, error }) {
  if (error) throw new Error(error.message || 'Database request failed');
  return data;
}

function createEntity(entityName) {
  const table = TABLES[entityName];

  const runSelect = async (filter, sort, limit) => {
    let query = supabase.from(table).select('*');
    query = applyFilter(query, filter);

    const order = parseSort(sort);
    if (order) query = query.order(order.column, { ascending: order.ascending });

    query = query.limit(typeof limit === 'number' && limit > 0 ? limit : DEFAULT_LIMIT);

    return unwrap(await query) || [];
  };

  return {
    /** list(sort, limit) */
    list: (sort, limit) => runSelect(null, sort, limit),

    /** filter(criteria, sort, limit) */
    filter: (criteria, sort, limit) => runSelect(criteria, sort, limit),

    /** get(id) */
    get: async (id) => {
      const data = unwrap(
        await supabase.from(table).select('*').eq('id', id).maybeSingle()
      );
      return data || null;
    },

    /** create(payload) */
    create: async (payload) => {
      const data = unwrap(
        await supabase.from(table).insert(payload).select().single()
      );
      return data;
    },

    /** bulkCreate(payloads) */
    bulkCreate: async (payloads) => {
      const rows = Array.isArray(payloads) ? payloads : [payloads];
      if (!rows.length) return [];
      const data = unwrap(await supabase.from(table).insert(rows).select());
      return data || [];
    },

    /** update(id, payload) */
    update: async (id, payload) => {
      const data = unwrap(
        await supabase.from(table).update(payload).eq('id', id).select().single()
      );
      return data;
    },

    /** delete(id) */
    delete: async (id) => {
      unwrap(await supabase.from(table).delete().eq('id', id).select());
      return { ok: true };
    },

    /** deleteMany(criteria) */
    deleteMany: async (criteria) => {
      let query = supabase.from(table).delete();
      query = applyFilter(query, criteria);
      unwrap(await query.select());
      return { ok: true };
    },

    /** subscribe(callback) -> unsubscribe (Supabase Realtime) */
    subscribe: (callback) => {
      const channel = supabase
        .channel(`realtime:${table}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          try {
            callback(payload);
          } catch {
            /* listener errors must not break the stream */
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

const entities = Object.keys(TABLES).reduce((acc, name) => {
  acc[name] = createEntity(name);
  return acc;
}, {});

/** Fetch the app profile row (role, display_name, ...) for the signed-in user. */
async function fetchCurrentProfile() {
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData?.user;
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from('app_users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (profile) {
    return {
      ...profile,
      email: profile.email || authUser.email,
      full_name: profile.full_name || profile.display_name || authUser.email,
      auth_user_id: authUser.id,
    };
  }

  // Signed in with Supabase but no profile row yet.
  return {
    id: authUser.id,
    auth_user_id: authUser.id,
    email: authUser.email,
    full_name: authUser.user_metadata?.full_name || authUser.email,
    display_name: authUser.user_metadata?.full_name || '',
    role: 'public',
  };
}

const auth = {
  me: async () => {
    const profile = await fetchCurrentProfile();
    if (!profile) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    return profile;
  },

  updateMe: async (payload) => {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    if (!authUser) return null;

    const data = unwrap(
      await supabase
        .from('app_users')
        .update(payload)
        .eq('auth_user_id', authUser.id)
        .select()
        .maybeSingle()
    );
    return data;
  },

  logout: async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  },

  redirectToLogin: () => {
    window.location.href = '/login';
  },
};

const integrations = {
  Core: {
    /** UploadFile({ file }) -> { file_url } */
    UploadFile: async ({ file }) => {
      if (!file) throw new Error('No file provided');

      const safeName = String(file.name || 'upload').replace(/[^\w.\-]+/g, '_');
      const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from('uploads')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (error) throw new Error(error.message || 'Upload failed');

      const { data } = supabase.storage.from('uploads').getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
  },
};

const VALID_ROLES = ['user', 'admin', 'super_admin', 'public'];

/** Local implementation of the previous `manageUsers` backend function. */
async function manageUsers(payload = {}) {
  const { action } = payload;

  switch (action) {
    case 'list': {
      const users = unwrap(
        await supabase
          .from('app_users')
          .select('id, full_name, display_name, email, role, job_title, last_active_at')
          .order('created_date', { ascending: false })
          .limit(DEFAULT_LIMIT)
      );
      return { data: { users: users || [] } };
    }

    case 'listRequests': {
      const requests = unwrap(
        await supabase
          .from('user_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_date', { ascending: false })
          .limit(100)
      );
      return { data: { requests: requests || [] } };
    }

    case 'createRequest': {
      const email = String(payload.email || '').trim().toLowerCase();
      const fullName = String(payload.full_name || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Email tidak valid');
      }

      const existing = unwrap(
        await supabase
          .from('user_requests')
          .select('id')
          .eq('email', email)
          .eq('status', 'pending')
          .limit(1)
      );
      if (existing && existing.length) return { data: { ok: true, alreadyPending: true } };

      unwrap(
        await supabase.from('user_requests').insert({
          email,
          full_name: fullName,
          requested_role: payload.requested_role === 'admin' ? 'admin' : 'user',
          status: 'pending',
        }).select()
      );
      return { data: { ok: true } };
    }

    case 'autoRegister': {
      // The database trigger provisions the profile row on signup.
      const profile = await fetchCurrentProfile();
      return { data: { ok: true, alreadyMember: Boolean(profile?.role && profile.role !== 'public') } };
    }

    case 'approveRequest': {
      const requestId = payload.requestId;
      const role = VALID_ROLES.includes(payload.role) ? payload.role : 'user';
      const displayName = String(payload.full_name || '').trim();

      const request = unwrap(
        await supabase.from('user_requests').select('*').eq('id', requestId).maybeSingle()
      );
      if (!request) throw new Error('Permintaan tidak ditemukan');

      const existingUser = unwrap(
        await supabase.from('app_users').select('id').eq('email', request.email).maybeSingle()
      );

      if (existingUser) {
        unwrap(
          await supabase
            .from('app_users')
            .update({ role, display_name: displayName || request.full_name || null })
            .eq('id', existingUser.id)
            .select()
        );
      } else {
        unwrap(
          await supabase.from('app_users').insert({
            email: request.email,
            full_name: displayName || request.full_name || null,
            display_name: displayName || request.full_name || null,
            role,
          }).select()
        );
      }

      unwrap(
        await supabase
          .from('user_requests')
          .update({ status: 'approved', requested_role: role, full_name: displayName || request.full_name })
          .eq('id', requestId)
          .select()
      );
      return { data: { ok: true } };
    }

    case 'rejectRequest': {
      unwrap(
        await supabase
          .from('user_requests')
          .update({ status: 'rejected' })
          .eq('id', payload.requestId)
          .select()
      );
      return { data: { ok: true } };
    }

    case 'updateName': {
      const displayName = String(payload.full_name || '').trim();
      if (!displayName) throw new Error('Nama tidak boleh kosong');
      unwrap(
        await supabase
          .from('app_users')
          .update({ display_name: displayName })
          .eq('id', payload.userId)
          .select()
      );
      return { data: { ok: true } };
    }

    case 'updateRole': {
      if (!VALID_ROLES.includes(payload.newRole)) throw new Error('Invalid role');
      unwrap(
        await supabase
          .from('app_users')
          .update({ role: payload.newRole })
          .eq('id', payload.userId)
          .select()
      );
      return { data: { ok: true } };
    }

    case 'delete': {
      unwrap(await supabase.from('app_users').delete().eq('id', payload.userId).select());
      return { data: { ok: true } };
    }

    case 'deleteSelf': {
      const profile = await fetchCurrentProfile();
      if (!profile) throw new Error('Unauthorized');
      unwrap(await supabase.from('app_users').delete().eq('id', profile.id).select());
      await supabase.auth.signOut();
      return { data: { ok: true } };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

const functions = {
  invoke: async (name, payload) => {
    if (name === 'manageUsers') return manageUsers(payload);
    throw new Error(`Unknown function: ${name}`);
  },
};

const users = {
  /**
   * Supabase does not allow sending invites with the anon key, so an invite is
   * recorded as a pre-provisioned profile row. The person gains access as soon
   * as they sign up with that email (the signup trigger links the account).
   */
  inviteUser: async (email, role = 'user') => {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) throw new Error('Email tidak valid');

    const existing = unwrap(
      await supabase.from('app_users').select('id').eq('email', normalized).maybeSingle()
    );

    if (existing) {
      unwrap(await supabase.from('app_users').update({ role }).eq('id', existing.id).select());
      return { ok: true, updated: true };
    }

    unwrap(await supabase.from('app_users').insert({ email: normalized, role }).select());
    return { ok: true, invited: true };
  },
};

export const dataClient = { entities, auth, integrations, functions, users };

export default dataClient;
