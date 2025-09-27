import bcrypt from 'bcryptjs';
import databaseConfig from '../config/database.js';

const prisma = databaseConfig.prisma;
const BCRYPT_HASH_REGEX = /^\$2[aby]\$/;

const DEFAULT_ARRAYS = {
  replicas: () => [],
  deletedReplicas: () => [],
  whitelistedPatients: () => [],
  albums: () => [],
  photos: () => [],
  patientWhitelist: () => []
};

const clone = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

const ensureArray = (value, fallbackFactory = () => []) => {
  if (Array.isArray(value)) return clone(value);
  if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
    const arr = value.toJSON();
    if (Array.isArray(arr)) return clone(arr);
  }
  return fallbackFactory();
};

class UserEntity {
  constructor(record = {}) {
    this._load(record);
  }

  _load(record) {
    if (!record) record = {};

    this.id = record.id || record._id || this.id;
    this._id = this.id;
    this.email = record.email ? record.email.toLowerCase() : this.email;
    this.sensayUserId = record.sensayUserId ?? this.sensayUserId ?? null;
    this.password = record.password ?? this.password ?? null;
    this.isVerified = record.isVerified ?? this.isVerified ?? false;
    this.firstName = record.firstName ?? this.firstName ?? null;
    this.lastName = record.lastName ?? this.lastName ?? null;
    this.lastLogin = record.lastLogin ? new Date(record.lastLogin) : this.lastLogin ?? null;
    this.role = record.role ?? this.role ?? 'caretaker';
    this.verificationToken = record.verificationToken ?? this.verificationToken ?? null;
    this.otpCode = record.otpCode ?? this.otpCode ?? null;
    this.otpExpires = record.otpExpires ? new Date(record.otpExpires) : this.otpExpires ?? null;
    this.passwordResetToken = record.passwordResetToken ?? this.passwordResetToken ?? null;
    this.passwordResetExpires = record.passwordResetExpires ? new Date(record.passwordResetExpires) : this.passwordResetExpires ?? null;
    this.albums = ensureArray(record.albums, DEFAULT_ARRAYS.albums);
    this.photos = ensureArray(record.photos, DEFAULT_ARRAYS.photos);
    this.replicaImageUrl = record.replicaImageUrl ?? this.replicaImageUrl ?? null;
    this.replicaImageId = record.replicaImageId ?? this.replicaImageId ?? null;
    this.replicas = ensureArray(record.replicas, DEFAULT_ARRAYS.replicas);
    this.deletedReplicas = ensureArray(record.deletedReplicas, DEFAULT_ARRAYS.deletedReplicas);
    this.whitelistedPatients = Array.isArray(record.whitelistedPatients) ? [...record.whitelistedPatients] : DEFAULT_ARRAYS.whitelistedPatients();
    this.patientWhitelist = ensureArray(record.patientWhitelist, DEFAULT_ARRAYS.patientWhitelist);
    this.gallery = record.gallery ? clone(record.gallery) : this.gallery ?? null;
    this.createdAt = record.createdAt ? new Date(record.createdAt) : this.createdAt ?? null;
    this.updatedAt = record.updatedAt ? new Date(record.updatedAt) : this.updatedAt ?? null;
  }

  toObject({ includeSensitive = false } = {}) {
    const base = {
      _id: this._id,
      id: this.id,
      email: this.email,
      sensayUserId: this.sensayUserId,
      isVerified: this.isVerified,
      firstName: this.firstName,
      lastName: this.lastName,
      lastLogin: this.lastLogin,
      role: this.role,
      verificationToken: includeSensitive ? this.verificationToken : undefined,
      otpCode: includeSensitive ? this.otpCode : undefined,
      otpExpires: includeSensitive ? this.otpExpires : undefined,
      passwordResetToken: includeSensitive ? this.passwordResetToken : undefined,
      passwordResetExpires: includeSensitive ? this.passwordResetExpires : undefined,
      albums: clone(this.albums),
      photos: clone(this.photos),
      replicaImageUrl: this.replicaImageUrl,
      replicaImageId: this.replicaImageId,
      replicas: clone(this.replicas),
      deletedReplicas: clone(this.deletedReplicas),
      whitelistedPatients: Array.isArray(this.whitelistedPatients) ? [...this.whitelistedPatients] : [],
      patientWhitelist: clone(this.patientWhitelist),
      gallery: clone(this.gallery),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };

    if (includeSensitive) {
      base.password = this.password;
    }

    return base;
  }

