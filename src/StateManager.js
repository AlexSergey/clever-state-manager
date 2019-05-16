/**
 * Created by Sergey Aleksandrov (gooddev.sergey@gmail.com) on 30.06.2017.
 */
import LimitedArray from 'limited-array';
import { isFunction, isObject, isAsync, isArray, isString, isDefined, isEmptyObject, isNumber } from 'valid-types';
import { asyncLoop } from '@alexsergey/async-loop';
import log from './log';

// Сохранение проходит в два этапа:
// - В начале действия мы вызываем stateManager.saveState() и записываем в него параметр undo и вспомогательный (необязательный) параметр opt
// - opt может иметь имя экшена,
// Сохраняемый объект в saveState имеет вид:
// saveState({instanceId, method, arguments, after, before})
// instanceId - ид редактора, если редакторов много на странице и они могут быть удалены
// method - если редактор может быть удален, как на коллаже, то передаем строкой имя метода, если нет, то передавать ссылку на функцию
// arguments - аргумент, или массив аргументов, передаваемых в метод
// after, before - два каллбека-мидлварки, могут быть асинхронные

class StateManager {
    constructor(props) {
        this.limit = props.limit || 10;
        this.idField = props.idField || 'instanceID';
        this.getInstance = isFunction(props.getInstance) ? props.getInstance : null;
        this.onIncrement = props.onIncrement || null;
        this.onDecrement = props.onDecrement || null;
        this.onRemoveFirst = props.onRemoveFirst || null;
        this.logger = props.logger || console;
        this.allActions = 0;
        this.index = 0;
        this.queue = new LimitedArray({ limit: this.limit });
    }

    /*
     * If we click undo, and make something modifies, all stack will be clear and replace
     * */
    somethingHasBeenChanged() {
        if (this.index !== this.queue.getLength()) {
            log(this.logger, 'info', 'StateManager.stack|Stack overflow, next items will be deleted');
            let l = this.queue.getLength();
            let prevIndex = this.index;
            let prevLength = l;
            this.queue.splice(this.index, l);
            this.index = this.queue.getLength();
            let currentIndex = this.index;
            let currentLength = this.queue.getLength();

            if (isFunction(this.onRemoveFirst)) {
                this.onRemoveFirst.call(this, prevIndex, prevLength, currentIndex, currentLength);
            }
        }
    }

    reset() {
        log(this.logger, 'info', 'StateManager.stack|Reset stack');
        this.index = 0;
        this.queue.reset();
    }

    _findInstance(id) {
        if (isFunction(this.getInstance)) {
            return this.getInstance(id);
        }
        return false;
    }

    undo(steps) {
        steps = isNumber(steps) ? Math.abs(steps) : undefined;

        return new Promise((resolve, reject) => {
            if ((this.index > 0 && !steps) || (steps && steps >= 0)) {
                let commands = [];
                let afterAll = [];
                if (!!steps) {
                    Array.apply(null, Array(steps)).forEach(() => {
                        this.__decrementIndex();
                        if (isArray(this.queue.at(this.index).command)) {
                            commands.push(this.queue.at(this.index).command.map(item => item.undo));

                            if (isFunction(this.queue.at(this.index).afterAllUndo)) {
                                afterAll.push(this.queue.at(this.index).afterAllUndo);
                            }
                        } else {
                            commands.push(this.queue.at(this.index).command.undo);

                            if (isFunction(this.queue.at(this.index).afterAllUndo)) {
                                afterAll.push(this.queue.at(this.index).afterAllUndo);
                            }
                        }
                    });
                } else {
                    this.__decrementIndex();
                    if (isArray(this.queue.at(this.index).command)) {
                        commands.push(this.queue.at(this.index).command.map(item => item.undo));

                        if (isFunction(this.queue.at(this.index).afterAllUndo)) {
                            afterAll.push(this.queue.at(this.index).afterAllUndo);
                        }
                    } else {
                        commands.push(this.queue.at(this.index).command.undo);

                        if (isFunction(this.queue.at(this.index).afterAllUndo)) {
                            afterAll.push(this.queue.at(this.index).afterAllUndo);
                        }
                    }
                }

                this._runCommands(commands).then(() => {
                    if (afterAll.length > 0) {
                        asyncLoop(
                            afterAll,
                            (afterAllCb, loop) => {
                                if (isFunction(afterAllCb)) {
                                    let __afterAll = afterAllCb();

                                    if (isAsync(__afterAll)) {
                                        return __afterAll
                                            .then(loop.next)
                                            .catch(reject);
                                    }
                                }
                                return loop.next();
                            },
                            resolve
                        );
                    } else {
                        resolve();
                    }
                });
            } else {
                reject();
            }
        });
    }

