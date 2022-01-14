import axios from "axios";
import globalConfig from "./Config";
import fs from "fs";
import commandlineHandler from "./CommandlineHandler";
import {DownloaderType} from "./interface";
import {mkdir, removeDir} from "./FileHandler";
import path from "path";
import Server from "./Server";

const config = {
    headers: {
        "user-agent": globalConfig.userAgent,
        "accept": "application/json"
    },
    withCredentials: true,
    timeout: 10000
}

class Downloader {
    private _fabricGameListURL: string;
    private _fabricLoaderListURL: string;
    private _fabricInstallerListURL: string;
    private _fabricGameList: Array<string>;
    private _fabricLoaderList: Array<string>;
    private _fabricInstallerList: Array<string>;

    constructor() {
        this._fabricGameListURL = "";
        this._fabricLoaderListURL = "";
        this._fabricInstallerListURL = "_fabricInstallerList";
        this._fabricGameList = [];
        this._fabricLoaderList = [];
        this._fabricInstallerList = [];
    }

    downloadAssets(url: string, savePath: string) {
        return new Promise<void>(async (res, rej) => {
            let processInfo = commandlineHandler.tips(`开始下载: ${url}`, "dots");
            processInfo.start();
            const writer = fs.createWriteStream(savePath);
            writer.on("finish", () => {
                writer.close();
                processInfo.succeed(`下载完成: ${url}`);
                res();
            });
            writer.on("error", (err) => {
                processInfo.fail(`下载失败: ${url}`);
                rej(err);
            });
            const response = await axios.get(url, {
                responseType: "stream",
                headers: {
                    "user-agent": globalConfig.userAgent,
                }
            });
            response.data.pipe(writer);
        });
    }

    /**
     *
     * @param _fabricGameListURL
     * @param _fabricLoaderListURL
     * @param _fabricInstallerListURL
     */
    init(_fabricGameListURL: string, _fabricLoaderListURL: string, _fabricInstallerListURL: string) {
        this._fabricGameListURL = _fabricGameListURL;
        this._fabricLoaderListURL = _fabricLoaderListURL;
        this._fabricInstallerListURL = _fabricInstallerListURL;
    }

    getFabricInfo(url: string): Promise<Array<string>> {
        return new Promise((res) =>{
            setTimeout(() => {
                axios.get(url, config).then(
                    ({data}: { data: [DownloaderType.ListResponseSel] }) => {
                        res(data.filter((i) => {
                            return i.stable;
                        }).map((i) => i.version));
                    }
                );
            }, 500);
        })
    }

    private async _askForFabricVersions(): Promise<DownloaderType.VersionAnswers> {
        let infoList = [
            {
                name: "game",
                list: this._fabricGameList,
                quiz: "请选择MC版本"
            },
            {
                name: "loader",
                list: this._fabricLoaderList,
                quiz: "请选择Fabric Loader版本"
            },
            {
                name: "installer",
                list: this._fabricInstallerList,
                quiz: "请选择Fabric Installer版本"
            }
        ];
        let questions = infoList.map((i) => commandlineHandler.getListQuestion(i.name, i.quiz, i.list));
        let prompt = await commandlineHandler.quiz(questions);
        return {
            game: prompt["game"], loader: prompt["loader"], installer: prompt["installer"]
        }
    }

    async getFabricServer(serverName: string) {
        let serverSavePath = path.resolve(globalConfig.projectDir, globalConfig.dir.Versions,`${serverName}`);
        try {
            await mkdir(serverSavePath);
            let downloadTips = commandlineHandler.tips("正在获取Fabric版本信息...", "dots");
            downloadTips.start();
            try {
                this._fabricGameList = await this.getFabricInfo(this._fabricGameListURL);
                this._fabricInstallerList = await this.getFabricInfo(this._fabricInstallerListURL);
                this._fabricLoaderList = await this.getFabricInfo(this._fabricLoaderListURL);
                downloadTips.succeed("获取版本信息成功");
                let versions = await this._askForFabricVersions();
                let url = `${this._fabricLoaderListURL}/${versions.game}/${versions.loader}/${versions.installer}/server/jar`;
                await this.downloadAssets(url, path.resolve(serverSavePath, "./server.jar"));
                try {
                    const server = new Server("server.jar", serverSavePath);
                    await server.testRun();
                    console.log("测试运行成功，请手动修改eula.txt以正常启动");
                    return serverSavePath;
                } catch (e) {
                    console.log(e);
                    console.log("测试运行失败");
                }
            } catch (err) {
                console.log(err);
                downloadTips.fail("获取版本信息失败");
            }
        } catch (e) {
            console.error(e);
            await removeDir(serverSavePath, true);
        }
    }
}

const downloader = new Downloader();

export default downloader;