  toJSON() {
    const data = this.toObject({ includeSensitive: false });
    delete data.verificationToken;
    delete data.otpCode;
    delete data.otpExpires;
    delete data.passwordResetToken;
    delete data.passwordResetExpires;
    delete data.password;
    return data;
  }

  async comparePassword(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  }

  isActive() {
    return Boolean(this.isVerified);
  }

  async save() {
    const data = await this._prepareForPersistence();
    if (this.id) {
      const updated = await prisma.user.update({
        where: { id: this.id },
        data
      });
      this._load(updated);
    } else {
      const created = await prisma.user.create({ data });
      this._load(created);
    }
    return this;
  }

  async _prepareForPersistence() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }

    if (this.password && !BCRYPT_HASH_REGEX.test(this.password)) {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }

    return {
      email: this.email,
      sensayUserId: this.sensayUserId,
      password: this.password,
      isVerified: this.isVerified,
      firstName: this.firstName,
      lastName: this.lastName,
      lastLogin: this.lastLogin,
      role: this.role,
      verificationToken: this.verificationToken,
      otpCode: this.otpCode,
      otpExpires: this.otpExpires,
      passwordResetToken: this.passwordResetToken,
      passwordResetExpires: this.passwordResetExpires,
      albums: clone(this.albums),
      photos: clone(this.photos),
      replicaImageUrl: this.replicaImageUrl,
      replicaImageId: this.replicaImageId,
      replicas: clone(this.replicas),
      deletedReplicas: clone(this.deletedReplicas),
      whitelistedPatients: Array.isArray(this.whitelistedPatients) ? [...this.whitelistedPatients] : [],
      patientWhitelist: clone(this.patientWhitelist),
      gallery: clone(this.gallery)
    };
  }
}

const normalizeSelectInput = (input) => {
  if (!input) return [];
  if (typeof input === 'string') {
    return input.trim().split(/\s+/).filter(Boolean);
  }
  if (Array.isArray(input)) return input;
  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  }
  return [];
};

const applySelect = (entity, selectInput) => {
  const tokens = normalizeSelectInput(selectInput);
  if (!tokens.length) {
    return entity;
  }

  const includes = tokens.filter(token => !token.startsWith('-'));
  const excludes = tokens.filter(token => token.startsWith('-')).map(token => token.slice(1));

  if (!includes.length && excludes.length) {
    const result = entity.toObject({ includeSensitive: false });
    excludes.forEach(field => {
      delete result[field];
    });
    return result;
  }

  const base = entity.toObject({ includeSensitive: false });
  const picked = { _id: base._id, id: base.id };
  includes.forEach(field => {
    const cleanField = field.replace(/^[+]/, '');
    if (cleanField in base) {
      picked[cleanField] = base[cleanField];
    }
  });

  excludes.forEach(field => delete picked[field]);

  return picked;
};

const traversePath = (object, pathParts, context = []) => {
  if (pathParts.length === 0) {
    return [{ value: object, context }];
  }

  if (object === null || object === undefined) {
    return [];
  }

  const [head, ...rest] = pathParts;
  const nextValue = object[head];

  if (Array.isArray(nextValue)) {
    return nextValue.flatMap((item, index) =>
      traversePath(item, rest, [...context, { array: head, index }])
    );
  }

  return traversePath(nextValue, rest, context);
};

const createMatchContext = () => ({
  arrayMatches: {}
});

const recordArrayMatch = (ctx, contexts) => {
  if (!Array.isArray(contexts)) return;
  contexts.forEach(entry => {
    if (!entry.array) return;
    if (!ctx.arrayMatches[entry.array]) {
      ctx.arrayMatches[entry.array] = new Set();
    }
    ctx.arrayMatches[entry.array].add(entry.index);
  });
};

