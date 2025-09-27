import databaseConfig from '../config/database.js';

const prisma = databaseConfig.prisma;

const traversePath = (object, pathParts) => {
  if (!pathParts.length) return [object];
  if (object === undefined || object === null) return [];
  const [head, ...rest] = pathParts;
  const next = object[head];
  if (Array.isArray(next)) {
    return next.flatMap(item => traversePath(item, rest));
  }
  return traversePath(next, rest);
};

const matchesFilter = (record, filter = {}) => {
  if (!filter || !Object.keys(filter).length) return true;

  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or') {
      const clauses = Array.isArray(value) ? value : [];
      if (!clauses.some(clause => matchesFilter(record, clause))) {
        return false;
      }
      continue;
    }

    if (key === '_id' || key === 'id') {
      if (record.id !== value) return false;
      continue;
    }

    const pathParts = key.split('.');
    const results = traversePath(record, pathParts);

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if ('$exists' in value) {
        const exists = results.length > 0 && results.some(res => res !== undefined && res !== null);
        if (Boolean(value.$exists) !== exists) return false;
        continue;
      }
    }

    if (!results.length) {
      if (value === null || value === undefined) continue;
      return false;
    }

    const satisfied = results.some(res => {
      if (Array.isArray(res)) {
        return res.includes(value);
      }
      return res === value;
    });

    if (!satisfied) return false;
  }

  return true;
};

const applySelect = (entity, selectInput) => {
  if (!selectInput) return entity;
  let tokens = [];
  if (typeof selectInput === 'string') {
    tokens = selectInput.trim().split(/\s+/).filter(Boolean);
  } else if (Array.isArray(selectInput)) {
    tokens = selectInput;
  } else if (typeof selectInput === 'object') {
    tokens = Object.entries(selectInput)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  }

  if (!tokens.length) return entity;

  const includes = tokens.filter(token => !token.startsWith('-'));
  const excludes = tokens.filter(token => token.startsWith('-')).map(token => token.slice(1));

  const base = entity.toObject();
  if (includes.length) {
    const picked = { _id: base._id, id: base.id };
    includes.forEach(field => {
      const clean = field.replace(/^[+]/, '');
      if (clean in base) picked[clean] = base[clean];
    });
    excludes.forEach(field => delete picked[field]);
    return picked;
  }

  excludes.forEach(field => delete base[field]);
  return base;
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

const applyUpdate = (entity, update) => {
  if (!update || typeof update !== 'object') return;
  const hasOperator = Object.keys(update).some(key => key.startsWith('$'));

  if (!hasOperator) {
    Object.entries(update).forEach(([key, value]) => setNestedValue(entity, key, value));
    return;
  }

  if (update.$set) {
    Object.entries(update.$set).forEach(([key, value]) => setNestedValue(entity, key, value));
  }
};

class PatientEntity {
  constructor(record = {}) {
    this._load(record);
  }

  _load(record = {}) {
    this.id = record.id || record._id || this.id;
    this._id = this.id;
    this.email = record.email ? record.email.toLowerCase() : this.email;
    this.caretakerId = record.caretakerId || record.caretaker || this.caretakerId || null;
    this.caretaker = this.caretakerId;
    this.caretakerEmail = record.caretakerEmail ?? this.caretakerEmail ?? null;
    this.userId = record.userId ?? this.userId ?? null;
    this.firstName = record.firstName ?? this.firstName ?? null;
    this.lastName = record.lastName ?? this.lastName ?? null;
    this.allowedReplicas = Array.isArray(record.allowedReplicas) ? [...record.allowedReplicas] : (this.allowedReplicas || []);
    this.isActive = record.isActive ?? this.isActive ?? true;
    this.lastLogin = record.lastLogin ? new Date(record.lastLogin) : this.lastLogin ?? null;
    this.createdAt = record.createdAt ? new Date(record.createdAt) : this.createdAt ?? null;
    this.updatedAt = record.updatedAt ? new Date(record.updatedAt) : this.updatedAt ?? null;
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id,
      email: this.email,
      caretaker: this.caretakerId,
      caretakerId: this.caretakerId,
      caretakerEmail: this.caretakerEmail,
      userId: this.userId,
      firstName: this.firstName,
      lastName: this.lastName,
      allowedReplicas: [...(this.allowedReplicas || [])],
      isActive: this.isActive,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    return this.toObject();
  }

  async save() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }

    const data = {
      email: this.email,
      caretakerId: this.caretakerId,
      caretakerEmail: this.caretakerEmail,
      userId: this.userId,
      firstName: this.firstName,
      lastName: this.lastName,
      allowedReplicas: Array.isArray(this.allowedReplicas) ? [...this.allowedReplicas] : [],
      isActive: this.isActive,
      lastLogin: this.lastLogin
    };

    if (this.id) {
      const updated = await prisma.patient.update({ where: { id: this.id }, data });
      this._load(updated);
    } else {
      const created = await prisma.patient.create({ data });
      this._load(created);
    }

    return this;
  }

  async updateLastLogin() {
    this.lastLogin = new Date();
    await this.save();
    return this.lastLogin;
  }
}

class PatientQuery {
  constructor({ filter = {}, single = false } = {}) {
    this.filter = filter;
    this.single = single;
    this._select = null;
  }

  select(fields) {
    this._select = fields;
    return this;
  }

  async exec() {
    const records = await fetchPatientsForFilter(this.filter);
    const results = [];
    for (const record of records) {
      if (!matchesFilter(record, this.filter)) continue;
      const entity = new PatientEntity(record);
      if (this._select) {
        const selected = applySelect(entity, this._select);
        if (this.single) return selected;
        results.push(selected);
      } else {
        if (this.single) return entity;
        results.push(entity);
      }
    }
    return this.single ? null : results;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

const fetchPatientsForFilter = async (filter = {}) => {
  if (filter._id || filter.id) {
    const id = filter._id || filter.id;
    const record = await prisma.patient.findUnique({ where: { id } });
    return record ? [record] : [];
  }

  if (filter.email) {
    const email = String(filter.email).toLowerCase();
    return prisma.patient.findMany({ where: { email } });
  }

  return prisma.patient.findMany();
};

class PatientModel extends PatientEntity {
  constructor(data = {}) {
    super(data);
  }

  static async create(data) {
    const entity = new PatientModel(data);
    await entity.save();
    return entity;
  }

  static findById(id) {
    if (!id) {
      return {
        async select() { return null; },
        async exec() { return null; },
        then(resolve, reject) { return Promise.resolve(null).then(resolve, reject); }
      };
    }
    return new PatientQuery({ filter: { id }, single: true });
  }

  static findByEmail(email) {
    if (!email) return Promise.resolve(null);
    return prisma.patient.findFirst({ where: { email: email.toLowerCase() } })
      .then(record => (record ? new PatientEntity(record) : null));
  }

  static findOne(filter = {}) {
    return new PatientQuery({ filter, single: true });
  }

  static find(filter = {}) {
    return new PatientQuery({ filter, single: false });
  }

  static async updateMany(filter = {}, update = {}) {
    const records = await fetchPatientsForFilter(filter);
    let modified = 0;
    for (const record of records) {
      if (!matchesFilter(record, filter)) continue;
  const entity = new PatientModel(record);
      applyUpdate(entity, update);
      await entity.save();
      modified += 1;
    }
    return { acknowledged: true, modifiedCount: modified };
  }
}

export default PatientModel;
