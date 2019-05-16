import { isObject, isFunction, isString } from 'valid-types';
import log from './log';

let logger = null;

class StateManagerConnector {
    constructor(props, logger) {
        if (!isFunction(props.undo) || !isFunction(props.redo)) {
            log(logger, 'error', 'Editor.extends.stateManager|This is not valid StateManager object');
        }

        this.__undo = props.undo;
        this.__redo = props.redo;
    }

    saveState(undo, redo) {
        undo = this.__undo(undo);
        redo = this.__redo(redo);

        if (!undo.method && !undo.arguments) {
            undo = {
                arguments: undo
            }
        }

        if (!redo.method && !redo.arguments) {
            redo = {
                arguments: redo
            }
        }

        if (!undo.method && isString(this._fnName)) {
            undo.method = this._fnName;
        }

        if (!redo.method && isString(this._fnName)) {
            redo.method = this._fnName;
        }

        if (!undo.method || !redo.method) {
            return false;
        }

        return {
            stateManager: {
                undo,
                redo
            }
        };
    }
}

const stateManager = props => {
    return function(target, key, desc) {
        let fn = desc.value;
        let stateManager = isObject(props) ? new StateManagerConnector(props, logger) : null;

        desc.value = function(...args) {
            if (!stateManager) {
                log(logger, 'error', 'Editor.extends.stateManager|This is not valid StateManager object');
                return false;
            }
            stateManager._fnName = fn.name;

            args.push(stateManager);

            return fn.apply(this, args);
        };

        return desc;
    };
};

const createSave = props => {
    if (!logger && isObject(props)) {
        logger = props.logger || console;
    }

    return stateManager;
};

export default createSave;