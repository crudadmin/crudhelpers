import { createResolver } from '@nuxt/kit';
const { resolve } = createResolver(import.meta.url);

export default {
    modules: [resolve('./module.js')],
    imports: {
        dirs: ['../store'],
    },
};
