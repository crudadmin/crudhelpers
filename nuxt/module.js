import { defineNuxtModule } from '@nuxt/kit';

// import { buildTranslatableRoutes } from './utils/CustomRouter.js';
// import { addSitemap } from './utilities/initialize/sitemap.js';

import { regorganizePlugins } from './utils/installer.js';

export default defineNuxtModule({
    // Default configuration options for your module
    defaults: {},
    hooks: {},
    setup(moduleOptions, nuxt) {
        // nuxt.hook('pages:extend', async (routes) => {
        //     buildTranslatableRoutes(nuxt.options.buildDir, routes);

        //     return routes;
        // });

        nuxt.hook('app:resolve', async (nuxt) => {
            nuxt.plugins = regorganizePlugins(nuxt.plugins);
        });
    },
});
