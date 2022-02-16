import {checkExists, mkdir} from "./FileHandler";
import cmdHandler from "./CommandlineHandler";
import globalConfig from "./Config";
import config from "./Config";
import {ConfigType} from "./interface";
import path from "path";
import DBHandler from "./DBHandler";
import backupManager from "./BackupManager";
import ServerManager from "./ServerManager";
import downloader from "./Downloader";

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
    static async testGetFabricServer() {
        await downloader.requestFabricInfo();
        console.log(downloader._fabricInstallerList);
        console.log(downloader._fabricLoaderList);
        console.log(downloader._fabricGameList);
        console.log(downloader._fabricAPIVersions);
        await downloader.getFabricServer("test", "1.18", "0.13.1", "0.10.2", "0.46.4+1.18");
    }
    static async testServerManager() {
        try {
            let serverManager = new ServerManager("test");
            await serverManager.run();
        } catch (e) {
            console.log(e);
        }
    }

    static async test() {

    }
}

export default Initializer;
