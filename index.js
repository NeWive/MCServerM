const colors = require('colors');
// const globalConfig = require('./global.config.json');
const Utils = require('./Script/Util');
const Server = require("./Script/Server");
const Stdin = require('readline');
const Frp = require("./Script/Frp");
const Event = require('events');
const TCPServer = require('./Script/TCPServer');
const HTTPServer = require('./Script/HTTPServer');
const CmdHandler = require('./Script/CmdHandler');
const Status = require('./Script/Status');
const DBHandler = require('./Script/DBHandler');
const fs = require('fs');
const ora = require('ora');
const path = require('path');

function updateBackupFileList() {
    let arr = [
        ...global.defaultPackUpFiles,
        global.saveDir
    ].join('\n');
    fs.writeFileSync(path.resolve(global.projectDir, './backup_filelist.ini'), arr);
}

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
 * saveDir
 *
 * ServerStatus: isBackingUp
 */
function init() {
    return new Promise(async (res, rej) => {
        let globalConfig = JSON.parse(fs.readFileSync(path.resolve(global.projectDir, './global.config.json')).toString());
        try {
            for(let optionName in globalConfig) {
                if (globalConfig.hasOwnProperty(optionName)) {
                    global[optionName] = globalConfig[optionName];
                }
            }
            global.saveDir = fs.readFileSync(path.resolve(global.projectDir, './server.properties')).toString().split('\n').map(i => {
                let arr = i.split('=');
                return {
                    key: arr[0],
                    value: arr[1]
                }
            }).find(i => i.key === 'level-name').value + '/';
            global.server = new Server(global.projectDir, global.serverTarget, global.serverMemoryAllocated, global.toggleGui);
            global.cmdHandler = new CmdHandler(
                global.slotNumber
            );
            global.isBackingUp = false;
            global.isRollingBack = false;
            global.toggleAutoRestart = false;
            global.manualShutdown = false;
            global.startDate = new Date(global.start);
            global.dbHandler = null;
            global.listener = new Event();
            updateBackupFileList();
            if(global.useFrp) {
                global.frp = new Frp(
                    Utils.resolveAbsolutePath([global.frpConfigDir]),
                    Utils.resolveAbsolutePath([global.frpClientDir]),
                    global.frpClientTarget
                );
            }
            if(global.useTcp) {
                global.tcpServer = new TCPServer(global.listener);
            }
            global.httpServer = new HTTPServer();
            if(global.useDB) {
                global.dbHandler = new DBHandler();
            }
            res();
        } catch(e) {
            Utils.outputLog([colors.red(e.message)]);
            rej();
        }
    });
}

function initEventListener() {
    global.listener.on('msg', (d) => {
        global.server.executeCmd('/say', [d.msg]);
    });
    global.listener.on('execute-cmd', async (obj) => {
        await cmdDispatcher(obj);
    });
    global.listener.on('joint-player', () => {
        let days = new Date().getTime() - global.startDate;
        let time = parseInt(days / (1000 * 60 * 60 * 24));
        setTimeout(() => {
            global.server.executeCmd('/say', [`Hi~ o(*￣▽￣*)ブ 欢迎来玩，我们已经开服 ${time} 天辣`]);
        }, 3000);
    });
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
        global.useFrp && await global.frp.start();
        initEventListener();
        global.useTcp && global.tcpServer.start();
        global.httpServer.start();
        global.useDB && await global.dbHandler.connectDB();

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
    }
}

