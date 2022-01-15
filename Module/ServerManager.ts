import DBManager from "./DBManager";
import DBHandler from "./DBHandler";
import globalConfig from "./Config";
import path from "path";
import Server from "./Server";
import readline from "readline";
import process from "process";
import {MCServerType, MCServerManagerType, BackupManagerType} from "./interface";
import {eventNameEnum} from "./pattern";
import BackupManager from "./BackupManager";

class ServerManager {
    public isBackingUp = false;
    public isRollingBack = false;
    public toggleAutoRestart = false;
    public manualShutdown = false;
    public startDate = new Date(globalConfig.startDate);
    public serverName: string;
    public server: Server;
    public stdin: readline.Interface;
    public cmdHandler: MCServerManagerType.CmdDispatcher = {};

    constructor(serverName: string) {
        this.serverName = serverName;
        this.server = new Server(globalConfig.serverConfig.serverTarget, path.resolve(globalConfig.dir.Versions, serverName));
        this.stdin = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: "> "
        });
        this.server.on(eventNameEnum.JOINT_PLAYER, () => {
            let days = new Date().getTime() - this.startDate.getTime();
            let time = parseInt(String(days / (1000 * 60 * 60 * 24)));
            setTimeout(() => {
                this.server.executeCommand(MCServerType.Commands.SAY, [`Hi~ o(*￣▽￣*)ブ 欢迎来玩，我们已经开服 ${time} 天辣`])
            }, 3000);
        });

        this.server.on(eventNameEnum.SERVER_CLOSE, async () => {
            if (this.manualShutdown) {
                this.stdin.close();
                console.log("stdin 关闭");
                DBHandler._service.close();
                console.log("DB 连接关闭");
                console.log(this.server._server.killed);
                process.exit();
            }
        });

        this.cmdHandler.backup = async (obj: MCServerManagerType.CmdType) => {
            if (!this.isBackingUp && !this.isRollingBack) {
                this.isBackingUp = true;
                this.server.once(eventNameEnum.SAVE_OFF_DONE, () => {
                    this.server.once(eventNameEnum.SAVE_ALL_DONE, async () => {
                        console.log("backup preparation done");
                        try {
                            await BackupManager.compress(this.serverName, obj.args[0], obj.from);
                            this.server.executeCommand(MCServerType.Commands.SAVE_ON);
                            this.server.executeCommand(MCServerType.Commands.SAY, ["backup complete"]);
                        } catch (e) {
                            console.log(e);
                        } finally {
                            this.isBackingUp = false;
                        }
                    });
                    this.server.executeCommand(MCServerType.Commands.SAVE_ALL, ['flush']);
                });
                this.server.executeCommand(MCServerType.Commands.SAVE_OFF);
            } else if(this.isBackingUp) {
                this.server.executeCommand(MCServerType.Commands.SAY, ['BackingUp is processing, please wait']);
            } else if(this.isRollingBack) {
                this.server.executeCommand(MCServerType.Commands.SAY, ['RollingBack is processing, please wait']);
            }
        }

        this.cmdHandler.slot_list = async () => {
            try {
                this.server.executeCommand(MCServerType.Commands.SAY, ["backup slot list: "]);
                let result = <Array<BackupManagerType.BackupLogType>>(await BackupManager.getSlotsInfo(this.serverName));
                result.forEach((item, index) => {
                    this.server.executeCommand(MCServerType.Commands.SAY, [`slot_index: ${index}, slot_name: ${item.archiveName}, slot_tips: ${item.tips}, slot_executor: ${item.executor}`])
                });
            } catch (e) {
                console.log(e);
            }
        }

        this.cmdHandler.rollback = async (obj) => {
            if(!this.isRollingBack && !this.isBackingUp) {
                let slotIndex = Number(obj.args[0]);
                if (slotIndex >= 0 && slotIndex < globalConfig.backupConfig.slotNumber) {
                    this.isRollingBack = true;
                    console.log("waiting for closing of server ...");
                    this.server.once('server-close',async () => {
                        console.log("server closed ...");
                        console.log("starting to roll back ...");
                        await BackupManager.decompress(this.serverName, slotIndex);
                        console.log("roll back complete ...")
                        this.isRollingBack = false;
                        // await this.run(true);
                    });
                    this.server.executeCommand(MCServerType.Commands.STOP);
                } else {
                    this.server.executeCommand(MCServerType.Commands.SAY, ['Error slot index']);
                }
            } else if(this.isBackingUp) {
                this.server.executeCommand(MCServerType.Commands.SAY, ['BackingUp is processing, please wait']);
            } else if(this.isRollingBack) {
                this.server.executeCommand(MCServerType.Commands.SAY, ['RollingBack is processing, please wait']);
            }
        }

        this.cmdHandler.stop = async () => {
            this.manualShutdown = true;
            this.server.executeCommand(MCServerType.Commands.STOP);
        }

        this.cmdHandler.gugu = async (obj) => {
            let gugu_cmd_dispatcher: MCServerManagerType.CmdDispatcher = {
                'add': async (obj: MCServerManagerType.CmdType) => {
                    await DBManager.addGuList(
                        obj.from,
                        new Date().getTime(),
                        obj.args[1]
                    );
                    this.server.executeCommand(MCServerType.Commands.SAY, [`恭喜玩家 ${obj.from} 成功放飞一颗卫星`]);
                },
                'list': async () => {
                    (await DBManager.selectGuList()).map((e: MCServerManagerType.Satellite) => {
                        return `卫星编号: ${e.index_number}, 卫星发射者: ${e.satellite_launcher}, 卫星: ${e.gu_name}, 发射时间: ${new Date(e.time)}, ${e.status ? '成功返回着陆场' : '现已停止了思考'}`
                    }).forEach((e: string) => {
                        console.log(e);
                        this.server.executeCommand(MCServerType.Commands.SAY, [e]);
                    });
                },
                'done': async (obj: MCServerManagerType.CmdType) => {
                    let res = await DBManager.selectGuList(Number(obj.args[1]));
                    if(res.length > 0) {
                        await DBManager.completeSatellite(Number(obj.args[1]));
                        this.server.executeCommand(MCServerType.Commands.SAY, [`恭喜玩家 ${obj.from} 成功回收一颗卫星`]);
                    } else {
                        console.log("error index provided");
                    }
                }
            };
            await gugu_cmd_dispatcher[obj.args[0]](obj);
        }
    }

    async cmdDispatcher(obj: MCServerManagerType.CmdType) {
        if(globalConfig.serverCmd.indexOf(obj.cmd) > -1 && this.cmdHandler.hasOwnProperty(obj.cmd)) {
            console.log(`executing ${obj.cmd}...`);
            await DBManager.addCmdLog(obj.cmd, obj.from, new Date().getTime());
            await this.cmdHandler[obj.cmd](obj);
        } else {
            this.server.executeCommand(`/${obj.cmd}`, obj.args);
        }
    }

    async run(manual: boolean = false) {
        let isMCServerOn = await this.server.start();
        if (isMCServerOn && !manual) {
            this.stdin.on("line", (d) => {
                if (/^\//.test(d)) {
                    let parsed = d.split(' ');
                    let cmd = parsed[0];
                    parsed.splice(0, 1);
                    console.log({
                        cmd: cmd.split('/')[1],
                        args: parsed,
                        from: 'Server'
                    });
                    this.cmdDispatcher({
                        cmd: cmd.split('/')[1],
                        args: parsed,
                        from: 'Server'
                    }).catch(e => {
                        console.log(e);
                    });
                }
            });
        }
    }
}

export default ServerManager;
