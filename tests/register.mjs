// Lets `node --test` run the app's TypeScript directly: resolves extensionless
// relative imports to .ts files, as the bundler does. Node strips the types.
import { register } from 'node:module';
register('./resolve-ts.mjs', import.meta.url);