    __incrementIndex() {
        this.index++;
        if (isFunction(this.onIncrement)) {
            this.onIncrement(this.index);
        }
    }

    __decrementIndex() {
        this.index--;
        if (isFunction(this.onDecrement)) {
            this.onIncrement(this.index);
        }
    }

    redo(steps) {
        steps = isNumber(steps) ? Math.abs(steps) : undefined;

        return new Promise((resolve, reject) => {
            if (
                (this.index >= 0 && !steps && this.index <= this.queue.getLength() - 1) ||
                (steps && this.index >= 0 && steps <= this.queue.getLength())
            ) {
                let commands = [];
                let afterAll = [];

                if (!!steps) {
                    Array.apply(null, Array(steps)).forEach(() => {
                        if (isArray(this.queue.at(this.index).command)) {
                            commands.push(this.queue.at(this.index).command.map(item => item.redo));

                            if (isFunction(this.queue.at(this.index).afterAllRedo)) {
                                afterAll.push(this.queue.at(this.index).afterAllRedo);
                            }
                        } else {
                            commands.push(this.queue.at(this.index).command.redo);

                            if (isFunction(this.queue.at(this.index).afterAllRedo)) {
                                afterAll.push(this.queue.at(this.index).afterAllRedo);
                            }
                        }
                        this.__incrementIndex();
                    });
                } else {
                    if (isArray(this.queue.at(this.index).command)) {
                        commands.push(this.queue.at(this.index).command.map(item => item.redo));

                        if (isFunction(this.queue.at(this.index).afterAllRedo)) {
                            afterAll.push(this.queue.at(this.index).afterAllRedo);
                        }
                    } else {
                        commands.push(this.queue.at(this.index).command.redo);

                        if (isFunction(this.queue.at(this.index).afterAllRedo)) {
                            afterAll.push(this.queue.at(this.index).afterAllRedo);
                        }
                    }
                    this.__incrementIndex();
                }

                this._runCommands(commands)
                    .then(() => {
                        if (afterAll.length > 0) {
                            asyncLoop(
                                afterAll,
                                (afterAllCb, loop) => {
                                    if (isFunction(afterAllCb)) {
                                        let __afterAll = afterAllCb();

                                        if (isAsync(__afterAll)) {
                                            return __afterAll
                                                .then(loop.next)
                                                .catch(reject);
                                        }
                                    }
                                    return loop.next();
                                },
                                resolve
                            );
                        } else {
                            resolve();
                        }
                    })
                    .catch(reject);
            } else {
                reject();
            }
        });
    }

    _normalize(commands) {
        if (isObject(commands)) {
            if (commands.stateManager) {
                return commands.stateManager;
            }
            return commands;
        }
        if (isArray(commands)) {
            return commands.map(command => {
                if (command.stateManager) {
                    return command.stateManager;
                }
                return command;
            });
        }
        return false;
    }

    _validationCommand(commands) {
        let isValidCommand = false;

        if (isObject(commands)) {
            if (commands.undo && commands.redo) {
                isValidCommand = true;
            }
        }
        if (isArray(commands)) {
            let validCommands = commands.filter(command => {
                return command && command.undo && command.redo;
            });
            if (validCommands.length > 0) {
                isValidCommand = true;
            }
        }

        return isValidCommand;
    }

