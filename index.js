const colors = require('colors');
const globalConfig = require('./global.config');
const Utils = require('./Script/Util');
const Server = require("./Script/Server");
const Stdin = require('readline');
const Frp = require("./Script/Frp");
const Event = require('events');
const TCPServer = require('./Script/TCPServer');
const HTTPServer = require('./Script/HTTPServer');
const CmdHandler = require('./Script/CmdHandler');
const authority = require('./authority.config');

/**
 * global descriptions
 * projectDir: project root dir
 * frpConfigDir
 * serverMemoryAllocated
 * toggleGui
 * server: MC logic server
 * serverTarget: jar file
 * stdin
 * backupDir
 * frpClientDir
 * frpClientTarget
 * frp: Frp logic client
 * slotNumber: slotNumber
 * cmdHandler
 */
function init() {
    return new Promise(async (res, rej) => {
        try {
            for(let optionName in globalConfig) {
                if (globalConfig.hasOwnProperty(optionName)) {
                    global[optionName] = globalConfig[optionName];
                }
            }
            global.projectDir = __dirname;
            global.server = new Server(global.projectDir, global.serverTarget, global.serverMemoryAllocated, global.toggleGui);
            global.cmdHandler = new CmdHandler(
                global.slotNumber
            );
            console.log(await global.cmdHandler.getSlotsInfo());
            res();
        } catch(e) {
            Utils.outputLog([colors.red(e.message)]);
            rej();
        }
    });
}

function initEventListenner() {
    const listener = new Event();
    global.listener = listener;
    /**
     * emitters: TCPServer
     */
    global.listener.on('msg', (d) => {
        global.server.executeCmd('/say', [d.msg]);
    });
    /**
     * emitters: HTTPServer
     */
    global.listener.on('execute-cmd', ({cmd, args, from}) => {
        // global.server.executeCmd(`/${d.cmd}`, [d.args]);
        if(authority.indexOf(from) > -1) {

        } else {
            global.listener.emit('msg', { msg: 'unauthorized' });
        }
    });
}

/**
 * 开启服务器入口
 * @returns {Promise<void>}
 */
async function start() {
    // let toggleMC = await global.server.start();
    let toggleMC = false; // for frp test
    if (toggleMC) {
        /**
         * 开启Frp
         */
        global.frp = new Frp(
            Utils.resolveAbsolutePath([global.frpConfigDir]),
            Utils.resolveAbsolutePath([global.frpClientDir]),
            global.frpClientTarget
        );
        let toggleFrp = await global.frp.start();
        if(toggleFrp) {
            initEventListenner();
            global.tcpServer = new TCPServer(global.listener);
            global.tcpServer.start();
            global.httpServer = new HTTPServer();
            global.httpServer.start();

            global.stdin = Stdin.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            global.stdin.on('line', (data) => {
                if(/^\//.test(data)) {

                }
            });
        }
    }
}

/**
 * 初始化入口
 */
init().then(start, () => {
    Utils.outputLog(['Script failed to init, please check your configurations according to the error message']);
});
