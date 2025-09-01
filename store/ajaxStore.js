import { defineStore } from 'pinia';

import { generateUuid } from '../utils/helpers.js';

import moment from 'moment';
import _ from 'lodash';

const nextTryAt = (seconds) => {
    return moment().add(seconds, seconds).format('Y-MM-DD HH:mm:ss');
};

const isSame = (request, oldRequest) => {
    //Remove with same keys
    if (request.key && request.key == oldRequest.key) {
        return true;
    }

    //Remove by same uuid
    if (request.uuid && request.uuid == oldRequest.uuid) {
        return true;
    }

    //Remove by totally same url and params
    if (
        request.method == oldRequest.method &&
        request.url == oldRequest.url &&
        _.isEqual(request.data, oldRequest.data)
    ) {
        return true;
    }

    return false;
};

export const useAjaxStore = defineStore('ajax', {
    persist: true,

    state() {
        return {
            //Unset post and get requests
            unsent: [],

            //Options
            options: {
                maxErrorCount: 10,
                appRebootSeconds: 300,
                failedRequestDelaySeconds: 60,
            },
        };
    },

    actions: {
        /*
         * Add request into the request unsent queue
         */
        sendRequestLater(data) {
            //Remove old requests
            this.removeRequest(data);

            this.unsent.push({
                uuid: generateUuid(),
                ...data,
                errorCount: 0,
                nextTryAt: nextTryAt(this.options.failedRequestDelaySeconds),
                connected: useNetworkStore().connected ? true : false,
            });
        },
        removeRequest(request) {
            //Filter old requests away
            this.unsent = this.unsent.filter((oldRequest) => {
                return isSame(request, oldRequest) ? false : true;
            });
        },
        addErrorCount(uuid) {
            const unsent = _.find(this.unsent, { uuid });

            if (unsent) {
                //If errors count exceed, remove from queue totally
                if (unsent.errorCount >= this.options.maxErrorCount) {
                    this.removeRequest(unsent);
                }

                //Add error count and reschedule next try
                else {
                    unsent.errorCount++;

                    unsent.nextTryAt = nextTryAt(
                        this.options.failedRequestDelaySeconds
                    );
                }
            }
        },
        resetUnsent() {
            this.unsent = [];
        },
    },

    getters: {
        isAlreadyScheduled(state) {
            return (request) => {
                const prendinRequests = state.unsent
                    .filter((oldRequest) => isSame(request, oldRequest))
                    .filter((futureRequest) => {
                        return moment() < moment(futureRequest.nextTryAt);
                    });

                return prendinRequests;
            };
        },
    },
});
