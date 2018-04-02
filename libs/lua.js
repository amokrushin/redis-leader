const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '../lua');

function loadScript(name) {
    return fs.readFileSync(path.join(SCRIPTS_DIR, `${name}.lua`), 'utf8');
}

const scripts = {
    ping: {
        numberOfKeys: 0,
        lua: loadScript('ping'),
    },
    pexpirenex: {
        numberOfKeys: 1,
        lua: loadScript('pexpirenex'),
    },
    pexpireifeq: {
        numberOfKeys: 1,
        lua: loadScript('pexpireifeq'),
    },
};

module.exports = scripts;
