import _ from 'lodash';

const isPriorityPlugin = (plugin) => {
    let prefix = plugin.src.split('/').pop().substr(0, 3);

    // Check if plugin prefix starts with 2 numbers and dot (eg: 01., 02., etc...)
    return (
        plugin.src.includes('helpers/nuxt/plugins') && /^\d{2}\./.test(prefix)
    );
};

// We need push pinia plugin at the beggining of the plugins array,
// because some of our priority plugins depends on pinia plugin
const addPriorityPluginsAtBeggining = (plugins) => {
    return plugins.sort((a, b) => {
        if (a.src.includes('@pinia/nuxt')) {
            return -1;
        }

        return 1;
    });
};

export const regorganizePlugins = (plugins) => {
    let priorityPlugins = _.filter(plugins, isPriorityPlugin);

    let normalPlugins = _.filter(
        plugins,
        (plugin) => !isPriorityPlugin(plugin)
    );

    return addPriorityPluginsAtBeggining(
        _.uniqBy(priorityPlugins.concat(normalPlugins), 'src')
    );
};
