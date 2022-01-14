import {checkExists, mkdir} from "./FileHandler";
import cmdHandler from "./CommandlineHandler";
import globalConfig from "./Config";
import config from "./Config";
import {ConfigType} from "./interface";
import path from "path";
import DBHandler from "./DBHandler";
import backupManager from "./BackupManager";
import ServerManager from "./ServerManager";

function * ite(len: number) {
    for (let i = 0; i < len; i++) {
        yield i;
    }
}

class Initializer {
    static async checkProjectDir() {
        let checkList = [];
        let key: keyof ConfigType.dir;
        for (key in globalConfig.dir) {
            checkList.push({
                name: key,
                path: globalConfig.dir[key]
            });
        }
        const generator = ite(checkList.length);
        for (let i of checkList) {
            let tip = cmdHandler.tips(`检查目录: ${i.name}`, "dots");
            let p = path.resolve(globalConfig.projectDir, <string>i.path)
            tip.start();
            try {
                await checkExists(p);
                tip.succeed(`目录存在: ${i.name}`);
                generator.next();
            } catch (e) {
                tip.fail(`目录: ${i.name}不存在`);
                try {
                    tip.start(`创建目录${i.name}...`);
                    await mkdir(p);
                    tip.succeed(`创建目录${i.name}完成`);
                    generator.next();
                } catch (e) {
                    console.error(e);
                    tip.fail(`创建目录${i.name}失败`);
                }
            }
        }
    }
    static async init() {
        await config.readConfig();
        await Initializer.checkProjectDir();
        await DBHandler.init();
    }

    static async test() {
        // downloader.init(config.fabricGameURL, config.fabricLoaderURL, config.fabricInstallerURL);
        // let serverName = await commandlineHandler.getServerName();
        // await downloader.getFabricServer(serverName);
        // let server = new Server(globalConfig.serverConfig.serverTarget, path.resolve(globalConfig.dir.Versions, serverName));
        // await server.start();
        // await backupManager.compress("kksk", "测试", "NeWive");
        await backupManager.decompress("kksk", "E:\\MyProject\\MCSM\\Backup\\kksk_1642175467.zip")
    }
}

export default Initializer;
