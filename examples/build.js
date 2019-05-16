const { frontendCompiler } = require('rocket-starter');
const { resolve } = require('path');

frontendCompiler({
    html: {
        template: resolve(__dirname, './index.ejs')
    }
});