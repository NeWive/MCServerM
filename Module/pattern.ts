import {PatternType} from "./interface";

export const pattern: PatternType.PatternMap = {
    TEST_RUN_SUCCESS: /EULA/,
    SERVER_START_DONE: /Done/
}

export const serverStatusPattern = [
    {
        rule: /Automatic saving is now disabled/,
        event: "save-off-done"
    },
    {
        rule: /Saved the game/,
        event: "save-all-done"
    },
    {
        rule: /joined the game/,
        event: "joint-player"
    },
    {
        rule: /Program will exit/,
        event: "server-close"
    }
]
