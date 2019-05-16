import { isString, isObject, isFunction } from 'valid-types';

const log = (logger, level, message) => {
    if (logger && isFunction(logger[level]) && isString(message)) {
        logger[level](message);
    }
};

export default log;