const matchesFilter = (record, filter, ctx = createMatchContext()) => {
  if (!filter || !Object.keys(filter).length) {
    return { matches: true, context: ctx };
  }

  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or') {
      const clauses = Array.isArray(value) ? value : [];
      const orMatch = clauses.some(clause => matchesFilter(record, clause, ctx).matches);
      if (!orMatch) {
        return { matches: false, context: ctx };
      }
      continue;
    }

    if (key === '_id' || key === 'id') {
      if (record.id !== value) {
        return { matches: false, context: ctx };
      }
      continue;
    }

    const pathParts = key.split('.');
    const results = traversePath(record, pathParts);

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if ('$exists' in value) {
        const exists = results.length > 0 && results.some(res => res.value !== undefined && res.value !== null);
        if (Boolean(value.$exists) !== exists) {
          return { matches: false, context: ctx };
        }
        continue;
      }

      if ('$in' in value) {
        const arr = Array.isArray(value.$in) ? value.$in : [];
        const matchedResults = results.filter(res => arr.includes(res.value));
        if (!matchedResults.length) {
          return { matches: false, context: ctx };
        }
        recordArrayMatch(ctx, matchedResults.map(res => res.context).flat());
        continue;
      }
    }

    if (results.length === 0) {
      const valueIsNullish = value === null || value === undefined;
      if (!valueIsNullish) {
        return { matches: false, context: ctx };
      }
      continue;
    }

    const matchedResults = results.filter(res => {
      if (Array.isArray(res.value)) {
        return res.value.includes(value);
      }
      return res.value === value;
    });

    if (!matchedResults.length) {
      return { matches: false, context: ctx };
    }

    recordArrayMatch(ctx, matchedResults.map(res => res.context).flat());
  }

  return { matches: true, context: ctx };
};

const fetchUsersForFilter = async (filter = {}) => {
  if (filter._id || filter.id) {
    const id = filter._id || filter.id;
    const record = await prisma.user.findUnique({ where: { id } });
    return record ? [record] : [];
  }

  if (filter.email) {
    const email = String(filter.email).toLowerCase();
    const record = await prisma.user.findUnique({ where: { email } });
    return record ? [record] : [];
  }

  return prisma.user.findMany();
};

const setNestedValue = (target, path, value) => {
  const parts = path.split('.');
  let cursor = target;
  while (parts.length > 1) {
    const part = parts.shift();
    if (!(part in cursor) || cursor[part] === undefined || cursor[part] === null) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[0]] = value;
};

const applySet = (entity, setObject, context) => {
  for (const [path, value] of Object.entries(setObject)) {
    if (path.includes('$')) {
      const [arrayField, remainder] = path.split('.$.');
      const indexes = Array.from(context.arrayMatches[arrayField] || []);
      indexes.forEach(index => {
        if (!Array.isArray(entity[arrayField])) return;
        const target = entity[arrayField][index];
        if (!target) return;
        const cleanPath = remainder.replace(/^\.?/, '');
        if (cleanPath) {
          setNestedValue(target, cleanPath, value);
        }
      });
    } else {
      setNestedValue(entity, path, value);
    }
  }
};

const applyPush = (entity, pushObject) => {
  for (const [path, value] of Object.entries(pushObject)) {
    if (!Array.isArray(entity[path])) {
      entity[path] = [];
    }
    if (value && typeof value === 'object' && '$each' in value) {
      const items = Array.isArray(value.$each) ? value.$each : [];
      entity[path].push(...clone(items));
    } else {
      entity[path].push(clone(value));
    }
  }
};

const applyPull = (entity, pullObject) => {
  for (const [path, condition] of Object.entries(pullObject)) {
    if (!Array.isArray(entity[path])) continue;

    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      entity[path] = entity[path].filter(item => {
        return !Object.entries(condition).every(([key, value]) => item?.[key] === value);
      });
    } else {
      entity[path] = entity[path].filter(item => item !== condition);
    }
  }
};

