const EventEmitter = require('events');
const assert = require('assert');
const Watchdog = require('@amokrushin/watchdog');
const defaults = require('lodash.defaults');
const createScheduler = require('./createScheduler');
const lua = require('./lua');

const {
    START,
    STOP,
    SET_REDIS_CLIENT,
    SET_NODE_ID,
    SWITCH_ROLE,
    START_WATCHDOG,
    STOP_WATCHDOG,
    START_HEARTBEAT,
    STOP_HEARTBEAT,
    WATCHDOG_TRIGGER,
    HEARTBEAT_FAILURE,
} = require('./events');

const noop = () => {};
const joinKey = (...args) => args.filter(v => v).join(':');
const delay = (timeout = 0) => new Promise(resolve => setTimeout(resolve, timeout));

class RedisLeader extends EventEmitter {
    constructor(createClient, options) {
        assert.equal(
            typeof createClient,
            'function',
            'createClient argument must be a function',
        );

        super();

        this._options = defaults(options, RedisLeader.defaultOptions);

        this._createClient = createClient;

        this._state = {
            nodeId: null,
            isLeader: null,
            heartbeatTimerId: null,
            redisClient: null,
            pubsubClient: null,
            watchdog: null,
        };

        this._onPubsubMessage = this._onPubsubMessage.bind(this);
        this._onWatchdog = this._onWatchdog.bind(this);
        this._emitError = this._emitError.bind(this);
        this._schedule = createScheduler();

        if (this._options.autostart) {
            this.start().catch(this._emitError);
        }
    }

    async start() {
        await this._schedule(() => this._dispatch(START));
    }

    async stop() {
        await this._schedule(() => this._dispatch(STOP));
    }

    nodeId() {
        return this._getState().nodeId;
    }

    isLeader() {
        return this._getState().isLeader;
    }

    async _dispatch(action, patch) {
        const { logger } = this._options;
        const prevState = this._getState();
        const logNodeId = (patch && patch.nodeId) || prevState.nodeId;

        switch (action) {
            case START: {
                if (prevState.isLeader !== null) break;
                logger.info('[DISPATCH]', logNodeId, action);

                await this._dispatch(SET_REDIS_CLIENT, {
                    redisClient: this._createClient({ ref: Symbol.for('nonblocking') }),
                });
                if (!prevState.nodeId) {
                    await this._dispatch(SET_NODE_ID, {
                        nodeId: await this._requestNodeId(),
                    });
                }
                await this._dispatch(SWITCH_ROLE, {
                    isLeader: await this._requestIsLeader(),
                });
                break;
            }
            case STOP: {
                if (prevState.isLeader === null) break;
                logger.info('[DISPATCH]', logNodeId, action);

                await this._dispatch(SWITCH_ROLE, { isLeader: null });
                await this._dispatch(SET_REDIS_CLIENT, { redisClient: null });
                break;
            }
            case SET_REDIS_CLIENT: {
                const { redisClient } = patch;
                if (prevState.redisClient === redisClient) break;
                logger.info('[DISPATCH]', logNodeId, action, (redisClient && redisClient.constructor.name) || null);

                if (redisClient) {
                    redisClient.defineCommand('pexpirenex', lua.pexpirenex);
                    redisClient.defineCommand('pexpireifeq', lua.pexpireifeq);
                }
                if (prevState.redisClient && !redisClient) {
                    prevState.redisClient.quit();
                }

                this._setState({ redisClient });
                break;
            }
            case SET_NODE_ID: {
                const { nodeId } = patch;
                if (prevState.nodeId === nodeId) break;
                logger.info('[DISPATCH]', nodeId, action);

                this._setState({ nodeId });
                break;
            }
            case SWITCH_ROLE: {
                const { isLeader } = patch;
                if (prevState.isLeader === isLeader) break;
                logger.info('[DISPATCH]', logNodeId, action, `${prevState.isLeader} -> ${isLeader}`);

                this._setState({ isLeader });

                // true -> null
                // true -> false
                if (prevState.isLeader === true && isLeader !== true) {
                    await this._dispatch(STOP_HEARTBEAT);
                }
                // false -> null
                // false -> true
                if (prevState.isLeader === false && isLeader !== false) {
                    await this._dispatch(STOP_WATCHDOG);
                }
                // null -> true
                // false -> true
                if (prevState.isLeader !== true && isLeader === true) {
                    await this._dispatch(START_HEARTBEAT);
                }
                // null -> false
                // true -> false
                if (prevState.isLeader !== false && isLeader === false) {
                    await this._dispatch(START_WATCHDOG);
                }

                this.emit('switch-role');

                break;
            }
            case START_WATCHDOG: {
                logger.info('[DISPATCH]', logNodeId, action);
                assert(
                    !(prevState.pubsubClient || prevState.watchdog),
                    'Invalid state: watchdog already started',
                );
                const { pubsubClient, watchdog } = this._startWatchdog();
                this._setState({ pubsubClient, watchdog });
                break;
            }
            case STOP_WATCHDOG: {
                logger.info('[DISPATCH]', logNodeId, action);
                assert(
                    prevState.watchdog,
                    'Invalid state: watchdog not started',
                );
                this._stopWatchdog();
                this._setState({ pubsubClient: null, watchdog: null });
                break;
            }
            case START_HEARTBEAT: {
                logger.info('[DISPATCH]', logNodeId, action);
                assert(
                    !prevState.heartbeatTimerId,
                    'Invalid state: heartbeat already started',
                );
                const heartbeatTimerId = this._startHeartbeat();
                this._setState({ heartbeatTimerId });
                break;
            }
            case STOP_HEARTBEAT: {
                logger.info('[DISPATCH]', logNodeId, action);
                assert(
                    prevState.heartbeatTimerId,
                    'Invalid state: heartbeat not started',
                );
                clearInterval(prevState.heartbeatTimerId);
                this._setState({ heartbeatTimerId: null });
                break;
            }
            case WATCHDOG_TRIGGER: {
                logger.info('[DISPATCH]', logNodeId, action);
                const isLeader = await this._requestIsLeader();
                if (isLeader) {
                    await this._dispatch(SWITCH_ROLE, { isLeader });
                } else {
                    await this._unlockLeader();
                }
                break;
            }
            case HEARTBEAT_FAILURE: {
                logger.info('[DISPATCH]', logNodeId, action);
                const { failoverTimeout } = this._options;
                await this._dispatch(STOP);
                await delay(failoverTimeout);
                await this._dispatch(START);
                break;
            }
            default:
        }
    }

