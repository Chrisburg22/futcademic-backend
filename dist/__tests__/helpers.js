"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockRes = exports.mockReq = exports.MockQueryBuilder = void 0;
exports.createMockSupabase = createMockSupabase;
const defaultData = { data: [], error: null, count: 0 };
class MockQueryBuilder {
    _data = [];
    _error = null;
    _count = undefined;
    constructor(data) {
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
    then = jest.fn().mockImplementation(function (resolve, _reject) {
        const result = {
            data: this._data,
            error: this._error,
            count: this._count,
        };
        return Promise.resolve(resolve(result));
    });
    catch = jest.fn().mockImplementation(function (reject) {
        return Promise.resolve().then(() => {
            if (this._error)
                return reject(this._error);
            return { data: this._data, error: this._error, count: this._count };
        });
    });
}
exports.MockQueryBuilder = MockQueryBuilder;
function createMockSupabase() {
    const builders = new Map();
    const mockFrom = jest.fn().mockImplementation((table) => {
        if (!builders.has(table)) {
            builders.set(table, new MockQueryBuilder());
        }
        return builders.get(table);
    });
    const setMockData = (table, data) => {
        builders.set(table, new MockQueryBuilder(data));
    };
    const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
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
const mockReq = (overrides = {}) => ({
    tenant: { school_id: 'school-1', role: 'admin', user_id: 'user-1' },
    params: {},
    query: {},
    body: {},
    headers: { authorization: 'Bearer test-token' },
    file: undefined,
    ...overrides,
});
exports.mockReq = mockReq;
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
};
exports.mockRes = mockRes;
