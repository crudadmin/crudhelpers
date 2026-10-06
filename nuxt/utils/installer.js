import _ from 'lodash';

// Matches this package's plugin directories. The installed package resolves to
// @crudadmin/helpers, while a linked checkout resolves to its own directory
// name, so both spellings have to be accepted. runtime/plugins holds the
// plugins the module adds only when their feature is enabled.
const PLUGIN_DIRECTORY = /(helpers|crudhelpers)\/nuxt\/(runtime\/)?plugins\//;

// Numbered plugin file: 00.localization.js, 10.eshop.js...
const NUMBERED = /^(\d{2})\./;

const fileName = (plugin) => String(plugin.src || '').split(/[\\/]/).pop();

const normalize = (path) => String(path || '').replace(/\\/g, '/');

/**
 * Is this a numbered plugin of helpers, or of a layer extending it?
 *
 * Layers built on top of helpers number their plugins in the same sequence
 * (helpers 00-09, eshop 10-19), so they run right after the helpers boot and
 * before the plugins of the project. The project's own plugins are never
 * reordered, even numbered ones, they keep running last.
 */
const isPriorityPlugin = (plugin, layerDirs = []) => {
    if (!NUMBERED.test(fileName(plugin))) {
        return false;
    }

    const src = normalize(plugin.src);

    if (PLUGIN_DIRECTORY.test(src)) {
        return true;
    }

    return layerDirs.some((dir) => src.startsWith(normalize(dir) + '/'));
};

const pluginNumber = (plugin) => parseInt(fileName(plugin).match(NUMBERED)[1], 10);

// We need push pinia plugin at the beggining of the plugins array,
// because some of our priority plugins depends on pinia plugin
const addPriorityPluginsAtBeggining = (plugins) => {
    return _.sortBy(plugins, (a, b) => {
        // Pinia should be at the beginning
        if (a.src.includes('@pinia/nuxt')) {
            return -2;
        }

        // If we are using persistedstate plugin, we need to push it at the beginning as well
        if (a.src.includes('pinia-plugin-persistedstate')) {
            return -1;
        }

        return 0;
    });
};

/**
 * @param plugins   the app plugins
 * @param layerDirs plugin directories of the layers extending helpers
 */
export const regorganizePlugins = (plugins, layerDirs = []) => {
    // Sorted by their number across all layers, stable for equal numbers
    let priorityPlugins = _.sortBy(
        _.filter(plugins, (plugin) => isPriorityPlugin(plugin, layerDirs)),
        pluginNumber
    );

    let normalPlugins = _.filter(
        plugins,
        (plugin) => !isPriorityPlugin(plugin, layerDirs)
    );

    plugins = addPriorityPluginsAtBeggining(
        _.uniqBy(priorityPlugins.concat(normalPlugins), 'src')
    );

    return plugins;
};
