const Redis = require('ioredis');

Redis.Promise.onPossiblyUnhandledRejection((err) => {
    throw err;
});

module.exports = () => {
    const redis = new Redis({
        host: process.env.REDIS_HOST,
        retryStrategy: () => false,
    });
    redis.once('error', (err) => {
        throw err;
    });
    return redis;
};