async function cmdDispatcher(obj) {
    console.log(obj);
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
            global.useFrp && await global.frp.shutdown(0);
            global.useDB && global.dbHandler.close();
            process.exit();
        },
        'toggle_auto_restart': async (obj) => {
            global.toggleAutoRestart = obj.args[0] === 'true' ? true : false;
            _print([`toggleAutoRestart: ${global.toggleAutoRestart}`], 'EventDispatcher');
        },
        'frp_update': async () => {
            if(global.useFrp) {
                _print(['checking frp...'], 'EventDispatcher');
                await global.frp.updateFrp();
            } else {
                _print(['Frp unused'], 'EventDispatcher');
            }
        },
        'kill_all_frp': async () => {
            if(global.useFrp) {
                _print(['shutting down frp...'], 'EventDispatcher');
                await global.frp.shutdown(0);
            } else {
                _print(['Frp unused'], 'EventDispatcher');
            }
        },
        'display_frp_info': async () => {
            if(global.useFrp) {
                await global.frp.displayFrpList();
            } else {
                _print(['Frp unused'], 'EventDispatcher');
            }
        },
        'kill_frp': async (o) => {
            if(global.useFrp) {
                await global.frp.shutdownSingle(o.args[0]);
            } else {
                _print(['Frp unused'], 'EventDispatcher');
            }
        },
        'restart_frp': async () => {
            if(global.useFrp) {
                await global.frp.restart();
            } else {
                _print(['Frp unused'], 'EventDispatcher');
            }
        },
        'gugu': async (obj) => {
            if(global.useDB) {
                let gugu_cmd_dispatcher = {
                    'add': async (obj) => {
                        await this.dbHandler.addGuList({
                            satellite_launcher: obj.from,
                            time: new Date().getTime(),
                            gu_name: obj.args[1]
                        });
                        global.server.executeCmd('/say', [`恭喜玩家 ${obj.from} 成功放飞一颗卫星`]);
                    },
                    'list': async () => {
                        let result = (await this.dbHandler.selectGuList()).map((e) => {
                            return `卫星编号: ${e.index_number}, 卫星发射者: ${e.satellite_launcher}, 卫星: ${e.gu_name}, 发射时间: ${new Date(e.time)}, ${e.status ? '成功返回着陆场' : '现已停止了思考'}`
                        }).forEach((e) => {
                            global.server.executeCmd('/say', [e]);
                        });
                    },
                    'done': async (obj) => {
                        let res = await this.dbHandler.selectGuList({index_number: Number(obj.args[1])});
                        if(res.length > 0) {
                            await this.dbHandler.completeSatellite({index: Number(obj.args[1])});
                            global.server.executeCmd('/say', [`恭喜玩家 ${obj.from} 成功回收一颗卫星`]);
                        } else {
                            _print(['error index provided'], 'gugu_event_dispatcher');
                        }
                    }
                };
                await gugu_cmd_dispatcher[obj.args[0]](obj);
            } else {
                _print(['DB unused'], 'EventDispatcher')
            }
        },
        'display_cmd_log': async (obj) => {
            if(global.useDB) {
                let result = (await this.dbHandler.selectCmdLog());
                console.log(result);
            } else {
                _print(['DB unused'], 'EventDispatcher');
            }
        }
    }
    if(global.serverCmd.indexOf(obj.cmd) > -1 && cmdDispatch.hasOwnProperty(obj.cmd)) {
        _print([`executing ${obj.cmd}...`], 'EventDispatcher');
        global.useDB && global.dbHandler.addCmdLog({cmd: obj.cmd, executor: obj.from, time: new Date().getTime()});
        await cmdDispatch[obj.cmd](obj);
    } else {
        global.server.executeCmd(obj.cmd, obj.args);
    }
}

