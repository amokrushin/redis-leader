const noop = () => {};

const createScheduler = () => {
    let lastAction = Promise.resolve();

    return (action) => {
        const scheduledAction = new Promise((resolve, reject) => {
            lastAction.then(action).then(resolve).catch(reject);
        });

        lastAction = scheduledAction.catch(noop);

        return scheduledAction;
    };
};

module.exports = createScheduler;
