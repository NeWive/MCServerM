import fetch, {Response} from "node-fetch";
import globalConfig from "./Config";
import {DownloaderType} from "./interface";
import {mkdir, downloadAssets, writeFile, readFile} from "./FileHandler";
import path from "path";
import cheerio from "cheerio";
import child_process from "child_process";
import dbManager from "./DBManager";
import userAgent from "../ua.config.json";

// TODO: 添加各种缓存
// TODO: 关于Forge的初始化问题
class Downloader {
    public _fabricGameList: Array<string>;
    public _fabricLoaderList: Array<string>;
    public _fabricInstallerList: Array<string>;
    public _fabricSelectedVersions!: DownloaderType.VersionAnswers;
    public _fabricAPIVersions!: DownloaderType.FabricAPIVersions;
    public _pureServerList!: Array<string>;

    constructor() {
        this._fabricGameList = [];
        this._fabricLoaderList = [];
        this._fabricInstallerList = [];
        this._fabricSelectedVersions = {
            installer: "",
            game: "",
            loader: "",
            fabricAPI: ""
        }
    }

    private static async _resolveFabricResponse(data: Response) {
        const j = <[DownloaderType.ListResponseSel]>await data.json();
        return j.filter((i) => {
            return i.stable;
        }).map((i) => i.version);
    }

    private _request(url: string, dataResolver: (data: Response) => any) {
        return new Promise((res, rej) => {
            // TODO: 超时异常无法捕获
            setTimeout(() => {
                console.log(url);
                let item = userAgent[Math.floor(Math.random()*userAgent.length)];
                console.log(item);
                fetch(url, {
                    timeout: 20000,
                    headers: {
                        "User-Agent": item
                    }
                }).then(async (data) => {
                    res(await dataResolver(data));
                }, (err) => {
                    rej(err);
                });
            }, 1000);
        });
    }

    private static async _fabricAPIResponseResolver(data: Response) {
        const root = cheerio.load(await data.text());
        const listsHyperLinkDOM = root("a");
        let hyperLinkTitleList = listsHyperLinkDOM.text().split("/");
        hyperLinkTitleList.splice(0, 1);
        hyperLinkTitleList = hyperLinkTitleList.filter(i => !/(build|maven|experimental)/.test(i));
        const fabricAPIVersions = new Map<string, Array<string>>();
        for (let i of hyperLinkTitleList) {
            let temp = i.split("+");
            let MCVersion = temp[1];
            if (fabricAPIVersions.has(MCVersion)) {
                let prevList = <Array<string>>(fabricAPIVersions.get(MCVersion));
                prevList.push(temp[0]);
                fabricAPIVersions.set(MCVersion, prevList);
            } else {
                fabricAPIVersions.set(MCVersion, [temp[0]]);
            }
        }
        for (let i of fabricAPIVersions.keys()) {
            (<Array<string>>(fabricAPIVersions.get(i))).sort((a, b) => {
                let an = Number(a.replace(".", ""));
                let bn = Number(b.replace(".", ""));
                return bn - an;
            });
        }
        return fabricAPIVersions;
    }

    private static async _pureServerVersionResolver(data: Response) {
        const root = cheerio.load(await data.text());
        return root(".grid").children(":first-child").children(".items").children(".item").toArray().map((e) => {
            return cheerio(e).attr("id");
        }).filter((i => i && i));
    }

    private static async _pureServerURLResolver(data: Response) {
        const root = cheerio.load(await data.text());
        return root("a[download]").attr("href");
    }

    private static async _forgeURLResolver(data: Response) {
        const root = cheerio.load(await data.text());
        return root("a[title=Installer]").attr("href");
    }

    public async requestFabricInfo() {
        try {
            console.log("获取FabricGame信息...");
            this._fabricGameList = <Array<string>>await this._request(globalConfig.fabricGameURL, Downloader._resolveFabricResponse);
            console.log("获取FabricInstaller信息...");
            this._fabricInstallerList = <Array<string>>await this._request(globalConfig.fabricInstallerURL, Downloader._resolveFabricResponse);
            console.log("获取FabricLoader信息...");
            this._fabricLoaderList = <Array<string>>await this._request(globalConfig.fabricLoaderURL, Downloader._resolveFabricResponse);
            console.log("获取FabricAPI信息...");
            this._fabricAPIVersions = <DownloaderType.FabricAPIVersions>await this._request(globalConfig.fabricAPISourceURL, Downloader._fabricAPIResponseResolver);
        } catch (e) {
            console.log(e);
            throw e;
        }
    }

