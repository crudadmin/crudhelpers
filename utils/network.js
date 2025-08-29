import _ from 'lodash';
import moment from 'moment';

const defaultTimeoutSeconds = 600; //5 minutes

export class Network {
    constructor({ user }) {
        this.user = user;

        this.connected = false;

        this.refresher = {
            callback: null,
            timeoutSeconds: defaultTimeoutSeconds,
        };
    }

    /*
     * On boot of this method we will run all network informations required for app
     * also we'll try send all failed requests.
     *
     * Methods in this boot method needs to have remove listeners feature. Because boot may be stared many times in app run.
     */
    listen(callback) {
        const setState = (state, forceCheckOnNetworkBoot = false) => {
            this.connected = state;

            useNetworkStore().setConnection(state);

            //On network change try send failed requests or do something with ajax...
            if (this.connected) {
                this.initConnectionState(forceCheckOnNetworkBoot);
            }
        };

        callback(setState);

        return this;
    }

    refresh(callback, timeoutSeconds = 600) {
        this.refresher.callback = callback;
        this.refresher.timeoutSeconds = timeoutSeconds;
    }

    /*
     * Returns how often app should reload all data
     */
    getRefreshTimeout() {
        const seconds = this.refresher.timeoutSeconds;

        if (typeof seconds === 'function') {
            return seconds() || defaultTimeoutSeconds;
        }

        return seconds || defaultTimeoutSeconds;
    }

    /*
     * Renitialize network on connected state
     */
    initConnectionState(forceCheckOnNetworkBoot = false) {
        this.trySendIncompleteRequests(forceCheckOnNetworkBoot);

        this.initializeRefresher();
    }

    /*
     * This method will send previous failed requests.
     * And then removes them from the failed stack.
     */
    async trySendIncompleteRequests(forceCheckOnNetworkBoot = false) {
        const ajaxStore = useAjaxStore();

        //If internet is turned off. We does not need to try send requests...
        const canTry = this.connected == true && this.user() ? true : false;

        if (!canTry) {
            var toProcess = [];
        } else {
            var toProcess = _.cloneDeep(ajaxStore.unsent).filter((request) => {
                //Check only requests made during offline state
                if (forceCheckOnNetworkBoot) {
                    return request.connected == false;
                }

                //Only scheduled requests
                else {
                    return moment() >= moment(request.nextTryAt);
                }
            });
        }

        for (let request of toProcess) {
            //Request does not exists anymore.
            if (!_.find(ajaxStore.unsent, { uuid: request.uuid })) {
                return;
            }

            let requestMethodName = request.method.toUpperCase();

            try {
                await useAxios()['$' + request.method + 'Async'](
                    request.url,
                    request.data,
                    {
                        _forceCheck: forceCheckOnNetworkBoot,
                        _isRepeatedTry: true,
                        // prettier-ignore
                        callback(){
                            //We can remove this request from unsent stack
                            ajaxStore.removeRequest(request);

                            console.log('[' + requestMethodName + ' SENT AGAIN]', request);
                        },
                    }
                );
            } catch (e) {
                console.log('[' + requestMethodName + ' FAILED]', request);

                ajaxStore.addErrorCount(request.uuid);
            }
        }

        //In case of multiple calls of this method. Clear previous timeouts.
        if (this._incompletedTimeout) {
            clearTimeout(this._incompletedTimeout);
        }

        //Try again after x seconds
        this._incompletedTimeout = setTimeout(() => {
            this.trySendIncompleteRequests();
        }, 2000);
    }

    /*
     * Refresh user account every x time
     */
    async initializeRefresher() {
        var networkStore = useNetworkStore(),
            response;

        try {
            //We need wait till request will end.
            response = await this.tryRefreshAppData();
        } catch (e) {
            console.log(e);
        }

        //Clear closest upcoming interval
        //if refresh app data was not canceled.
        if (this.refreshInterval) {
            clearTimeout(this.refreshInterval);
        }

        var totalTimeout = this.getRefreshTimeout() * 1000;

        //Get difference between previous update
        if (networkStore.lastUpdateTime) {
            let timeLeft = moment() - moment(networkStore.lastUpdateTime);

            if (timeLeft > 0) {
                totalTimeout -= timeLeft;
            }

            //If last update was so long time ago. We want wait
            //few seconds, because app should initialize request, and probably has been failed.
            if (totalTimeout < 0) {
                totalTimeout = 30 * 1000;
            }
        }

        // prettier-ignore
        console.log('remaining time to next refresh: ' + (totalTimeout / 1000).toFixed(1) + 's');

        this.refreshInterval = setTimeout(
            this.initializeRefresher.bind(this),
            totalTimeout
        );
    }

    /*
     * Refresh app data
     */
    async tryRefreshAppData() {
        //If internet is turned off. We does not need sync data.
        if (this.connected == false) {
            return false;
        }

        const networkStore = useNetworkStore();

        //If last update date is lower than minimum refresh timeout
        if (networkStore.lastUpdateTime) {
            let lastUpdateDuration =
                (Date.now() - parseInt(networkStore.lastUpdateTime)) / 1000;

            if (lastUpdateDuration < this.getRefreshTimeout()) {
                return false;
            }
        }

        await this.refreshApp();
    }

    async refreshApp() {
        if (this.refresher.callback) {
            let response = await this.refresher.callback();

            if (response === true) {
                useNetworkStore().setLastUpdate();
            }
        }
    }
}
