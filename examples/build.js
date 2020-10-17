const { frontendCompiler } = require('@rockpack/compiler');
const { resolve } = require('path');

frontendCompiler({
    html: {
        template: resolve(__dirname, './index.ejs')
    }
});
