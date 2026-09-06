const logger = Object.freeze({
    info: (event, metadata) => console.log(event, metadata || ''),
    warn: (event, metadata) => console.warn(event, metadata || ''),
    error: (event, metadata) => console.error(event, metadata || ''),
});

module.exports = { logger };
