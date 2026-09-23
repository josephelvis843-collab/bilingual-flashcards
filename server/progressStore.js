// Picks where progress is saved. Both stores expose the same three
// functions, so the routes in index.js don't care which one is in use.
const usePostgres = Boolean(process.env.DATABASE_URL);

const store = usePostgres
  ? await import('./stores/pgStore.js')
  : await import('./stores/fileStore.js');

export const storeName = usePostgres ? 'Postgres' : 'local JSON file';
export const { init, readKnown, writeKnown } = store;