    _getState() {
        return this._state;
    }

    _setState(state) {
        this._state = {
            ...this._state,
            ...state,
        };
    }

    _startHeartbeat() {
        const { keyPrefix, keyNodeLeaderId, failoverTimeout, heartbeatChannel } = this._options;
        const { nodeId, redisClient } = this._getState();
        const heartbeatInterval = Math.ceil(failoverTimeout / 2);

        const key = joinKey(keyPrefix, keyNodeLeaderId);

        return setInterval(
            () => {
                redisClient.get(key)
                    .then((leaderId) => {
                        if (leaderId === nodeId) {
                            redisClient.publish(heartbeatChannel, nodeId).catch(noop);
                            redisClient.pexpireifeq(key, nodeId, failoverTimeout).catch(noop);
                        } else {
                            this._dispatch(HEARTBEAT_FAILURE).catch(noop);
                        }
                        return null;
                    })
                    .catch(() => {
                        this._dispatch(HEARTBEAT_FAILURE).catch(noop);
                    });
            },
            heartbeatInterval,
        );
    }

    _startWatchdog() {
        const { failoverTimeout, heartbeatChannel } = this._options;

        const pubsubClient = this._createClient({ ref: Symbol.for('subscriber') });
        const watchdog = new Watchdog({
            timeout: failoverTimeout,
            continuous: true,
        });

        pubsubClient.on('message', this._onPubsubMessage);
        pubsubClient.subscribe(heartbeatChannel);
        watchdog.on('trigger', this._onWatchdog);

        return { pubsubClient, watchdog };
    }

    _stopWatchdog() {
        const { heartbeatChannel } = this._options;
        const { pubsubClient, watchdog } = this._getState();

        pubsubClient.unsubscribe(heartbeatChannel);
        pubsubClient.removeListener('message', this._onPubsubMessage);
        watchdog.removeListener('trigger', this._onWatchdog);
        pubsubClient.quit();
        watchdog.cancel();
    }

    _onPubsubMessage(channel) {
        if (channel !== this._options.pubsubChannel) return;

        const { watchdog } = this._getState();

        assert(
            watchdog,
            'Invalid state: watchdog not started',
        );

        watchdog.reset();
    }

    _onWatchdog() {
        this._dispatch(WATCHDOG_TRIGGER).catch(this._emitError);
    }

    async _requestNodeId() {
        const { keyPrefix, keyNodeIdSeq } = this._options;
        const { redisClient } = this._getState();
        const key = joinKey(keyPrefix, keyNodeIdSeq);

        return String(await redisClient.incr(key));
    }

    async _requestIsLeader() {
        const { keyPrefix, keyNodeLeaderId, failoverTimeout } = this._options;
        const { nodeId, redisClient } = this._getState();
        const key = joinKey(keyPrefix, keyNodeLeaderId);

        return Boolean(await redisClient.set(key, nodeId, 'px', failoverTimeout, 'nx'));
    }

    async _unlockLeader() {
        const { keyPrefix, keyNodeLeaderId, failoverTimeout } = this._options;
        const { redisClient } = this._getState();
        const key = joinKey(keyPrefix, keyNodeLeaderId);

        /*
         *  Ensure that leader key timeout was not cleared by some unknown reason
         */
        await redisClient.pexpirenex(key, failoverTimeout);
    }

    _emitError(err) {
        /*
         *  Some unicorns are here to prevent `UnhandledPromiseRejectionWarning`
         *  https://qubyte.codes/blog/promises-and-nodejs-event-emitters-dont-mix
         */
        process.nextTick(() => {
            this.emit('error', err);
        });
    }
}

RedisLeader.defaultOptions = {
    keyPrefix: 'redis-leader',
    keyNodeIdSeq: 'node_id_seq',
    keyNodeLeaderId: 'node_leader_id',
    logger: { info: noop },
    failoverTimeout: 1000,
    heartbeatChannel: '__redis-leader_heartbeat__',
    autostart: true,
};

module.exports = RedisLeader;