async function main() {
    global.projectDir = __dirname;
    console.log(
        colors.green(
            `                __  ______________  ___
               /  |/  / ___/ __/  |/  /__ ____  ___ ____ ____ ____
              / /|_/ / /___\\ \\/ /|_/ / _ \`/ _ \\/ _ \`/ _ \`/ -_) __/
             /_/  /_/\\___/___/_/  /_/\\_,_/_//_/\\_,_/\\_, /\\__/_/
                                                   /___/
            `
        )
    );
    if(process.argv.indexOf('--first-run') > -1) {
        let useFrp = false;
        let useTcp = false;
        let useDB = false;
        let fileListName = 'backup_filelist.ini';
        let salt = ''
        let configTemplate = JSON.parse(fs.readFileSync(path.resolve(global.projectDir, './Template/global.config.json')).toString());
        let cmdStdin = Stdin.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        let db = null;
        const askIf = async (question) => {
            let answer = await new Promise((res) => {
                cmdStdin.question(`${question}${colors.blue('(y/n)')}\n`, (answer) => {
                    res(answer);
                });
            });
            if (/^(y|n)$/.test(answer)) {
                return answer === 'y';
            } else {
                console.log('invalid arg, re-input');
                return await askIf(question);
            }
        }
        const askQuestion =async (question) => {
            return await new Promise((res) => {
                cmdStdin.question(`${question}\n`, (answer) => {
                    res(answer);
                });
            });
        }
        const generateTips = (text, spinner) => {
            return new ora({
                text: text + '\n',
                spinner
            });
        };
        const spinnerEnum = ['monkey', 'weather'];
        console.log('First Run');
        let manualConfProcess = generateTips('配置参数...', spinnerEnum[0]).start();
        setTimeout(async () => {
            manualConfProcess = manualConfProcess.stopAndPersist({
                symbol: '👴'
            });
            useFrp = await askIf('是否开启Frp服务？');
            configTemplate.useFrp = useFrp;
            useTcp = await askIf('是否启用TCP服务?');
            configTemplate.useTcp = useTcp;
            useDB = await askIf('是否启用数据库?');
            configTemplate.useDB = useDB;
            if (useTcp) {
                salt = await askQuestion('请输入TCP加密用salt（请与发送方提前协商好）: ');
                configTemplate.salt = salt;
            }
            configTemplate.serverMemoryAllocated = await askQuestion('请输入您想要为服务器分配的内存，例如 1g');
            manualConfProcess.succeed('完成');
            console.log(colors.green('Automatic Configuring...'));
            let dbProcess = generateTips('初始化数据库...', spinnerEnum[0]).start();
            setTimeout(async () => {
                if (useDB) {
                    try {
                        fs.mkdirSync(path.resolve(global.projectDir, './DB'));
                        fs.writeFileSync(path.resolve(global.projectDir, './DB/MCM.db'), '');
                        db = new DBHandler();
                        await db.connectDB();
                        await db.initDB();
                        dbProcess.succeed('初始化数据库成功');
                    } catch (e) {
                        console.log(e);
                        dbProcess.fail('跳过数据库初始化');
                    }
                }
                let bkProcess = generateTips('正在创建备份目录...', spinnerEnum[1]).start();
                setTimeout(() => {
                    try {
                        fs.mkdirSync(path.resolve(global.projectDir, configTemplate.backupDir));
                        bkProcess.succeed('初始化备份目录成功');
                    } catch (e) {
                        console.log(e);
                        bkProcess.fail('跳过创建备份目录');
                    }
                    let frpProcess = generateTips('正在创建Frp相关的文件夹...', spinnerEnum[0]).start();
                    setTimeout(() => {
                        try {
                            fs.mkdirSync(path.resolve(global.projectDir, configTemplate.frpClientDir));
                            fs.mkdirSync(path.resolve(global.projectDir, configTemplate.frpConfigDir));
                            frpProcess.succeed('Frp目录初始化完成');
                        } catch (e) {
                            console.log(e);
                            frpProcess.fail('跳过创建Frp目录');
                        }
                        let bkConfProcess = generateTips('正在初始化备份配置...', spinnerEnum[0]).start();
                        setTimeout(async () => {
                            let saveDir = fs.readFileSync(path.resolve(global.projectDir, './server.properties')).toString().split('\n').map(i => {
                                let arr = i.split('=');
                                return {
                                    key: arr[0],
                                    value: arr[1]
                                }
                            }).find(i => i.key === 'level-name').value;
                            fs.writeFileSync(path.resolve(global.projectDir, fileListName), [
                                ...configTemplate.defaultPackUpFiles,
                                `${saveDir}/`
                            ].join('\n'));
                            bkConfProcess.succeed('初始化备份配置完');
                            let mcProcess = generateTips('执行MC服务器First Run...', spinnerEnum[0]).start();
                            global.rules = configTemplate.rules;
                            global.serverStatusRules = configTemplate.serverStatusRules;
                            global.listener = new Event();
                            let server = null;
                            let res = await new Promise(async (res) => {
                                server = new Server(global.projectDir, configTemplate.serverTarget, configTemplate.serverMemoryAllocated, false, false);
                                let re = await server.start();
                                res(re);
                            });
                            if (res) {
                                mcProcess.succeed('MC服务器First Run完成');
                                server.executeCmd('/stop');
                            } else {
                                mcProcess.fail('MC服务器First Run 失败');
                            }
                            let gloProcess = generateTips('正在保存全局配置...', spinnerEnum[0]).start();
                            fs.writeFileSync(path.resolve(global.projectDir, './global.config.json'), JSON.stringify(configTemplate));
                            gloProcess.succeed('保存配置成功');
                            db && await db.close();
                            await cmdStdin.close();
                            process.exit();
                        }, 200)
                    }, 200);
                }, 200)
            }, 200);
        }, 200);
    } else {
        init().then(start, () => {
            Utils.outputLog(['Script failed to init, please check your configurations according to the error message']);
        });
    }
}

main();
