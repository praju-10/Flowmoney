// The UI talks to this object. It is backed by the on-device database (see src/data/). There is no server and no network call.
import { createLocalApi } from '../data/localApi.js';
import { getDb, flush } from '../data/browserDb.js';
export { ApiError } from '../data/apiError.js';

export const api = createLocalApi({ getDb, flush });