const applyUnset = (entity, unsetObject, context) => {
  for (const path of Object.keys(unsetObject)) {
    if (path.includes('$')) {
      const [arrayField, remainder] = path.split('.$.');
      const indexes = Array.from(context.arrayMatches[arrayField] || []);
      const cleanPath = remainder.replace(/^\.?/, '');
      indexes.forEach(index => {
        if (!Array.isArray(entity[arrayField])) return;
        const target = entity[arrayField][index];
        if (!target) return;
        if (cleanPath) {
          setNestedValue(target, cleanPath, null);
        }
      });
      continue;
    }

    const parts = path.split('.');
    if (parts.length === 1) {
      entity[parts[0]] = null;
      continue;
    }

    const lastKey = parts.pop();
    let cursor = entity;
    for (const part of parts) {
      if (!cursor || typeof cursor !== 'object') break;
      cursor = cursor[part];
    }
    if (cursor && typeof cursor === 'object') {
      cursor[lastKey] = null;
    }
  }
};

const applyUpdates = (entity, update, context) => {
  if (!update || typeof update !== 'object') return;

  const operators = ['$set', '$push', '$pull', '$unset'];
  const hasOperator = Object.keys(update).some(key => operators.includes(key));

  if (!hasOperator) {
    Object.entries(update).forEach(([key, value]) => setNestedValue(entity, key, value));
    return;
  }

  if (update.$set) applySet(entity, update.$set, context);
  if (update.$push) applyPush(entity, update.$push);
  if (update.$pull) applyPull(entity, update.$pull);
  if (update.$unset) applyUnset(entity, update.$unset, context);
};

class UserQuery {
  constructor(where) {
    this.where = where;
    this._select = null;
  }

  select(fields) {
    this._select = fields;
    return this;
  }

  async exec() {
  const record = await prisma.user.findUnique({ where: this.where });
    if (!record) return null;
  const entity = new UserModel(record);
    if (!this._select) return entity;
    return applySelect(entity, this._select);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

class UserFilterQuery {
  constructor(filter = {}, { single = false } = {}) {
    this.filter = filter;
    this.single = single;
    this._select = null;
  }

  select(fields) {
    this._select = fields;
    return this;
  }

  async exec() {
    const records = await fetchUsersForFilter(this.filter);
    let firstMatch = null;
    const results = [];

    for (const record of records) {
      const { matches } = matchesFilter(record, this.filter, createMatchContext());
      if (!matches) continue;

  const entity = new UserModel(record);
      if (this._select) {
        const selected = applySelect(entity, this._select);
        if (this.single) return selected;
        results.push(selected);
      } else {
        if (this.single) {
          firstMatch = entity;
          break;
        }
        results.push(entity);
      }
    }

    if (this.single) {
      return firstMatch;
    }

    return results;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

class UserModel extends UserEntity {
  constructor(data = {}) {
    super(data);
  }

  static async create(data) {
    const entity = new UserModel(data);
    await entity.save();
    return entity;
  }

  static async findByEmail(email) {
    if (!email) return null;
    const record = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return record ? new UserModel(record) : null;
  }

  static findById(id) {
    if (!id) return {
      async select() { return null; },
      async exec() { return null; },
      then(resolve, reject) { return Promise.resolve(null).then(resolve, reject); }
    };
    return new UserQuery({ id });
  }

  static findOne(filter = {}) {
    return new UserFilterQuery(filter, { single: true });
  }

  static find(filter = {}) {
    return new UserFilterQuery(filter, { single: false });
  }

  static async findByIdAndUpdate(id, update = {}, options = {}) {
    const user = await this.findById(id);
    const entity = await user; // resolves query
    if (!entity) return null;

    const context = createMatchContext();
    applyUpdates(entity, update, context);
    await entity.save();

    if (options.new) {
      if (options.select) {
        return applySelect(entity, options.select);
      }
      return entity;
    }

    return options.select ? applySelect(entity, options.select) : entity;
  }

  static async updateOne(filter = {}, update = {}) {
    const records = await fetchUsersForFilter(filter);
    for (const record of records) {
      const { matches, context } = matchesFilter(record, filter, createMatchContext());
      if (!matches) continue;
      const entity = new UserModel(record);
      applyUpdates(entity, update, context);
      await entity.save();
      return { acknowledged: true, modifiedCount: 1 };
    }
    return { acknowledged: true, modifiedCount: 0 };
  }
}

export default UserModel;
