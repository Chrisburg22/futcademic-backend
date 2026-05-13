type MockResponse = { data: any; error: any; count?: number };

const defaultData = { data: [], error: null, count: 0 };

export class MockQueryBuilder {
  _data: any = [];
  _error: any = null;
  _count: number | undefined = undefined;

  constructor(data?: MockResponse) {
    if (data) {
      this._data = data.data;
      this._error = data.error;
      this._count = data.count;
    }
  }

  select = jest.fn().mockReturnThis();
  eq = jest.fn().mockReturnThis();
  neq = jest.fn().mockReturnThis();
  in = jest.fn().mockReturnThis();
  not = jest.fn().mockReturnThis();
  gte = jest.fn().mockReturnThis();
  lte = jest.fn().mockReturnThis();
  order = jest.fn().mockReturnThis();
  limit = jest.fn().mockReturnThis();
  range = jest.fn().mockReturnThis();
  insert = jest.fn().mockResolvedValue({ data: null, error: null });
  update = jest.fn().mockReturnThis();
  delete = jest.fn().mockReturnThis();

  single = jest.fn().mockImplementation(() => {
    const item = Array.isArray(this._data) ? this._data[0] ?? null : this._data;
    return Promise.resolve({ data: item, error: null });
  });

  maybeSingle = jest.fn().mockImplementation(() => {
    const item = Array.isArray(this._data) ? this._data[0] ?? null : this._data;
    return Promise.resolve({ data: item ?? null, error: null });
  });

  then = jest.fn().mockImplementation(function (
    this: MockQueryBuilder,
    resolve: (value: any) => any,
    _reject?: (reason: any) => any
  ) {
    const result = {
      data: this._data,
      error: this._error,
      count: this._count,
    };
    return Promise.resolve(resolve(result));
  });

  catch = jest.fn().mockImplementation(function (
    this: MockQueryBuilder,
    reject: (reason: any) => any
  ) {
    return Promise.resolve().then(() => {
      if (this._error) return reject(this._error);
      return { data: this._data, error: this._error, count: this._count };
    });
  });
}

export function createMockSupabase() {
  const builders = new Map<string, MockQueryBuilder>();

  const mockFrom = jest.fn().mockImplementation((table: string) => {
    if (!builders.has(table)) {
      builders.set(table, new MockQueryBuilder());
    }
    return builders.get(table)!;
  });

  const setMockData = (table: string, data: MockResponse) => {
    builders.set(table, new MockQueryBuilder(data));
  };

  const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });

  const supabase: any = {
    from: mockFrom,
    rpc: mockRpc,
    _builders: builders,
    _setMockData: setMockData,
    auth: {
      admin: {
        getUserById: jest.fn().mockResolvedValue({
          data: { user: { id: 'auth-user-id', email: 'test@test.com' } },
          error: null,
        }),
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'new-auth-id' } },
          error: null,
        }),
      },
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'auth-user-id', email: 'test@test.com' } },
        error: null,
      }),
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://test.com/file.jpg' },
        }),
      }),
    },
  };

  return supabase;
}

export const mockReq = (overrides: any = {}) => ({
  tenant: { school_id: 'school-1', role: 'admin', user_id: 'user-1' },
  params: {},
  query: {},
  body: {},
  headers: { authorization: 'Bearer test-token' },
  file: undefined,
  ...overrides,
});

export const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};