    saveState(commands, afterAllUndo, afterAllRedo) {
        commands = this._normalize(commands);

        let isValidCommand = this._validationCommand(commands);

        if (isValidCommand) {
            this.allActions += 1;
            this.somethingHasBeenChanged();
            this.__incrementIndex();
            let firstItemDeleted = this.queue.add({
                command: commands,
                afterAllUndo: afterAllUndo,
                afterAllRedo: afterAllRedo
            });

            if (firstItemDeleted) {
                this.__decrementIndex();
            }

            log(this.logger, 'info', `stateManager.saveState|saved${firstItemDeleted ? ' first item deleted' : ''}`);

            return firstItemDeleted;
        }
        if (isArray(commands)) {
            log(this.logger, 'error', `stateManager.saveState|Invalid commands object - "${commands.map(c => isObject(c) ? JSON.stringify(c) : c).join(', ')}"`);
        }
        else {
            log(this.logger, 'error', `stateManager.saveState|Invalid commands object - "${isObject(commands) ? JSON.stringify(commands) : commands}"`);
        }
    }

    getAllActionsCounter() {
        return this.allActions;
    }

    _runCommands(commands) {
        this.allActions += 1;
        let errors = [];
        let _this = this;
        function restoreSingle(commands) {
            return new Promise((resolve, reject) => {
                asyncLoop(
                    commands,
                    (command, loop) => {
                        let _arguments = isDefined(command.arguments) ? command.arguments : [];

                        let args = isArray(_arguments) ? _arguments : [_arguments];
                        let instance = null;

                        if (isString(command.method)) {
                            let id = isString(_this.idField) ? command[_this.idField] : false;
                            instance = _this._findInstance(id ? id : undefined);

                            if (!!instance) {
                                command.instance = instance;
                            }
                        }

                        if (isFunction(command.before)) {
                            let ctx = command.ctx ? command.ctx : command.before;
                            let _before = command.before.call(ctx, command);

                            if (isAsync(_before)) {
                                _before
                                    .then(runCommand)
                                    .catch(reject);
                            } else {
                                runCommand(_before);
                            }
                        } else {
                            runCommand();
                        }

                        function runCommand(..._args) {
                            let _command;
                            let ctx = command.ctx ? command.ctx : command.method;

                            if (!!instance) {
                                _command = instance[command.method].apply(ctx, args.concat(_args));
                            } else if (isFunction(command.method)) {
                                _command = command.method.apply(ctx, args.concat(_args));
                            } else {
                                return false;
                            }

                            if (isAsync(_command)) {
                                _command
                                    .then(__args => {
                                        if (isFunction(command.after)) {
                                            let ctx = command.ctx ? command.ctx : command.method;
                                            let _after = command.after.call(ctx, __args, command);
                                            if (isAsync(_after)) {
                                                _after.then(loop.next);
                                            } else {
                                                return loop.next();
                                            }
                                        } else {
                                            return loop.next();
                                        }
                                    })
                                    .catch(err => {
                                        err = isString(err) ? err : 'Cant restore action';
                                        errors.push(err);
                                        return loop.next();
                                    });
                            } else {
                                return loop.next();
                            }
                        }
                    },
                    () => {
                        if (errors.length > 0) {
                            log(this.logger, 'error', `StateManager.run|${errors.reduce((a, b) => {
                                a += b;
                                return a;
                            }, '')}`);
                        }
                        resolve();
                    }
                );
            });
        }
        // Если мы манипулируем несколькими канвасами, мы работаем с массивом инстансов массивов команд, то есть с массивом массивов
        // Если мы передаем в History количество шагов, которые надо откатить, это будет массив комманд
        if (isArray(commands)) {
            return new Promise((resolve, reject) => {
                asyncLoop(
                    commands,
                    (command, loop) => {
                        let _commands = isArray(command) ? command : [command];
                        restoreSingle(_commands)
                            .then(loop.next)
                            .catch(reject);
                    },
                    resolve
                );
            });
        } else if (typeof commands === 'object') {
            // Простейший способ, если у нас обычная одна команда
            return restoreSingle([commands]);
        }
    }
}

export default StateManager;