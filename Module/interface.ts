export namespace DownloaderType {
    export interface ListResponseSel extends ListSel{
        stable: boolean;
    }

    export interface ListSel {
        version: string;
    }

    export interface VersionAnswers {
        game: string;
        loader: string;
        installer: string;
    }
}

export namespace ConfigType {
    export interface dir extends Object{
        Versions: string;
        Cache: string;
        DB: string;
        BACKUP: string;
    }

    export interface ConfigRead {
        [i: string]: any;
    }

    export interface ServerConfig {
        [i: string]: any;
    }

    export interface BackupConfig {
        slotNumber: number;
        backupFiles: Array<string>
    }
}

export namespace PatternType {
    export interface PatternMap {
        [i: string]: RegExp;
    }

    export enum PatternAttr {
        TEST_RUN_SUCCESS = "TEST_RUN_SUCCESS",
        SERVER_START_DONE = "SERVER_START_DONE",
        SERVER_EXIT = "SERVER_EXIT"
    }
}

export namespace DBHandlerType {
    export interface DBColumn {
        cName: string;
        cDataType: string;
        attributes: Array<string>;
    }

    export interface DBTable {
        tName: string;
        columns: Array<DBColumn>;
    }

    export interface DBConfig {
        DBTarget: string;
        tables: Array<DBTable>;
    }

    export interface UpdatePairType {
        k: string;
        v: any;
    }

    export interface TableInfo {
        name: string;
    }
}
