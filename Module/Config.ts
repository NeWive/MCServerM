import {readFile} from "./FileHandler";
import path from "path";
import {ConfigType} from "./interface";

class Config {
    public projectDir: string = path.resolve(__dirname, "../");
    public fabricGameURL: string = "";
    public fabricLoaderURL: string = "";
    public fabricInstallerURL: string = "";
    public userAgent: string = "";
    public serverConfig: ConfigType.ServerConfig = {};
    public dir!: ConfigType.dir;
    public backupConfig!: ConfigType.BackupConfig

    async readConfig() {
        try {
            let d = (await readFile(path.relative(
                this.projectDir,
                path.resolve(this.projectDir, "./config.json")
            ))).toString();
            let data: ConfigType.ConfigRead = JSON.parse(d.toString());
            this.fabricGameURL = data.fabric.game;
            this.fabricLoaderURL = data.fabric.loader;
            this.fabricInstallerURL = data.fabric.installer;
            this.userAgent = data.user_agent;
            this.dir = data.dir;
            this.serverConfig = data.server_config;
            this.backupConfig = data.backup_config;
        } catch (e) {
            throw e;
        }
    }
}

const config = new Config();

export default config;