    private async _installForge(serverSavePath: string) {
        return new Promise((res, rej) => {
            const process = child_process.spawn("java", ["-jar", "forge.jar", "nogui", "--installServer"], {
                cwd: serverSavePath
            });
            process.stdout.on("data", (data) => {
                console.log(data.toString());
            });
            process.stdout.on("error", (err) => {
                console.error(err);
                rej(err);
            });
            process.stderr.on("data", (err) => {
                console.log(err);
                rej(err);
            });
            process.on("exit", (code) => {
                console.log(`forge安装完成, return code: ${code}`);
                res(true);
            })
        })
    }

    public async getFabricServer(serverName: string, gameVer: string, loaderVer: string, installerVer: string, apiVer: string) {
        let serverSavePath = path.resolve(globalConfig.dir.Versions, `${serverName}`);
        let url = `${globalConfig.fabricLoaderURL}/${gameVer}/${loaderVer}/${installerVer}/server/jar`;
        console.log(url);
        try {
            await mkdir(serverSavePath);
            await mkdir(path.resolve(serverSavePath, "mods"));
            await downloadAssets(url, path.join(serverSavePath, "server.jar"), globalConfig.headers[0]);
            // TODO: 是否保留默认下载FabricAPI
            const targetName = `fabric-api-${apiVer}.jar`;
            const apiURL = `${globalConfig.fabricAPISourceURL}/${apiVer}/${targetName}`;
            await downloadAssets(apiURL, path.join(serverSavePath, "mods/", targetName), globalConfig.headers[1]);
            console.log("默认写入EULA");
            await writeFile(path.join(serverSavePath, "eula.txt"), "eula=true");
            dbManager.addServerInfo(serverName).then(() => {
                console.log("添加Fabric服务器信息成功");
            });
        } catch (e) {
            throw e;
        }
    }

    public async requestPureInfo() {
        try {
            console.log("获取原版服务端信息...");
            this._pureServerList = <Array<string>>(await this._request(globalConfig.pureServerURL, Downloader._pureServerVersionResolver));
        } catch (e) {
            throw e;
        }
    }

    public async getPureServer(serverVer: string, serverName: string) {
        let serverSavePath = path.resolve(globalConfig.dir.Versions, `${serverName}`);
        try {
            console.log("解析服务端URL...");
            const serverURL = <string>await this._request(`${globalConfig.pureServerURL}download/${serverVer}`, Downloader._pureServerURLResolver);
            console.log(`服务端链接: ${serverURL}`);
            await mkdir(serverSavePath);
            console.log("下载原版服务端...")
            await downloadAssets(serverURL, path.join(serverSavePath, "server.jar"), globalConfig.headers[0]);
            console.log("默认写入EULA");
            await writeFile(path.join(serverSavePath, "eula.txt"), "eula=true");
            dbManager.addServerInfo(serverName).then(() => {
                console.log("添加原版服务器信息成功");
            });
        } catch (e) {
            throw e;
        }
    }

    public async getForgeServer(serverVer: string, serverName: string) {
        let serverSavePath = path.resolve(globalConfig.dir.Versions, `${serverName}`);
        try {
            await this.getPureServer(serverVer, serverName);
            console.log("解析forge下载链接...");
            const forgeURL = (<string>await this._request(`https://files.minecraftforge.net/net/minecraftforge/forge/index_${serverVer}.html`, Downloader._forgeURLResolver)).split("url=")[1];
            console.log(`forge链接: ${forgeURL}`);
            await downloadAssets(forgeURL, path.join(serverSavePath, "forge.jar"), globalConfig.headers[0]);
            console.log("下载完成，开始安装forge...");
            await this._installForge(serverSavePath);
            const target = await readFile(serverVer)
            // dbManager.addServerInfo(serverName).then(() => {
            //     console.log("添加Forge服务器信息成功");
            // });
            console.log("默认写入EULA");
            await writeFile(path.join(serverSavePath, "eula.txt"), "eula=true");
        } catch (e) {
            throw e;
        }
    }
}

const downloader = new Downloader();

export default downloader;
