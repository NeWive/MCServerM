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
const serverCmd = require('./serverCmd.config');
const Status = require('./Script/Status');
const DBHandler = require('./Script/DBHandler');

// TODO: cmd log
// TODO: gugu_list

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
 * toggleAutoRestart
 * DBHandler
 *
 * ServerStatus: isBackingUp
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

            // init Server Status
            global.isBackingUp = false;
            global.isRollingBack = false;
            global.toggleAutoRestart = false;
            global.manualShutdown = false;

            global.startDate = new Date(global.start);

            global.dbHandler = new DBHandler();
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
    global.listener.on('execute-cmd', async (obj) => {
        // obj: {cmd, args, from}
        // global.server.executeCmd(`/${d.cmd}`, [d.args]);
	    console.log(obj);
        if(authority.indexOf(obj.from) > -1) {
            await cmdDispatcher(obj);
        } else {
            global.server.executeCmd('/say', ['unauthorized']);
        }
    });
    /**
     * emitters: new player
     */
    global.listener.on('joint-player', () => {
        let days = new Date().getTime() - global.startDate;
        let time = parseInt(days / (1000 * 60 * 60 * 24));
        setTimeout(() => {
            global.server.executeCmd('/say', [`Hi~ o(*￣▽￣*)ブ 欢迎来玩，我们已经开服 ${time} 天辣`]);
        }, 3000);
    });
    /**
     * toggle-auto-restart
     */
    global.listener.on('server-close', async () => {
        if(global.toggleAutoRestart && !global.isRollingBack && !global.manualShutdown) {
            await start(true);
        }
    });
}

/**
 * 开启服务器入口
 * @returns {Promise<void>}
 */
async function start(manual = false) {
    let toggleMC = await global.server.start();
    // let toggleMC = true; // for frp test
    if (toggleMC && !manual) {
        /**
         * 开启Frp
         */
        global.frp = new Frp(
            Utils.resolveAbsolutePath([global.frpConfigDir]),
            Utils.resolveAbsolutePath([global.frpClientDir]),
            global.frpClientTarget
        );
        await global.frp.start();
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
                let parsed = data.split(' ');
                let cmd = parsed[0];
                parsed.splice(0, 1);
                global.listener.emit('execute-cmd', {
                    cmd: cmd.split('/')[1],
                    args: parsed,
                    from: 'NeWive'
                });
            }
        });
        global.stdin.setPrompt('> 请输入');
        // await global.dbHandler.init();
    }
}

/**
 * dispatch cmd
 * @param {} obj
 */
async function cmdDispatcher(obj) {
    let _print = (msgArr, source) => {
        msgArr.forEach(msg => {
            Utils.outputLog([colors.green(`[${source}]: `) + msg]);
        });
    }
    let cmdDispatch = {
        'backup': async (obj) => {
            if(!global.isBackingUp && !global.isRollingBack) {
                global.isBackingUp = true;
                await new Promise(async (prepareRes) => {
                    await new Promise((res) => {
                        _print(['waiting for save-off...'], 'EventDispatcher');
                        global.listener.once('save-off-done', () => {
                        //Automatic saving is now disabled
                           res();
                        });
                        global.server.executeCmd('/save-off');
                    }).then(() => {
                        _print(['waiting for save-all...'], 'EventDispatcher');
                        global.listener.once('save-all-done', () => {
                            // Saved the game
                            _print(['backup preparation done'], 'EventDispatcher');
                            prepareRes();
                        });
                        global.server.executeCmd('/save-all', ['flush']);
                    });
                });
                await global.cmdHandler.backup(obj.args[0], obj.from);
                global.server.executeCmd('/save-on');
                global.server.executeCmd('/say', ['backup complete.']);
                global.isBackingUp = false;
            } else if(global.isBackingUp) {
                global.server.executeCmd('/say', ['BackingUp is processing, please wait']);
            } else if(global.isRollingBack) {
                global.server.executeCmd('/say', ['RollingBack is processing, please wait']);
            }
        },
        'slot_list': async () => {
            global.server.executeCmd(`/say`, ['backup slot list: ']);
            let result = await global.cmdHandler.getSlotsInfo();
            let data = result.data;
            data.forEach((item, index) => {
                global.server.executeCmd(`/say`, [`slot_index: ${index}, slot_name: ${item.name}, slot_tips: ${item.tips}, slot_executer: ${item.executer}`]);
            });
        },
        'rollback': async (obj) => {
            if(!global.isRollingBack && !global.isBackingUp) {
                global.manualShutdown = true;
                let previousToggleAutoRestart = global.toggleAutoRestart;
                global.isRollingBack = true;
                global.toggleAutoRestart = false;
                _print(['waiting for closing of server ...'], 'EventDispatcher');
                _print(['starting to roll back ...'], 'EventDispatcher');
                let result = await global.cmdHandler.rollback(obj.args[0]);
                _print(['roll back complete ...'], 'EventDispatcher');
                global.isRollingBack = false;
                global.toggleAutoRestart = previousToggleAutoRestart;
                global.manualShutdown = false;
                result.status === Status.OK && start(true);
            } else if(global.isBackingUp) {
                global.server.executeCmd('/say', ['BackingUp is processing, please wait']);
            } else if(global.isRollingBack) {
                global.server.executeCmd('/say', ['RollingBack is processing, please wait']);
            }
        },
        'stop': async () => {
            global.manualShutdown = true;
            _print(['waiting for closing of server ...'], 'EventDispatcher');
            await new Promise((closeRes) => {
                global.listener.once('server-close', () => {
                    _print(['server closed ...'], 'EventDispatcher');
                        closeRes();
                });
                global.server.executeCmd('/stop');
            });
            await global.frp.shutdown(0);
            process.exit();
        },
        'toggle_auto_restart': async (obj) => {
            global.toggleAutoRestart = obj.args[0] === 'true' ? true : false;
            _print([`toggleAutoRestart: ${global.toggleAutoRestart}`], 'EventDispatcher');
        },
        'frp_update': async () => {
            _print(['checking frp...'], 'EventDispatcher');
            await global.frp.updateFrp();
        },
        'kill_all_frp': async () => {
            _print(['shutting down frp...'], 'EventDispatcher');
            await global.frp.shutdown(0);
        },
        'display_frp_info': async () => {
            await global.frp.displayFrpList();
        },
        'kill_frp': async (o) => {
            await global.frp.shutdownSingle(o.args[0]);
        },
        'restart_frp': async () => {
            await global.frp.restart();
        },
        'display_cmd_log': async (obj) => {
            await global.dbHandler.show('command_log', obj.args[0]);
        }
    }
    if(serverCmd.indexOf(obj.cmd) > -1 && cmdDispatch.hasOwnProperty(obj.cmd)) {
        // log
        _print([`executing ${obj.cmd}...`], 'EventDispatcher');
        await cmdDispatch[obj.cmd](obj);
        // await global.dbHandler.insert('command_log', {cmd: obj.cmd, timestamp: `${new Date().getTime()}`, executor: obj.from}, 'cmd');
    } else {
        global.server.executeCmd(obj.cmd, obj.args);
    }
}

/**
 * 初始化入口
 */
init().then(start, () => {
    Utils.outputLog(['Script failed to init, please check your configurations according to the error message']);
});
