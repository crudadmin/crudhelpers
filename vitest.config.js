import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        // Components of the tests are written with templates, compiled at runtime
        alias: {
            vue: 'vue/dist/vue.esm-bundler.js',
        },
    },
    test: {
        environment: 'happy-dom',
        include: ['tests/**/*.spec.js'],
    },
});
