import { StateManager, createSave } from '../../src';

const save = createSave();

const stateManager = new StateManager({
    limit: 20,
    getInstance: function() {
        return mymodule;
    }
});

class MyModule {
    @save({
        undo: prev => prev,
        redo: next => next
    })
    addText(text, stateManager) {
        let prevText = document.getElementById('root').innerHTML;
        document.getElementById('root').innerHTML = text;
        return stateManager.saveState(prevText, text);
    }
}

const mymodule = new MyModule();

stateManager.saveState(
    mymodule.addText('test')
);

document.getElementById('undo')
    .addEventListener('click', stateManager.undo.bind(stateManager));

document.getElementById('redo')
    .addEventListener('click', stateManager.redo.bind(stateManager));