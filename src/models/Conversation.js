import databaseConfig from '../config/database.js';

const prisma = databaseConfig.prisma;

const normalizeMessage = (message = {}) => ({
  id: message.id || message._id || message.timestamp?.valueOf?.() || Date.now().toString(),
  text: message.text || '',
  sender: message.sender || 'user',
  timestamp: message.timestamp ? new Date(message.timestamp) : new Date()
});

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
      if ('$in' in value) {
        const arr = Array.isArray(value.$in) ? value.$in : [];
        if (!results.some(res => arr.includes(res))) {
          return false;
        }
        continue;
      }
    }

    if (!results.length) {
      if (value === null || value === undefined) continue;
      return false;
    }

    const satisfied = results.some(res => {
      if (Array.isArray(res)) return res.includes(value);
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

const fetchConversationsForFilter = async (filter = {}) => {
  if (filter._id || filter.id) {
    const id = filter._id || filter.id;
    const record = await prisma.conversation.findUnique({ where: { id } });
    return record ? [record] : [];
  }

  const where = {};
  if (filter.userId) where.userId = filter.userId;
  if (filter.replicaId) where.replicaId = filter.replicaId;
  if (typeof filter.isActive === 'boolean') where.isActive = filter.isActive;

  // If only simple fields provided, let Prisma filter server-side.
  if (Object.keys(where).length > 0 && Object.keys(filter).every(key => ['userId', 'replicaId', 'isActive'].includes(key))) {
    return prisma.conversation.findMany({ where });
  }

  return prisma.conversation.findMany();
};

class ConversationEntity {
  constructor(record = {}) {
    this._load(record);
  }

  _load(record = {}) {
    this.id = record.id || record._id || this.id;
    this._id = this.id;
    this.userId = record.userId ?? this.userId ?? null;
    this.replicaId = record.replicaId ?? this.replicaId ?? null;
    this.title = record.title ?? this.title ?? null;
    this.messages = Array.isArray(record.messages) ? record.messages.map(normalizeMessage) : (this.messages || []);
    this.isActive = record.isActive ?? this.isActive ?? true;
    this.lastMessageAt = record.lastMessageAt ? new Date(record.lastMessageAt) : (this.messages.length ? this.messages[this.messages.length - 1].timestamp : this.lastMessageAt ?? null);
    this.createdAt = record.createdAt ? new Date(record.createdAt) : this.createdAt ?? null;
    this.updatedAt = record.updatedAt ? new Date(record.updatedAt) : this.updatedAt ?? null;
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id,
      userId: this.userId,
      replicaId: this.replicaId,
      title: this.title,
      messages: this.messages.map(msg => ({ ...msg, timestamp: msg.timestamp })),
      isActive: this.isActive,
      lastMessageAt: this.lastMessageAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    return this.toObject();
  }

  async save() {
    if (this.messages.length) {
      const lastMessage = this.messages[this.messages.length - 1];
      this.lastMessageAt = lastMessage.timestamp ? new Date(lastMessage.timestamp) : new Date();
    }

    const data = {
      userId: this.userId,
      replicaId: this.replicaId,
      title: this.title,
      messages: this.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
      })),
      isActive: this.isActive,
      lastMessageAt: this.lastMessageAt
    };

    if (this.id) {
      const updated = await prisma.conversation.update({ where: { id: this.id }, data });
      this._load(updated);
    } else {
      const created = await prisma.conversation.create({ data });
      this._load(created);
    }

    return this;
  }
}

class ConversationQuery {
  constructor(filter = {}, { single = false } = {}) {
    this.filter = filter;
    this.single = single;
    this._select = null;
    this._sort = null;
    this._limit = single ? 1 : null;
  }

  select(fields) {
    this._select = fields;
    return this;
  }

  sort(spec) {
    this._sort = spec;
    return this;
  }

  limit(count) {
    this._limit = typeof count === 'number' ? count : parseInt(count, 10);
    return this;
  }

  async exec() {
    const records = await fetchConversationsForFilter(this.filter);
    const matches = [];
    for (const record of records) {
      if (!matchesFilter(record, this.filter)) continue;
      matches.push(new ConversationEntity(record));
    }

    let results = matches;

    if (this._sort && typeof this._sort === 'object') {
      const entries = Object.entries(this._sort);
      results = results.sort((a, b) => {
        for (const [field, direction] of entries) {
          const dir = direction === -1 ? -1 : 1;
          const aValue = a[field];
          const bValue = b[field];
          if (aValue === bValue) continue;
          if (aValue === undefined || aValue === null) return dir * -1;
          if (bValue === undefined || bValue === null) return dir * 1;
          if (aValue > bValue) return dir * 1;
          if (aValue < bValue) return dir * -1;
        }
        return 0;
      });
    }

    if (typeof this._limit === 'number' && this._limit >= 0) {
      results = results.slice(0, this._limit);
    }

    if (this._select) {
      results = results.map(result => applySelect(result, this._select));
    }

    if (this.single) {
      return results.length ? results[0] : null;
    }

    return results;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

class ConversationModel extends ConversationEntity {
  constructor(data = {}) {
    super(data);
  }

  static find(filter = {}) {
    return new ConversationQuery(filter, { single: false });
  }

  static findOne(filter = {}) {
    return new ConversationQuery(filter, { single: true });
  }
}

export default ConversationModel;
